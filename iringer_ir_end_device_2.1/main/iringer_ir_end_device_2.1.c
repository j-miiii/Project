/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * IRINGER IR Sensor End Device (v2.1)
 * 포팅: IRINGER_GET_INFO_251027 (Arduino) → ESP-IDF Zigbee End Device
 */
#include <string.h>
#include <math.h>
#include <sys/time.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_check.h"
#include "esp_timer.h"
#include "esp_sleep.h"
#include "esp_system.h"   // esp_reset_reason, esp_get_free_heap_size
#include "esp_heap_caps.h"  // heap_caps_get_minimum_free_size (장기운영 모니터링)
#include "esp_task_wdt.h"  // esp_task_wdt_add, esp_task_wdt_reset (Task WDT 등록 및 feed)
#ifdef CONFIG_PM_ENABLE
#include "esp_pm.h"
#include "esp_private/esp_clk.h"
#endif
#include "driver/gpio.h"
#include "driver/uart.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_zigbee_core.h"
#include "aps/esp_zigbee_aps.h"
#include "nwk/esp_zigbee_nwk.h"
#include "zdo/esp_zigbee_zdo_command.h"
// #include "platform/esp_zigbee_platform.h"  // esp_zb_set_default_long_poll_interval() 사용
#include "zcl/esp_zigbee_zcl_common.h"

#include "iringer_alive_marker.h"
#include "iringer_diag.h"

#if IRINGER_SLEEP_ROM_TRACE
#include "esp_rom_sys.h"   /* esp_rom_printf */
#endif


#include "iringer_ir_end_device_2.1.h"
#include "iringer_battery.h"
#include "iringer_buzzer.h"  // 버저 (수액 종료 알람)
#include "iringer_capacitor_sensor.h"  // 커패시터 센서 (수액 종료 감지)
#include "iringer_led.h"  // LED 제어
#include "iringer_tft.h"
#include "iringer_domain_alarm.h"
#include "iringer_domain_gtt.h"
#include "cJSON.h"
#include "driver/ledc.h"  // LED PWM 제어
#include "lp_core/lp_core.h"  // LP Core 통합 API
#include "lp_core/lp_core_shared_memory.h"  // LP Core 공유 메모리 (Phase 4)
#include "lp_core/lp_core_algorithm_config.h"  // LP Core 알고리즘 파라미터 (알람 상수 포함)
#include "iringer_storage.h"  // NVS 앱 설정 (total_ml, init_done)
#include "iringer_report.h"   // 리포트 페이로드 빌드
#include "iringer_zigbee.h"   // Zigbee 클러스터/EP 생성, TX Power
#include "iringer_power.h"    // 슬립 진입 조건
#include "iringer_device_data.h"  // 디바이스 데이터 캡슐화
#include "iringer_app_common.h"   // 공통 선언 (헬퍼, 공유 변수)
#include "iringer_app_report.h"   // 리포트 모듈 (iringer_update_tft_display_data 포함)
#include "iringer_alarm_config.h"  // ALARM_INTERVAL_5SEC_MS, ALARM_INTERVAL_10SEC_MS
#include <sys/time.h>  // settimeofday
#include "iringer_alarm_authority.h"

/* 서버 시간 보정값 (초). 서버가 UTC를 보내면 32400(+9h=KST).
    * 서버가 이미 KST를 보내면 0. 현재 서버는 KST 기준. */
#define SERVER_TIME_OFFSET_SEC  0

static const char *TAG = "IRINGER_IR_2.1";

// App Globals 뮤텍스 (레이스 컨디션 방지: first_downlink_*, zb_network_joined, g_server_time_* 등)
static SemaphoreHandle_t s_app_globals_mutex = NULL;

/* 마지막 다운링크 성공 수신 시각 (CAN_SLEEP 부모 건강성 체크용) */
static int64_t s_last_successful_downlink_time_us = 0;

void app_globals_init(void)
{
    if (s_app_globals_mutex == NULL) {
        s_app_globals_mutex = xSemaphoreCreateMutex();
    }
}

bool app_globals_lock(void)
{
    if (s_app_globals_mutex == NULL) {
        return false;
    }
    return xSemaphoreTake(s_app_globals_mutex, pdMS_TO_TICKS(500)) == pdTRUE;
}

void app_globals_unlock(void)
{
    if (s_app_globals_mutex != NULL) {
        xSemaphoreGive(s_app_globals_mutex);
    }
}

/* calc_drop 내부 로깅 상수 */
#define CALC_DROP_DEBUG_LOG_INTERVAL  10   /* N번마다 디버그/경고 로그 출력 */
#define CALC_DROP_GTT_LOG_THRESHOLD   0.1f /* GTT 변화량 이 값 이상일 때만 로그 */

// 서버 시간 동기화 (iringer_app_common.h extern, report/zigbee에서 사용)
uint32_t g_server_time_base = 0;
int64_t g_boot_time_us = 0;
bool g_server_time_synced = false;
uint64_t g_last_time_read_us = 0;

// 리포트 전송 요청 큐, Sleep 대기 이벤트 그룹 (iringer_app_common.h extern)
QueueHandle_t report_queue = NULL;
EventGroupHandle_t sleep_wait_event_group = NULL;

// Wake-up 시간 기록 (깨어 있는 시간 계산용)
static int64_t wake_up_time_us = 0;

// 첫 다운링크 수신 (iringer_app_common.h extern)
uint64_t first_downlink_time_us = 0;
bool first_downlink_time_recorded = false;
// 첫 다운링크 수신 후 LCD OFF 및 슬립 진입 대기 시간
// 리포트 전송 간격과 독립적으로 설정 가능
#define FIRST_DOWNLINK_SLEEP_DELAY_MS  LCD_SLEEP_DELAY_MS

// 첫 다운링크 수신 후 경과 시간(ms). 미수신 시 UINT64_MAX 반환
// 레이스 컨디션 방지: first_downlink_time_* 읽기 시 app_globals_lock 사용
uint64_t get_elapsed_ms_since_first_downlink(void)
{
    bool recorded = false;
    uint64_t time_us = 0;
    if (app_globals_lock()) {
        recorded = first_downlink_time_recorded;
        time_us = first_downlink_time_us;
        app_globals_unlock();
    }
    if (!recorded || time_us == 0) {
        return UINT64_MAX;
    }
    return (esp_timer_get_time() - time_us) / 1000;
}

// LCD_SLEEP_DELAY 구간 여부: 첫 다운링크 미수신이거나, 수신 후 LCD_SLEEP_DELAY_MS 미경과 시 true (Phase 2 타이머는 이 구간에서 시작하지 않음)
bool iringer_is_lcd_sleep_delay_period(void)
{
    uint64_t elapsed_ms = get_elapsed_ms_since_first_downlink();
    return (elapsed_ms == UINT64_MAX) || (elapsed_ms < (uint64_t)FIRST_DOWNLINK_SLEEP_DELAY_MS);
}

uint32_t first_downlink_retry_count = 0;
#define FIRST_DOWNLINK_RETRY_INTERVAL_MS 3000  // 재시도 간격 (3초)

// Self-healing: 스티어링 재시도 exponential backoff
static uint32_t s_steering_retry_count = 0;

/* sleep 중 suspend할 태스크 핸들 */
TaskHandle_t s_data_update_task_handle = NULL;
static TaskHandle_t s_watchdog_task_handle = NULL;

// ⚠️ 중요: copy 버전과 유사한 환경 만들기 - 더미 esp_timer 3개 추가 (Zigbee 플랫폼 설정 이전에)
// ir_sensor_init()이 생성하던 esp_timer 3개와 동일한 구조로 생성
// copy 버전: timer_callback(1ms), drop_timer_callback(1ms), ir_sensor_sample_callback(2ms)
// Zigbee 플랫폼 설정 이전에 생성하여 copy 버전과 동일한 초기화 순서 유지
static esp_timer_handle_t dummy_timer_handle = NULL;
static esp_timer_handle_t dummy_drop_timer_handle = NULL;
static esp_timer_handle_t dummy_sample_timer_handle = NULL;

/* ────── Sleep/Wake 진단 로깅 (NVS 저장 버전) ────── */
#if SLEEP_WAKE_LOGGING
#include "esp_pm.h"
#include "nvs.h"

#define SWLOG_MAX           100
#define SWLOG_PM_DUMP_MAX   3
#define SWLOG_DETAIL_PRINT  20
#define SWLOG_NVS_NAMESPACE "swlog"
#define SWLOG_NVS_KEY_DATA  "data"
#define SWLOG_NVS_KEY_COUNT "count"

typedef struct {
    uint32_t sleep_duration_ms;
    int      wakeup_cause;
} swlog_entry_t;

static swlog_entry_t s_swlog[SWLOG_MAX];
static uint32_t s_swlog_count = 0;
static int64_t  s_swlog_sleep_start_us = 0;
static bool     s_swlog_saved = false;
static uint32_t s_swlog_pm_dump_count = 0;

static uint32_t s_swlog_short_count = 0;  /* duration < 100ms 횟수 */

static void swlog_record(int cause)
{
    if (s_swlog_saved) return;
    int64_t now = esp_timer_get_time();
    uint32_t duration_ms = (uint32_t)((now - s_swlog_sleep_start_us) / 1000);

    /* 짧은 wake (연타)는 카운터만 올리고 NVS에 안 씀 */
    if (duration_ms < 100) {
        s_swlog_short_count++;
        /* short만이라도 1000건 쌓이면 NVS에 저장 */
        if (s_swlog_short_count >= 1000 && !s_swlog_saved) {
            nvs_handle_t h;
            if (nvs_open(SWLOG_NVS_NAMESPACE, NVS_READWRITE, &h) == ESP_OK) {
                nvs_set_u32(h, SWLOG_NVS_KEY_COUNT, 0);
                nvs_set_u32(h, "short_cnt", s_swlog_short_count);
                nvs_commit(h);
                nvs_close(h);
                s_swlog_saved = true;
            }
        }
        return;
    }

    /* 긴 wake만 기록 */
    if (s_swlog_count >= SWLOG_MAX) return;
    uint32_t i = s_swlog_count++;
    s_swlog[i].sleep_duration_ms = duration_ms;
    s_swlog[i].wakeup_cause      = cause;

    if (s_swlog_count >= 5) {
        nvs_handle_t h;
        if (nvs_open(SWLOG_NVS_NAMESPACE, NVS_READWRITE, &h) == ESP_OK) {
            nvs_set_u32(h, SWLOG_NVS_KEY_COUNT, s_swlog_count);
            nvs_set_u32(h, "short_cnt", s_swlog_short_count);
            nvs_set_blob(h, SWLOG_NVS_KEY_DATA, s_swlog, s_swlog_count * sizeof(swlog_entry_t));
            nvs_commit(h);
            nvs_close(h);
            s_swlog_saved = true;
        }
    }
}

/* 부팅 시 호출 — NVS에 저장된 이전 sleep 로그가 있으면 출력 후 삭제 */
static void swlog_load_and_print(void)
{
    nvs_handle_t h;
    if (nvs_open(SWLOG_NVS_NAMESPACE, NVS_READWRITE, &h) != ESP_OK) return;

    uint32_t count = 0;
    nvs_get_u32(h, SWLOG_NVS_KEY_COUNT, &count);

    uint32_t short_count = 0;
    nvs_get_u32(h, "short_cnt", &short_count);


    if (count == 0 && short_count == 0) {
        ESP_LOGW(TAG, "[swlog] 이전 세션 sleep 로그 없음 (NVS 비어있음)");
        nvs_close(h);
        return;
    }
    
    /* short만 있고 long 없는 경우 */
    if (count == 0) {
        ESP_LOGW(TAG, "╔═══ [이전 세션] Sleep/Wake 진단 로그 ═══");
        ESP_LOGW(TAG, "║ 짧은 wake (< 100ms, 연타): %lu건", (unsigned long)short_count);
        ESP_LOGW(TAG, "║ 긴 wake (>= 100ms): 0건");
        ESP_LOGW(TAG, "║ → USB 없이도 연타 지속 확인됨");
        ESP_LOGW(TAG, "╚═══ 끝 ═══");
        nvs_erase_key(h, "short_cnt");
        nvs_commit(h);
        nvs_close(h);
        return;
    }

    if (count > SWLOG_MAX) count = SWLOG_MAX;

    swlog_entry_t buf[SWLOG_MAX];
    size_t blob_size = count * sizeof(swlog_entry_t);
    if (nvs_get_blob(h, SWLOG_NVS_KEY_DATA, buf, &blob_size) != ESP_OK) {
        nvs_close(h);
        return;
    }

    /* 통계 계산 */
    uint32_t cause_cnt[8] = {0};
    uint32_t min_ms = UINT32_MAX, max_ms = 0;
    uint64_t sum_ms = 0;
    for (uint32_t i = 0; i < count; i++) {
        int c = buf[i].wakeup_cause;
        if (c >= 0 && c < 8) cause_cnt[c]++;
        uint32_t d = buf[i].sleep_duration_ms;
        if (d < min_ms) min_ms = d;
        if (d > max_ms) max_ms = d;
        sum_ms += d;
    }

    /* 출력 */
    ESP_LOGW(TAG, "╔═══ [이전 세션] Sleep/Wake 진단 로그 ═══");
    ESP_LOGW(TAG, "║ 짧은 wake (< 100ms, 연타): %lu건", (unsigned long)short_count);
    ESP_LOGW(TAG, "║ 긴 wake (>= 100ms, 정상 sleep 후보): %lu건", (unsigned long)count);
    ESP_LOGW(TAG, "║ duration: min=%lums  max=%lums  avg=%lums",
             (unsigned long)min_ms, (unsigned long)max_ms,
             (unsigned long)(sum_ms / count));

    static const char *cause_name[] = {
        "UNDEFINED","EXT0","EXT1","TIMER","TOUCHPAD","ULP","GPIO","WIFI"
    };
    for (int c = 0; c < 8; c++) {
        if (cause_cnt[c] > 0) {
            ESP_LOGW(TAG, "║ cause %s(%d): %lu건",
                     cause_name[c], c, (unsigned long)cause_cnt[c]);
        }
    }

    uint32_t detail = (count < SWLOG_DETAIL_PRINT) ? count : SWLOG_DETAIL_PRINT;
    for (uint32_t i = 0; i < detail; i++) {
        ESP_LOGW(TAG, "║ [%lu] cause=%d  duration=%lums",
                 (unsigned long)i, buf[i].wakeup_cause,
                 (unsigned long)buf[i].sleep_duration_ms);
    }
    if (count > SWLOG_DETAIL_PRINT) {
        ESP_LOGW(TAG, "║ ... 이하 %lu건 생략", (unsigned long)(count - SWLOG_DETAIL_PRINT));
    }
    ESP_LOGW(TAG, "╚═══ [이전 세션] Sleep/Wake 진단 로그 끝 ═══");

    /* 출력했으니 NVS에서 삭제 */
    nvs_erase_key(h, SWLOG_NVS_KEY_COUNT);
    nvs_erase_key(h, SWLOG_NVS_KEY_DATA);
    nvs_commit(h);
    nvs_close(h);
}

/* 현재 세션 로그 시리얼 출력 (UART 연결 상태에서만 의미) */
static void swlog_dump(void)
{
    if (s_swlog_count < 10) return;

    ESP_LOGW(TAG, "╔═══ Sleep/Wake 진단 로그 (%lu건) ═══", (unsigned long)s_swlog_count);

    uint32_t cause_cnt[8] = {0};
    uint32_t min_ms = UINT32_MAX, max_ms = 0;
    uint64_t sum_ms = 0;
    for (uint32_t i = 0; i < s_swlog_count; i++) {
        int c = s_swlog[i].wakeup_cause;
        if (c >= 0 && c < 8) cause_cnt[c]++;
        uint32_t d = s_swlog[i].sleep_duration_ms;
        if (d < min_ms) min_ms = d;
        if (d > max_ms) max_ms = d;
        sum_ms += d;
    }
    ESP_LOGW(TAG, "║ duration: min=%lums  max=%lums  avg=%lums",
             (unsigned long)min_ms, (unsigned long)max_ms,
             (unsigned long)(sum_ms / s_swlog_count));

    static const char *cause_name[] = {
        "UNDEFINED","EXT0","EXT1","TIMER","TOUCHPAD","ULP","GPIO","WIFI"
    };
    for (int c = 0; c < 8; c++) {
        if (cause_cnt[c] > 0) {
            ESP_LOGW(TAG, "║ cause %s(%d): %lu건",
                     cause_name[c], c, (unsigned long)cause_cnt[c]);
        }
    }

    uint32_t detail = (s_swlog_count < SWLOG_DETAIL_PRINT) ? s_swlog_count : SWLOG_DETAIL_PRINT;
    for (uint32_t i = 0; i < detail; i++) {
        ESP_LOGW(TAG, "║ [%lu] cause=%d  duration=%lums",
                 (unsigned long)i, s_swlog[i].wakeup_cause,
                 (unsigned long)s_swlog[i].sleep_duration_ms);
    }
    if (s_swlog_count > SWLOG_DETAIL_PRINT) {
        ESP_LOGW(TAG, "║ ... 이하 %lu건 생략",
                 (unsigned long)(s_swlog_count - SWLOG_DETAIL_PRINT));
    }
    ESP_LOGW(TAG, "╚═══ Sleep/Wake 진단 로그 끝 ═══");
}
#endif /* SLEEP_WAKE_LOGGING */

static uint32_t get_reconnect_backoff_ms(void)
{
    uint32_t delay = RECONNECT_BACKOFF_BASE_MS;
    uint32_t retry = s_steering_retry_count;
    while (retry > 0 && delay < RECONNECT_BACKOFF_MAX_MS) {
        delay *= RECONNECT_BACKOFF_MULTIPLIER;
        if (delay > RECONNECT_BACKOFF_MAX_MS) {
            delay = RECONNECT_BACKOFF_MAX_MS;
        }
        retry--;
    }
    return delay;
}

// 수액 종료 알람 로직을 위한 부팅 시간 추적 (iringer_app_common.h extern)
uint64_t device_boot_time_us = 0;

void init_device_data()
{
    const int lock_retry_max = 5;
    bool locked = false;
    for (int retry = 0; retry < lock_retry_max; retry++) {
        if (device_data_lock()) {
            locked = true;
            break;
        }
        ESP_LOGW(TAG, "init_device_data: device_data_lock timeout (재시도 %d/%d)", retry + 1, lock_retry_max);
        vTaskDelay(pdMS_TO_TICKS(100));
    }
    if (!locked) {
        ESP_LOGE(TAG, "init_device_data: device_data_lock 실패, 기본값으로 진행");
        return;
    }
    create_serial_number(device_data_get_mutable()->serial_number);
    
    // 서버에서 초기 데이터를 받기 전까지는 r_volume_max를 표시하지 않음
    // NVS에 저장된 값이 있어도 서버에서 받기 전까지는 사용하지 않음
    // (서버에서 받은 값이 최신이므로 서버 데이터를 우선시)
    bool has_initial_data = storage_is_initial_data_received();
    
    if (has_initial_data) {
        int ml = storage_get_total_ml();
        if (ml >= 0) {
            device_data_get_mutable()->r_volume_max = (float)ml;
            device_data_get_mutable()->r_volume_now = device_data_get_mutable()->r_volume_max;
            lp_core_set_r_volume_max(device_data_get_mutable()->r_volume_max);
            ESP_LOGI(TAG, "%s %.1f ml, %s %.1f ml",
                     "NVS에서 총 수액량 로드:", device_data_get_mutable()->r_volume_max,
                     "현재 수액량 초기화:", device_data_get_mutable()->r_volume_now);
        } else {
            ESP_LOGW(TAG, "%s %.1f ml", "NVS에서 총 수액량 로드 실패, 기본값 사용:", device_data_get_mutable()->r_volume_max);
            device_data_get_mutable()->r_volume_now = device_data_get_mutable()->r_volume_max;
        }
    } else {
        // 서버에서 초기 데이터를 받기 전까지는 r_volume_max를 0으로 설정하여 UI에 표시하지 않음
        device_data_get_mutable()->r_volume_max = 0.0f;
        device_data_get_mutable()->r_volume_now = 0.0f;
        ESP_LOGI(TAG, "%s", "서버에서 초기 데이터를 받기 전: 총 수액량 표시 안함");
    }
    device_data_unlock();
}

/* LP Core에서 GTT·주입량 읽어 device_data 반영. 성공 시 true, drop_speed/drop_cnt 설정 */
static bool calc_drop_fetch_lp_core(float *out_drop_speed, uint32_t *out_drop_cnt, uint32_t drop_count)
{
    if (!lp_core_is_running()) {
        static uint32_t not_running_count = 0;
        if (++not_running_count % CALC_DROP_DEBUG_LOG_INTERVAL == 0) {
            ESP_LOGW(TAG, "[calc_drop #%lu] LP Core가 실행 중이 아님", (unsigned long)drop_count);
        }
        return false;
    }

    lp_core_shared_data_t lp_data;
    esp_err_t ret = lp_core_get_data(&lp_data);
    if (ret != ESP_OK) {
        static uint32_t error_count = 0;
        if (++error_count % CALC_DROP_DEBUG_LOG_INTERVAL == 0) {
            ESP_LOGE(TAG, "[calc_drop #%lu] LP Core 데이터 가져오기 실패: %s",
                     (unsigned long)drop_count, esp_err_to_name(ret));
        }
        return false;
    }

    if (!lp_data.data_ready) {
        static uint32_t debug_count = 0;
        if (++debug_count % CALC_DROP_DEBUG_LOG_INTERVAL == 0) {
            ESP_LOGW(TAG, "LP Core 실행 중이지만 data_ready=false (sample_count=%lu, lp_core_running=%d)",
                     (unsigned long)lp_data.sample_count, lp_data.lp_core_running);
        }
        return false;
    }

    // --- LP Core가 감쇠 계산을 도맡음 (단일 권위자) ---
    // LP Core의 shared->gtt가 이미 감쇠 적용됨 (방법 A).
    // HP Core는 감쇠를 재계산하지 않고, LP Core 값을 그대로 사용.
    float display_gtt = 0.0f;

    // GTT 안정화 상태일 경우 기준 GTT 우선 표시 (안정성 확보)
    if (lp_data.gtt_stable && lp_data.gtt > 0 && lp_data.reference_gtt > 0) {
        display_gtt = (float)lp_data.reference_gtt;
        ESP_LOGD(TAG, "LP Core 데이터 사용: 기준 GTT=%.1f (안정화 완료), drop_cnt=%lu",
                 display_gtt, (unsigned long)lp_data.drop_cnt);
    } else {
        display_gtt = (float)lp_data.gtt;
        ESP_LOGD(TAG, "LP Core 감쇠 GTT 사용: GTT=%.1f, drop_cnt=%lu, interval=%lu",
                 display_gtt, (unsigned long)lp_data.drop_cnt, lp_data.drop_interval_us);
    }

    // LCD 및 서버 리포트용: THRESHOLD 미만이면 0으로 표시
    if (display_gtt > 0.0f && display_gtt < (float)LP_ALGO_ALARM_GTT_THRESHOLD) {
        display_gtt = 0.0f;
    }

    *out_drop_speed = display_gtt / 60.0f;
    *out_drop_cnt = lp_data.drop_cnt;

    float old_gtt = device_data_get_mutable()->gtt;
    device_data_get_mutable()->gtt = display_gtt;
    if (old_gtt != device_data_get_mutable()->gtt) {
        ESP_LOGD(TAG, "[device_data.gtt 변경] %.1f → %.1f (기준 GTT 사용: %s)",
                 old_gtt, device_data_get_mutable()->gtt, lp_data.gtt_stable ? "예" : "아니오");
    }

    if (device_data_get_mutable()->r_volume_max > 0.0f) {
        device_data_get_mutable()->injected_amount = (float)lp_data.injected_amount_x10000 / 10000.0f;
    } else {
        device_data_get_mutable()->injected_amount = 0.0f;
    }
    return true;
}

/* LP Core 미사용 시 공유 메모리에서 GTT 읽어 device_data·drop_speed 반영 */
static void calc_drop_apply_gtt_fallback(float *io_drop_speed)
{
    lp_core_shared_data_t lp_data;
    if (lp_core_get_data(&lp_data) == ESP_OK && lp_data.data_ready) {
        float display_gtt = lp_data.gtt_stable ? (float)lp_data.reference_gtt : (float)lp_data.gtt;
        /* LCD/서버용: THRESHOLD 미만이면 0으로 표시 */
        if (display_gtt > 0.0f && display_gtt < (float)LP_ALGO_ALARM_GTT_THRESHOLD) {
            display_gtt = 0.0f;
        }
        float old_gtt = device_data_get_mutable()->gtt;
        device_data_get_mutable()->gtt = display_gtt;
        *io_drop_speed = display_gtt / 60.0f;
        if (old_gtt != device_data_get_mutable()->gtt) {
            ESP_LOGD(TAG, "[GTT-공유메모리] device_data.gtt 변경: %.1f → %.1f (기준 GTT 사용: %s)",
                     old_gtt, device_data_get_mutable()->gtt, lp_data.gtt_stable ? "예" : "아니오");
        }
    } else {
        float gtt_float = *io_drop_speed * 60.0f;
        device_data_get_mutable()->gtt = (gtt_float <= 0.0f) ? 0.0f : gtt_float;
    }
}

/* ml_per_hour, r_volume_now, rest_min 계산 및 drop_per_sec/drop_cnt 반영 */
static bool calc_drop_update_volume_and_derived(float drop_speed, uint32_t drop_cnt)
{
    device_data_get_mutable()->drop_per_sec = drop_speed;
    device_data_get_mutable()->drop_cnt = drop_cnt;

    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    float r_adrop = (shared && shared->r_adrop_x10000 > 0) ?
        (float)shared->r_adrop_x10000 / 10000.0f : LP_DEFAULT_DROP;

    if (device_data_get_mutable()->gtt > 0.0f && r_adrop > 0.0f) {
        device_data_get_mutable()->ml_per_hour = device_data_get_mutable()->gtt * r_adrop * 60.0f;
    } else {
        device_data_get_mutable()->ml_per_hour = 0.0f;
    }

    bool need_to_update = false;
    if (device_data_get_mutable()->r_volume_max > 0.0f) {
        device_data_get_mutable()->r_volume_now =
            device_data_get_mutable()->r_volume_max - device_data_get_mutable()->injected_amount;
        device_data_get_mutable()->rest_min = (device_data_get_mutable()->ml_per_hour > 0.0f) ?
            (uint16_t)(device_data_get_mutable()->r_volume_now / device_data_get_mutable()->ml_per_hour * 60.0f) : 0;
        if (device_data_get_mutable()->r_volume_now <= 0.0f) {
            device_data_get_mutable()->r_volume_now = 0.0f;
            need_to_update = true;
        }
    } else {
        device_data_get_mutable()->injected_amount = 0.0f;
        device_data_get_mutable()->r_volume_now = 0.0f;
        device_data_get_mutable()->rest_min = 0;
    }
    return need_to_update;
}

// 방울 속도 및 잔량 계산 (Arduino calc_drop() 포팅)
static bool calc_drop(void)
{
    static uint32_t calc_drop_count = 0;
    calc_drop_count++;

    float drop_speed = 0.0f;
    uint32_t drop_cnt = 0;
    bool use_lp_core_data = calc_drop_fetch_lp_core(&drop_speed, &drop_cnt, calc_drop_count);

    if (!use_lp_core_data) {
        ESP_LOGW(TAG, "[calc_drop #%lu] LP Core 데이터 사용 불가, GTT=0으로 설정", (unsigned long)calc_drop_count);
        drop_speed = 0.0f;
        drop_cnt = 0;
        device_data_get_mutable()->injected_amount = 0.0f;
        calc_drop_apply_gtt_fallback(&drop_speed);
    }

    bool need_to_update = check_need_to_update(drop_speed);

    static float last_logged_gtt = -1.0f;
    if (fabsf(device_data_get_mutable()->gtt - last_logged_gtt) > CALC_DROP_GTT_LOG_THRESHOLD) {
        ESP_LOGD(TAG, "[calc_drop 최종] device_data.gtt=%.1f (drop_speed=%.3f, drop_cnt=%lu, use_lp_core_data=%d)",
                 device_data_get_mutable()->gtt, drop_speed, (unsigned long)drop_cnt, use_lp_core_data);
        last_logged_gtt = device_data_get_mutable()->gtt;
    }

    need_to_update |= calc_drop_update_volume_and_derived(drop_speed, drop_cnt);
    return need_to_update;
}

// Time Cluster Read Attributes로 시간 요청
// Zigbee Time Cluster Read Attributes 명령으로 코디네이터에서 시간 요청
static void request_time_from_coordinator(void)
{
    // Zigbee 스택이 준비되었는지 확인
    if (esp_zb_lock_acquire(pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGW(TAG, "request_time_from_coordinator: Zigbee lock timeout (address check)");
        return;
    }
    uint16_t current_short_addr = esp_zb_get_short_address();
    esp_zb_lock_release();
    
    if (current_short_addr == 0xFFFF || current_short_addr == 0x0000 || current_short_addr == 0xFFFE) {
        ESP_LOGW(TAG, "Time Cluster Read Attributes 전송 실패: Zigbee 스택 미준비 (short_addr=0x%04x)", current_short_addr);
        return;
    }
    
    // 코디네이터 주소 (0x0000)
    uint16_t coordinator_addr = 0x0000;
    
    // Time Cluster Read Attributes 명령 전송
    esp_zb_zcl_read_attr_cmd_t read_req = {0};
    read_req.address_mode = ESP_ZB_APS_ADDR_MODE_16_ENDP_PRESENT;
    read_req.zcl_basic_cmd.src_endpoint = IRINGER_ENDPOINT;
    read_req.zcl_basic_cmd.dst_endpoint = IRINGER_COORDINATOR_ENDPOINT;  // 코디네이터 endpoint
    read_req.zcl_basic_cmd.dst_addr_u.addr_short = coordinator_addr;
    read_req.clusterID = 0x000A;  // Time Cluster ID
    
    // Time 속성 (0x0000) 읽기
    static uint16_t time_attr = 0x0000;
    read_req.attr_number = 1;
    read_req.attr_field = &time_attr;
    
    esp_err_t ret = ESP_FAIL;
    if (esp_zb_lock_acquire(pdMS_TO_TICKS(2000)) == pdTRUE) {
        ret = esp_zb_zcl_read_attr_cmd_req(&read_req);
        esp_zb_lock_release();
    } else {
        ESP_LOGW(TAG, "request_time_from_coordinator: Zigbee lock timeout (cmd_req)");
    }
    
    if (ret == ESP_OK) {
        ESP_LOGD(TAG, "Time Cluster Read Attributes 전송: coordinator=0x%04x, endpoint=%d", coordinator_addr, IRINGER_COORDINATOR_ENDPOINT);
        if (app_globals_lock()) {
            g_last_time_read_us = esp_timer_get_time();
            app_globals_unlock();
        }
    } else {
        ESP_LOGW(TAG, "Time Cluster Read Attributes 전송 실패: err=%s (0x%x)", esp_err_to_name(ret), ret);
    }
}

// Light Sleep 준비 함수
// Light Sleep 관련 함수 제거 (사용하지 않음)
// 백라이트만 꺼지고 프로그램은 계속 실행되므로 Light Sleep 불필요
// 새로운 하드웨어 v2.1: 전원 버튼 없음, 슬라이드 스위치로 전원 제어
// 전원 버튼 모니터링 태스크 제거됨

// 데이터 업데이트 태스크 (30초 주기) - iringer_app_common.h extern
volatile bool zb_network_joined = false;
volatile bool should_send_on_wakeup = false;
bool s_wakeup_for_report_only = false;

// ESP Light Sleep 전용 메인 루틴 (리포트 전송 및 슬립 진입 전용)
// 함수 선언
static void iringer_main_loop(void);

// 상태 머신 (30일 PoC #7) - ERROR/RECOVERY 전이
static app_state_t g_app_state = APP_INIT;
static uint32_t s_join_timeout_count = 0;

static const char *app_state_str(app_state_t s)
{
    switch (s) {
        case APP_INIT: return "INIT";
        case APP_IDLE: return "IDLE";
        case APP_JOIN_WAIT: return "JOIN_WAIT";
        case APP_REPORT: return "REPORT";
        case APP_DOWNLINK_WAIT: return "DOWNLINK_WAIT";
        case APP_LCD_SLEEP_DELAY: return "LCD_SLEEP_DELAY";
        case APP_SLEEP: return "SLEEP";
        case APP_ERROR: return "ERROR";
        case APP_RECOVERY: return "RECOVERY";
        default: return "?";
    }
}

/* RECOVERY 시 스티어링 재시작용 (정의는 신호 핸들러 근처에 있음) */
static void bdb_start_top_level_commissioning_cb(uint8_t mode_mask);

// ESP Light Sleep 전용 메인 루틴 태스크 래퍼
static void iringer_main_loop_task(void *pvParameters)
{
    iringer_main_loop();
}

// ESP Zigbee Light Sleep 정석: 메인 루프
// Sleep 진입은 CAN_SLEEP 시그널 핸들러에서 처리 (이 루프에서 sleep을 직접 호출하지 않음)
static void iringer_main_loop(void)
{
    ESP_LOGI(TAG, "Zigbee Light Sleep 메인 루틴 시작 (CAN_SLEEP 정석 모드)");
    g_app_state = APP_IDLE;

    static uint32_t s_main_loop_iter = 0;
    while (1) {
        s_main_loop_iter++;

        alive_marker_set_location(MARKER_LOC_MAIN_LOOP_TOP);
        alive_marker_set_main_loop_iter(s_main_loop_iter);
        alive_marker_set_app_state((uint8_t)g_app_state);

        ESP_LOGW(TAG, "[MAINLOOP HB] iter=%lu state=%s t=%llu ms",
                 (unsigned long)s_main_loop_iter,
                 app_state_str(g_app_state),
                 (unsigned long long)(esp_timer_get_time() / 1000));
#if SLEEP_WAKE_LOGGING
        /* UART 재연결 후 쌓인 sleep 로그 자동 출력 */
        swlog_dump();
#endif
        /* ── 1. 네트워크 연결 확인 ── */
        if (!esp_zb_bdb_dev_joined()) {
            g_app_state = APP_JOIN_WAIT;
            /* watchdog vTaskResume 제거 — CAN_SLEEP에서 suspend 안 하므로 불필요 */
            ESP_LOGW(TAG, "네트워크 미조인 — 조인 완료 대기 중 (state=%s)", app_state_str(g_app_state));

            uint32_t join_wait_time = 0;
            while (!esp_zb_bdb_dev_joined() && join_wait_time < NETWORK_JOIN_WAIT_TIMEOUT_MS) {
                vTaskDelay(pdMS_TO_TICKS(NETWORK_JOIN_WAIT_STEP_MS));
                join_wait_time += NETWORK_JOIN_WAIT_STEP_MS;
                if (join_wait_time % NETWORK_JOIN_STATUS_LOG_INTERVAL_MS == 0) {
                    ESP_LOGI(TAG, "네트워크 조인 대기 중... (%lu초 경과)", join_wait_time / 1000);
                }
            }

            if (!esp_zb_bdb_dev_joined()) {
                s_join_timeout_count++;
                if (s_join_timeout_count >= APP_ERROR_JOIN_TIMEOUT_THRESHOLD) {
                    g_app_state = APP_ERROR;
                    ESP_LOGW(TAG, "네트워크 조인 타임아웃 (state=ERROR, count=%lu)", (unsigned long)s_join_timeout_count);
                    vTaskDelay(pdMS_TO_TICKS(APP_RECOVERY_DELAY_MS));
                    g_app_state = APP_RECOVERY;
                    ESP_LOGI(TAG, "RECOVERY 진입 — 조인 재시도");
                    /* 최신 커밋의 RECOVERY 스티어링 재시작 유지 */
                    esp_zb_scheduler_alarm((esp_zb_callback_t)bdb_start_top_level_commissioning_cb,
                                           ESP_ZB_BDB_MODE_NETWORK_STEERING, 0);
                }
                vTaskDelay(pdMS_TO_TICKS(NETWORK_JOIN_STATUS_LOG_INTERVAL_MS));
                continue;
            }

            s_join_timeout_count = 0;
            g_app_state = APP_IDLE;
            ESP_LOGI(TAG, "네트워크 조인 완료");
        }

        /* ── 2. 리포트 전송 (전략1: 전송 직전에만 주변장치 깨움) ── */
        g_app_state = APP_REPORT;
        ESP_LOGI(TAG, "리포트 전송 시작");

        /* ACTIVE/AWAKE_HOLD 중에는 data_update_task가 LCD(SPI) 업데이트 중이므로
         * ADC reinit과의 GDMA 버스 충돌 방지를 위해 일시 정지.
         * 수십ms 정도의 LCD 갱신 공백 발생하나 체감 불가. */
        bool alarm_active_for_adc = alarm_authority_is_active();
        if (alarm_active_for_adc && s_data_update_task_handle) {
            vTaskSuspend(s_data_update_task_handle);
        }

        /* sleep 중 멈춰있던 주변장치 복원 (리포트 전송에 필요한 것만) */
        battery_adc_reinit();

        /* ADC 완료 → data_update_task 재개 */
        if (alarm_active_for_adc && s_data_update_task_handle) {
            vTaskResume(s_data_update_task_handle);
        }

        if (dummy_timer_handle)        esp_timer_start_periodic(dummy_timer_handle, 1000);
        if (dummy_drop_timer_handle)   esp_timer_start_periodic(dummy_drop_timer_handle, 1000);
        if (dummy_sample_timer_handle) esp_timer_start_periodic(dummy_sample_timer_handle, 2000);
        /* watchdog vTaskResume 제거 — CAN_SLEEP에서 suspend 안 하므로 불필요 */

        esp_app_iringer_data_handler(false);

        /* ── 2-B. 보조 알람 체크: 비상 이벤트를 놓친 경우 대비 (#6) ── */
#if !DISABLE_ALARM_FOR_BATTERY_TEST
        alarm_authority_update();
#endif

        /* ── 3. 다운링크 수신 대기 (최대 5초) ── */
        g_app_state = APP_DOWNLINK_WAIT;
        bool downlink_received = app_wait_for_downlink(DOWNLINK_WAIT_TIMEOUT_MS);

        if (!downlink_received) {
            /* 첫 다운링크 미수신 시 재시도 (Sleep 진입 안 함) */
            bool first_dl_not_recorded = false;
            uint32_t retry_cnt = 0;
            if (app_globals_lock()) {
                first_dl_not_recorded = !first_downlink_time_recorded;
                if (esp_zb_bdb_dev_joined() && first_dl_not_recorded) {
                    first_downlink_retry_count++;
                    retry_cnt = first_downlink_retry_count;
                }
                app_globals_unlock();
            }
            if (esp_zb_bdb_dev_joined() && first_dl_not_recorded) {
                ESP_LOGW(TAG, "첫 다운링크 미수신 (재시도 %lu회) — %d초 후 리포트 재전송",
                         (unsigned long)retry_cnt, FIRST_DOWNLINK_RETRY_INTERVAL_MS / 1000);
                vTaskDelay(pdMS_TO_TICKS(FIRST_DOWNLINK_RETRY_INTERVAL_MS));
                continue;
            }
        } else {
            if (app_globals_lock()) {
                if (first_downlink_retry_count > 0) {
                    ESP_LOGI(TAG, "첫 다운링크 수신 성공 (재시도 %lu회 후)", (unsigned long)first_downlink_retry_count);
                    first_downlink_retry_count = 0;
                }
                app_globals_unlock();
            }
        }

        /* 리포트 전송 완료 — report_only 플래그 리셋 */
        if (app_globals_lock()) {
            s_wakeup_for_report_only = false;
            app_globals_unlock();
        }

        g_app_state = APP_SLEEP;
        ESP_LOGI(TAG, "다음 리포트까지 %d초 대기 (CAN_SLEEP이 sleep 관리)", REPORT_INTERVAL_SEC);

        EventBits_t bits = xEventGroupWaitBits(
            sleep_wait_event_group,
            EVENT_BIT_EMERGENCY_REPORT,
            pdTRUE,
            pdFALSE,
            pdMS_TO_TICKS(REPORT_INTERVAL_MS)
        );

        g_app_state = APP_IDLE;

#if !DISABLE_ALARM_FOR_BATTERY_TEST
        if (bits & EVENT_BIT_EMERGENCY_REPORT) {
            ESP_LOGW(TAG, "비상 wakeup — alarm_authority에 위임");
            alarm_authority_update();           /* 0gtt면 여기서 ACTIVE */
            if (alarm_authority_get_state() != ALARM_STATE_ACTIVE) {
                /* IDLE → AWAKE_HOLD 진입, 또는 이미 AWAKE_HOLD → 타이머 리셋 */
                alarm_authority_enter_awake_hold();
            }
        }
#endif

        /* 루프 상단으로 돌아가서 리포트 전송 */
        ESP_LOGI(TAG, "다음 리포트 전송 준비 (state=%s)", app_state_str(g_app_state));
        alive_marker_set_location(MARKER_LOC_MAIN_LOOP_END);
    }
}

static void iringer_data_update_task(void *pvParameters)
{
    // 리포트 설정 변경 감지 변수 제거 (태스크 딜레이 방식으로 직접 전송하므로 불필요)
    static float prev_gtt_value = 0.0f;  // 이전 GTT 값 저장 (30% 변화 감지용)
    static bool is_first_gtt_measurement = true;  // 첫 GTT 측정 여부
    
    ESP_LOGI(TAG, "%s", "데이터 업데이트 태스크 시작 (ESP Light Sleep 전용 모드)");
    ESP_LOGI(TAG, "%s", "ESP Light Sleep 전용: 리포트 전송 → 다운링크 수신 → Light Sleep → 반복");
    if (lp_core_is_running()) {
        ESP_LOGI(TAG, "%s", "GTT 측정: LP Core 사용 중");
    } else {
        ESP_LOGI(TAG, "%s", "GTT 측정: GPIO 인터럽트 방식 사용");
    }
    
    vTaskDelay(pdMS_TO_TICKS(2000));
    {
        bool synced = true;
        if (app_globals_lock()) {
            synced = g_server_time_synced;
            app_globals_unlock();
        }
        if (!synced) {
            ESP_LOGI(TAG, "초기 부팅: Time Cluster Read Attributes 전송 (시간 동기화 대기 중)");
            request_time_from_coordinator();
        }
    }

#if !LCD_SLEEP_WAKE_STRESS_TEST
    /* ⚠️ 메인 루프 태스크 시작 — 리포트 전송 + 다운링크 대기 + sleep 진입 책임.
     * 양산 빌드에 필수. baseline 6f975db에 있던 라인.
     *
     * STRESS TEST 빌드에서는 LCD on/off 사이클만 격리 검증하기 위해 비활성.
     *  - main_loop가 돌면 battery_adc_reinit, task suspend/resume,
     *    Zigbee TX 등이 LCD 테스트와 간섭함.
     *  - 어차피 stress test는 esp_zb_sleep_now()도 가드로 막혀 있어 main_loop는
     *    무한 루프만 돌게 됨. */
    xTaskCreate(iringer_main_loop_task, "iringer_main", 5120, NULL, 5, NULL);
#else
    ESP_LOGW(TAG, "STRESS TEST: iringer_main_loop_task 비활성 (LCD 테스트 격리)");
#endif

    // ⚠️ 중요: GTT 측정과 LCD 업데이트는 첫 다운링크 수신과 무관하게 독립적으로 동작
    // 1초마다 계속 실행 (네트워크 연결 여부와 무관하게)
    /* 진단: data_update_task heartbeat (10초마다) */
    static uint32_t s_data_update_hb_count = 0;
    static uint64_t s_last_data_update_hb_ms = 0;
    while (1) {
        // 1초마다 GTT 측정 및 LCD 업데이트
        vTaskDelay(pdMS_TO_TICKS(DATA_UPDATE_TASK_INTERVAL_MS));

        /* ── ALIVE MARKER 1초 갱신 ── */
        alive_marker_set_location(MARKER_LOC_DATA_UPDATE_TASK);
        alive_marker_set_lcd_sleeping(tft_is_lcd_sleeping());

        uint64_t current_time_ms = esp_timer_get_time() / 1000;  /* 49.7일 overflow 방지 */
        
        /* 진단: 10초마다 heartbeat — 태스크가 어디서 끊기는지 추적용 */
        if (current_time_ms - s_last_data_update_hb_ms >= 10000) {
            ESP_LOGW(TAG, "data_update_task heartbeat #%lu (t=%llu ms, lcd_sleeping=%d)",
                     (unsigned long)++s_data_update_hb_count,
                     (unsigned long long)current_time_ms,
                     tft_is_lcd_sleeping() ? 1 : 0);
            s_last_data_update_hb_ms = current_time_ms;
        }
        
        // 1. 배터리 측정 (Lock 밖에서 수행 - 데드락 방지)
        static uint64_t last_battery_measure_time = 0;
        bool do_battery_update = false;
        uint8_t measured_battery_level = 0;
        uint32_t measured_voltage_mv = 0;
        
        if (last_battery_measure_time == 0 || 
            (current_time_ms - last_battery_measure_time >= BATTERY_MEASURE_INTERVAL_MS)) {
            // 배터리 전압 및 레벨 측정 (내부적으로 vTaskDelay 110ms 포함하므로 락 밖에서 실행해야 함)
            measured_voltage_mv = battery_get_voltage();
            measured_battery_level = battery_get_level();
            do_battery_update = true;
            last_battery_measure_time = current_time_ms;
        }
        
        // 2. 상태 로그 출력용 주소 정보 가져오기 (Lock 밖에서 수행 - 데드락 방지)
        static uint64_t last_status_log_time = 0;  /* 49.7일 overflow 방지 */
        bool do_status_log = false;
        uint16_t my_addr = 0;
        uint16_t pan_id = 0;
        uint16_t parent_addr = 0;
        
        if (current_time_ms - last_status_log_time >= STATUS_LOG_INTERVAL_MS) {
            if (esp_zb_lock_acquire(pdMS_TO_TICKS(1000)) == pdTRUE) {
                my_addr = esp_zb_get_short_address();
                pan_id = esp_zb_get_pan_id(); // <--- 1. 추가: PAN ID 가져오기
                esp_zb_lock_release();
            } else {
                ESP_LOGW(TAG, "iringer_data_update_task: Zigbee lock timeout (status log)");
            }
            
            // [수정] 복잡한 로직 다 버리고, 헬퍼 함수 호출로 변경
            parent_addr = get_ed_parent_addr();
            do_status_log = true;
            last_status_log_time = current_time_ms;
        }

        // 3. 디바이스 데이터 업데이트 (전역 변수 보호용 Lock)
        if (!device_data_lock()) {
            ESP_LOGW(TAG, "iringer_data_update_task: device_data_lock timeout, skip this cycle");
            continue;
        }

        // 배터리 측정값 업데이트
        if (do_battery_update) {
            device_data_get_mutable()->battery_level = measured_battery_level;
            ESP_LOGD(TAG, "배터리 측정: 전압=%lu mV, 레벨=%d%%", measured_voltage_mv, measured_battery_level);
        }
        
        // 상태 로그 및 UI 업데이트
        if (do_status_log) {
            ESP_LOGD(TAG, "주소: My=0x%04X, Parent=0x%04X", my_addr, parent_addr);
#if SHOW_SHORT_ADDRESS
            if (!tft_is_lcd_sleeping()) {
                tft_set_short_address_ed(my_addr, parent_addr, pan_id);
            }
#endif
            /* 장기운영 모니터링: heap/stack watermark (5초 주기) */
            {
                size_t free_heap = esp_get_free_heap_size();
                size_t min_free_heap = heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL);
                UBaseType_t stack_hwm = uxTaskGetStackHighWaterMark(NULL);
                ESP_LOGD(TAG, "메모리: heap_free=%lu, heap_min=%lu, stack_hwm=%lu (data_update)",
                         (unsigned long)free_heap, (unsigned long)min_free_heap, (unsigned long)stack_hwm);
            }
        }
        
        // GTT 측정은 인터럽트로 계속 수집되었으므로 calc_drop()으로 계산 가능
        
        // LP Core가 실행 중이면 r_volume_max를 받지 않아도 calc_drop() 호출 (LP Core 데이터 확인용)
        // 서버에서 총량(r_volume_max)을 받았을 때만 측정 시작 (기존 인터럽트 방식)
        bool should_calc_drop = false;
        if (lp_core_is_running()) {
            // LP Core가 실행 중이면 항상 calc_drop() 호출 (LP Core 데이터 확인)
            should_calc_drop = true;
        } else if (storage_is_initial_data_received()) {
            // 기존 인터럽트 방식: r_volume_max를 받았을 때만 측정 시작
            should_calc_drop = true;
        }
        
        if (should_calc_drop) {
            // IR 센서 데이터 계산 (1초마다 실행)
            // calc_drop()은 device_data를 업데이트하고 need_to_update를 반환
            calc_drop();  // 이상 감지 체크는 무시 (항상 1초 주기로 UI 업데이트)
            
            // GTT 변화 감지 (LP Core 데이터 기반)
            float current_gtt = device_data_get_mutable()->gtt;
            
            if (is_first_gtt_measurement) {
                // 첫 측정: 이전 값 저장만 하고 변화 감지 안함
                prev_gtt_value = current_gtt;
                is_first_gtt_measurement = false;
                ESP_LOGD(TAG, "첫 GTT 측정: %.1f (기준값 설정)", current_gtt);
            } else {
                // GTT 변화 감지 (임계값 이상 변화 시 로그)
                (void)check_gtt_change_threshold(prev_gtt_value, current_gtt, GTT_CHANGE_THRESHOLD_PERCENT);
                // 변화 여부와 관계없이 이전 값 업데이트 (다음 비교를 위해)
                prev_gtt_value = current_gtt;
            }
        }
        
        // LED 제어는 Sleep/Wakeup 시에만 수행 (방울 감지 시 깜빡임 제거)
        
        // 백라이트 제어: injection_complete일 때만 켜기 (위에서 처리됨)
        // GTT 변화나 측정 중일 때는 백라이트를 켜지 않음 (Sleep/Wakeup 시 OFF 유지)
        
        // 커패시터 센서 모니터링 (수액 종료 감지)
        // 커패시터 센서 값 로그 출력 (5초 주기)
        static uint64_t last_capacitor_log_time = 0;  /* 49.7일 overflow 방지 */
        if (current_time_ms - last_capacitor_log_time >= CAPACITOR_LOG_INTERVAL_MS) {
            int pin_level = gpio_get_level(CAPACITOR_SENSOR_PIN);
            bool fluid_detected = (pin_level == CAPACITOR_SENSOR_FLUID_DETECTED_LEVEL);
            ESP_LOGD(TAG, "커패시터 센서: GPIO%d=%d, 수액감지=%s", 
                     CAPACITOR_SENSOR_PIN, pin_level, fluid_detected ? "YES" : "NO");
            last_capacitor_log_time = current_time_ms;
        }
        
        // ⚠️ 중요: 연결 상태 주기적 업데이트 (1초마다, 레이스 컨디션 방지: app_globals_lock)
        bool is_joined = esp_zb_bdb_dev_joined();
        if (app_globals_lock()) {
            if (is_joined) {
                if (!zb_network_joined) {
                    zb_network_joined = true;
                }
                tft_set_connection_status(1);
            } else {
                if (zb_network_joined) {
                    zb_network_joined = false;
                }
                tft_set_connection_status(0);
            }
            app_globals_unlock();
        } else {
            tft_set_connection_status(is_joined ? 1 : 0);
        }
        
        // UI 업데이트는 항상 수행 (네트워크 연결 여부와 관계없이 GTT 측정값 표시)
        iringer_update_tft_display_data();
        print_data();
        device_data_unlock();
        /* ════ device_data_lock 범위 끝 ════ */

        /* ════ alarm_authority_update는 반드시 device_data_lock 밖에서 호출 ════
         * 이유: AWAKE_HOLD→ACTIVE 전이 시 do_activate() → sync_lp_gtt_to_device_data()가
         *       device_data_lock()을 재획득하므로, lock 안에서 호출하면 self-deadlock 발생.
         *       (16차에서 발견: 정확히 1000ms 타임아웃 후 mutex timeout 로그 확인됨) */
        static uint64_t last_alarm_check_time = 0;  /* 49.7일 overflow 방지 */
        bool wakeup_for_report = false;
        if (app_globals_lock()) {
            wakeup_for_report = s_wakeup_for_report_only;
            app_globals_unlock();
        }
        if (current_time_ms - last_alarm_check_time >= ALARM_CHECK_INTERVAL_MS) {
            if (!wakeup_for_report) {
                alarm_authority_update();

                /* 디버그 로그 (5초 주기) */
                static uint64_t last_debug_time = 0;
                if (current_time_ms - last_debug_time >= STATUS_LOG_INTERVAL_MS) {
                    lp_core_shared_data_t *dbg = lp_core_get_shared_memory();
                    ESP_LOGD(TAG, "alarm_auth: state=%d, drops_stopped=%d, lp_gtt=%ld, buzzer=%d",
                             alarm_authority_get_state(),
                             dbg ? dbg->drops_stopped : -1,
                             dbg ? dbg->gtt : -1,
                             buzzer_alarm_fluid_end_is_active());
                    last_debug_time = current_time_ms;
                }
            }
            last_alarm_check_time = current_time_ms;
        }
        
        // Time Cluster Read Attributes 재요청 (레이스 컨디션 방지: app_globals_lock)
        bool need_time_request = false;
        if (app_globals_lock()) {
            if (!g_server_time_synced && zb_network_joined) {
                uint64_t current_time_us = esp_timer_get_time();
                if (g_last_time_read_us == 0 || (current_time_us - g_last_time_read_us) >= TIME_CLUSTER_REREQUEST_INTERVAL_US) {
                    need_time_request = true;
                }
            }
            app_globals_unlock();
        }
        if (need_time_request) {
            request_time_from_coordinator();
            ESP_LOGD(TAG, "Time Cluster Read Attributes 재전송 (시간 동기화 대기 중...)");
        }
        
        // ⚠️ 중요: 리포트 전송은 iringer_main_loop()에서만 처리
        // 여기서는 GTT 측정과 LCD 업데이트만 수행 (1초마다)
        
        // ⚠️ 중요: Wake-up 이벤트를 기다리는 루프로 돌아감
        // Sleep 중에는 이 태스크가 대기 상태로 유지되어 Sleep 진입을 방해하지 않음
        // 다음 wake-up 이벤트까지 무한 대기 (위의 xEventGroupWaitBits에서 처리)
        // 1초마다 실행하는 방식 제거 (Sleep 진입 방해 원인)
    }
}

#define REPORT_QUEUE_RECEIVE_TIMEOUT_MS  5000  // 큐 대기 타임아웃 (교착 시 WDT 유도, 영구 블로킹 방지)

// 리포트 전송 태스크 (Zigbee 락 블로킹 방지)
static void report_send_task(void *pvParameters)
{
    report_request_t request;
    ESP_LOGD(TAG, "%s", "리포트 전송 태스크 시작");
    
    while (1) {
        // 큐에서 리포트 전송 요청 대기 (타임아웃 적용으로 영구 블로킹 방지)
        if (xQueueReceive(report_queue, &request, pdMS_TO_TICKS(REPORT_QUEUE_RECEIVE_TIMEOUT_MS)) == pdTRUE) {
            // 리포트 생성 및 Zigbee 전송 (Zigbee 락 블로킹 가능하지만 별도 태스크에서 처리)
            esp_app_iringer_data_handler(request.force_report);
        }
    }
}

static esp_err_t iringer_data_update_task_init(void)
{
    static bool is_inited = false;
    if (!is_inited) {
        // 리포트 전송 요청 큐 생성
        report_queue = xQueueCreate(5, sizeof(report_request_t));
        if (report_queue == NULL) {
            ESP_LOGE(TAG, "%s", "리포트 전송 큐 생성 실패");
            return ESP_FAIL;
        }
        
        // Sleep 진입 대기 이벤트 그룹 생성
        sleep_wait_event_group = xEventGroupCreate();
        if (sleep_wait_event_group == NULL) {
            ESP_LOGE(TAG, "Sleep 대기 이벤트 그룹 생성 실패");
            return ESP_FAIL;
        }
        
        // Zigbee 초기화 전에는 esp_app_iringer_data_init() 호출 안 함
        // (Zigbee lock 사용하므로 Zigbee 스택이 준비된 후에 호출해야 함)
        // 대신 첫 번째 리포트는 Zigbee 시그널 핸들러에서 초기화됨
        
        xTaskCreate(iringer_data_update_task, "iringer_data_update", 5120, NULL, 4, &s_data_update_task_handle);  // 우선순위 4 (GTT 측정 우선)
        xTaskCreate(report_send_task, "report_send", 5120, NULL, 3, NULL);  // 우선순위 3 (Zigbee 태스크와 동일)
        is_inited = true;
    }
    return is_inited ? ESP_OK : ESP_FAIL;
}

// Set Attribute Value 핸들러 (다운링크 수신) - ESP-IDF Zigbee API 사용
// Time Cluster Read Attributes 응답 핸들러
static esp_err_t zb_read_attr_resp_handler(const esp_zb_zcl_cmd_read_attr_resp_message_t *message)
{
    ESP_LOGD(TAG, "zb_read_attr_resp_handler 호출됨");
    
    ESP_RETURN_ON_FALSE(message, ESP_FAIL, TAG, "Empty message");
    
    ESP_LOGD(TAG, "Read attribute response 수신: status=%d, from address(0x%04x) src endpoint(%d) to dst endpoint(%d) cluster(0x%04x)",
             message->info.status, message->info.src_address.u.short_addr, message->info.src_endpoint,
             message->info.dst_endpoint, message->info.cluster);
    
    ESP_RETURN_ON_FALSE(message->info.status == ESP_ZB_ZCL_STATUS_SUCCESS, ESP_ERR_INVALID_ARG, TAG, 
                        "Received message: error status(%d)", message->info.status);
    
    // Time Cluster (0x000A) 응답 처리
    if (message->info.cluster == 0x000A) {
        esp_zb_zcl_read_attr_resp_variable_t *variable = message->variables;
        while (variable) {
            ESP_LOGD(TAG, "Time Cluster 변수: attr_id=0x%04x, status=%d, type=%d", 
                     variable->attribute.id, variable->status, variable->attribute.data.type);
            
            // Time 속성 (0x0000) 처리
            if (variable->attribute.id == 0x0000 && 
                variable->status == ESP_ZB_ZCL_STATUS_SUCCESS) {
                // Time Cluster의 Time 속성은 UTC_TIME 타입 (U32와 동일한 4바이트)
                if (variable->attribute.data.type == ESP_ZB_ZCL_ATTR_TYPE_UTC_TIME || 
                    variable->attribute.data.type == ESP_ZB_ZCL_ATTR_TYPE_U32) {
                    uint32_t time_value = 0;
                    if (variable->attribute.data.value) {
                        time_value = *(uint32_t *)variable->attribute.data.value;
                    }
                    
                    ESP_LOGI(TAG, "Time Cluster Read Attributes 응답: time=%lu (Unix epoch 초, type=%d)", 
                             (unsigned long)time_value, variable->attribute.data.type);
                    
                    if (!app_globals_lock()) {
                        variable = variable->next;
                        continue;
                    }
                    if (g_server_time_synced && g_server_time_base > 0) {
                        ESP_LOGD(TAG, "시간 동기화 이미 완료됨 (server_time_base=%lu) - 응답 무시", 
                                 (unsigned long)g_server_time_base);
                        app_globals_unlock();
                        variable = variable->next;
                        continue;
                    }
                    const uint32_t MIN_VALID_TIME = 1577836800;
                    if (time_value == 0 || time_value < MIN_VALID_TIME) {
                        ESP_LOGW(TAG, "⚠️ 코디네이터 시간 동기화 미완료: time=%lu", (unsigned long)time_value);
                        g_server_time_synced = false;
                        g_last_time_read_us = esp_timer_get_time();
                        app_globals_unlock();
                        return ESP_OK;
                    }
                    uint32_t adjusted_time = time_value + SERVER_TIME_OFFSET_SEC;
                    g_boot_time_us = esp_timer_get_time();
                    g_server_time_base = adjusted_time;
                    g_server_time_synced = true;
                    ESP_LOGI(TAG, "=== Time Cluster로 시간 동기화 완료 === time_value=%lu, adjusted_time=%lu, boot_time_us=%lld",
                             (unsigned long)time_value, (unsigned long)adjusted_time, g_boot_time_us);
                    bool joined = zb_network_joined;
                    if (joined) {
                        should_send_on_wakeup = true;
                        ESP_LOGI(TAG, "시간 동기화 완료: 첫 리포트 즉시 전송");
                    }
                    app_globals_unlock();

                    struct timeval tv = { .tv_sec = (time_t)adjusted_time, .tv_usec = 0 };
                    settimeofday(&tv, NULL);
                } else {
                    ESP_LOGW(TAG, "Time Cluster Time 속성 타입 오류: type=%d (예상: UTCTIME 또는 U32)", 
                             variable->attribute.data.type);
                }
            }
            variable = variable->next;
        }
    }
    
    return ESP_OK;
}

static esp_err_t zb_set_attr_value_handler(const esp_zb_zcl_set_attr_value_message_t *message)
{
    ESP_RETURN_ON_FALSE(message, ESP_FAIL, TAG, "Empty message");
    ESP_RETURN_ON_FALSE(message->info.status == ESP_ZB_ZCL_STATUS_SUCCESS, ESP_ERR_INVALID_ARG, TAG, 
                        "Received message: error status(%d)", message->info.status);
    
    ESP_LOGD(TAG, "Set Attribute Value: endpoint(%d), cluster(0x%x), attribute(0x%x), data size(%zu)",
             message->info.dst_endpoint, message->info.cluster,
             message->attribute.id, message->attribute.data.size);
    
    // IRINGER_DATA cluster의 Set Attribute Value 처리
    if (message->info.cluster == ESP_ZB_ZCL_CLUSTER_ID_IRINGER_DATA &&
        message->attribute.id == ESP_ZB_ZCL_ATTR_IRINGER_DATA_BUNDLE_ID &&
        message->attribute.data.type == ESP_ZB_ZCL_ATTR_TYPE_OCTET_STRING) {
        
        // 다운링크를 받았다는 것은 네트워크에 연결되어 있다는 증거
        // 연결 상태 확인 및 업데이트
        uint16_t short_addr = esp_zb_get_short_address();
        bool is_connected = (short_addr != 0xFFFF && short_addr != 0x0000 && short_addr != 0xFFFE);
        bool is_joined = esp_zb_bdb_dev_joined();
        
        // ⚠️ 중요: 연결 상태 및 첫 다운링크 시점 업데이트 (레이스 컨디션 방지: app_globals_lock)
        if (app_globals_lock()) {
            if (is_connected) {
                if (!zb_network_joined) {
                    storage_inc_reconnect_count();
                    zb_network_joined = true;
                }
                tft_set_connection_status(1);  // 연결 상태 아이콘 업데이트
                ESP_LOGI(TAG, "다운링크 수신: 네트워크 연결 확인 및 연결 상태 아이콘 업데이트 (short_addr: 0x%04x)", short_addr);
            } else {
                ESP_LOGW(TAG, "다운링크 수신했지만 연결 상태 확인 실패 (short_addr: 0x%04x)", short_addr);
            }
            if (is_joined && !first_downlink_time_recorded) {
                first_downlink_time_us = esp_timer_get_time();
                first_downlink_time_recorded = true;
                if (first_downlink_retry_count > 0) {
                    ESP_LOGI(TAG, "첫 다운링크 수신: 재시도 %lu회 후 성공 (%d초 후 슬립 진입 가능)",
                             first_downlink_retry_count, FIRST_DOWNLINK_SLEEP_DELAY_MS / 1000);
                    first_downlink_retry_count = 0;
                } else {
                    ESP_LOGI(TAG, "첫 다운링크 수신: Zigbee 연결 완료 + 첫 다운링크 수신 시간 기록 (%d초 후 슬립 진입 가능)",
                             FIRST_DOWNLINK_SLEEP_DELAY_MS / 1000);
                }
            }
            app_globals_unlock();
        }
        if (!is_joined) {
            ESP_LOGW(TAG, "다운링크 수신했지만 Zigbee 연결 안됨 - 무시");
            return ESP_OK;
        }
        
        uint8_t *raw_data = (uint8_t*)message->attribute.data.value;
        if (raw_data && message->attribute.data.size > 0) {
            uint8_t data_len = raw_data[0];  // 첫 바이트가 길이
            const uint8_t *actual_data = raw_data + 1;  // 실제 데이터
            
            if (data_len > 0 && data_len < message->attribute.data.size) {
                // 바이너리 압축 페이로드 파싱 (10바이트)
                if (data_len == sizeof(ir_downlink_payload_t)) {
                    ir_downlink_payload_t *downlink_payload = (ir_downlink_payload_t *)actual_data;
                    
                    ESP_LOGI(TAG, "Received downlink binary: r_vol=%d, ord_gtt=%d, min_gtt=%d, max_gtt=%d, rest=%d, server_time=%lu",
                             downlink_payload->r_volume_max, downlink_payload->ordered_gtt,
                             downlink_payload->min_gtt, downlink_payload->max_gtt, downlink_payload->rest_minute,
                             (unsigned long)downlink_payload->server_time);

                    /* [DL-RX] 다운링크 중복 원인 판별용 로그 */
                    static uint32_t s_dl_rx_count = 0;
                    s_dl_rx_count++;
                    ESP_LOGW(TAG, "[DL-RX] #%lu server_time=%lu", (unsigned long)s_dl_rx_count, (unsigned long)downlink_payload->server_time);

                    /* 다운링크 경량화: 동일 데이터 반복 시 NVS/calc_drop/LCD 스킵 (이벤트 비트만 설정) */
                    /* 다운링크 디바운싱: 10초 이내 + 데이터 동일(server_time/rest_minute 제외) → 중복 무시 */
                    static ir_downlink_payload_t s_last_downlink = {0};
                    static bool s_has_last_downlink = false;
                    static int64_t s_last_dl_time_us = 0;
                    {
                        int64_t now_us = esp_timer_get_time();
                        bool is_duplicate = false;
                        if (s_has_last_downlink && (now_us - s_last_dl_time_us) < 10000000) {  /* 10초 */
                            ir_downlink_payload_t cmp = *downlink_payload;
                            cmp.server_time = s_last_downlink.server_time;
                            cmp.rest_minute = s_last_downlink.rest_minute;
                            if (memcmp(&cmp, &s_last_downlink, sizeof(ir_downlink_payload_t)) == 0) {
                                is_duplicate = true;
                            }
                        }
                        if (is_duplicate) {
                            ESP_LOGW(TAG, "[DL-RX] 중복 무시 (%.1f초 이내 동일 데이터)",
                                     (float)(now_us - s_last_dl_time_us) / 1000000.0f);
                            if (sleep_wait_event_group != NULL) {
                                xEventGroupSetBits(sleep_wait_event_group, EVENT_BIT_DOWNLINK_RECEIVED);
                            }
                            return ESP_OK;
                        }
                        s_last_dl_time_us = now_us;
                        memcpy(&s_last_downlink, downlink_payload, sizeof(ir_downlink_payload_t));
                        s_has_last_downlink = true;
                    }

                    if (!device_data_lock()) {
                        ESP_LOGW(TAG, "zb_set_attr_value_handler: device_data_lock timeout, skip downlink");
                        return ESP_OK;
                    }
                    // r_volume_max 파싱 및 저장
                    bool is_first_receive = !storage_is_initial_data_received();
                    
                    // 서버에서 총 수액량 수신: r_volume_max 업데이트
                    device_data_get_mutable()->r_volume_max = (float)downlink_payload->r_volume_max;
                    
                    // LP Core 공유 메모리에 총 수액량 업데이트 (수액 투입률 계산 및 수액 종료 판정용)
                    lp_core_set_r_volume_max(device_data_get_mutable()->r_volume_max);
                    
                    if (is_first_receive) {
                    // 처음 데이터 수신: LP Core 방울 카운터 리셋 및 측정 시작
                    // lp_core_request_drop_reset 사용 (HP 직접 쓰기 대신 LP가 처리, 레이스 방지)
                    lp_core_request_drop_reset();
                    ESP_LOGD(TAG, "서버에서 총량 수신: LP Core 방울 카운터 리셋 및 측정 시작 (r_volume_max=%d ml)",
                             downlink_payload->r_volume_max);

                        // 현재까지 주입된 양은 0으로 초기화 (리셋 후이므로)
                        device_data_get_mutable()->injected_amount = 0.0f;
                        
                        // 처음 수신 시에만 현재 수액량 초기화
                        device_data_get_mutable()->r_volume_now = device_data_get_mutable()->r_volume_max;
                        
                        storage_set_total_ml(downlink_payload->r_volume_max);  // NVS에 저장
                        storage_set_initial_data_received();  // 초기 데이터 수신 플래그 설정
                        ESP_LOGI(TAG, "%s r_volume_max=%d ml, injected_amount=%.1f ml, r_volume_now=%.1f ml (초기화 및 측정 시작)",
                                 "처음 데이터 수신:", downlink_payload->r_volume_max, 
                                 device_data_get_mutable()->injected_amount, device_data_get_mutable()->r_volume_now);
                                 
                                 
                    } else {
                        // 이후 수신: r_volume_max만 업데이트, r_volume_now는 calc_drop()에서 계속 업데이트됨
                        ESP_LOGI(TAG, "%s r_volume_max=%d ml (r_volume_now=%.1f ml, calc_drop()에서 계속 업데이트)",
                                 "다운링크 수신:", downlink_payload->r_volume_max, device_data_get_mutable()->r_volume_now);
                    }
                    
                    // ordered_gtt, min_gtt, max_gtt 파싱 (0.01 단위에서 float로 변환)
                    device_data_get_mutable()->ordered_gtt = (float)downlink_payload->ordered_gtt / 100.0f;
                    device_data_get_mutable()->min_gtt = (float)downlink_payload->min_gtt / 100.0f;
                    device_data_get_mutable()->max_gtt = (float)downlink_payload->max_gtt / 100.0f;
                    // rest_minute는 다운링크로 받지 않고 기기에서 계산
                    // (Arduino 코드와 동일: rest_min = r_volume_now / ml_per_hour * 60)
                    // 다운링크의 rest_minute는 무시하고 기기에서 계산한 값을 사용
                    
                    ESP_LOGI(TAG, "%s %.2f", "ordered_gtt 업데이트:", device_data_get_mutable()->ordered_gtt);
                    ESP_LOGI(TAG, "%s %.2f", "min_gtt 업데이트:", device_data_get_mutable()->min_gtt);
                    ESP_LOGD(TAG, "%s %.2f", "max_gtt 업데이트:", device_data_get_mutable()->max_gtt);
                    ESP_LOGD(TAG, "%s", "rest_minute는 기기에서 계산 (다운링크 무시)");
                    
                    // ⚠️ 중요: 다운링크 수신 후 GTT 계산 및 LCD 업데이트
                    // calc_drop()을 호출하여 최신 GTT 값을 계산한 후 LCD 업데이트
                    calc_drop();  // GTT 등 최신 데이터 계산
                    ESP_LOGI(TAG, "다운링크 수신 후 calc_drop() 호출 완료 (GTT=%.1f)", device_data_get_mutable()->gtt);
                    ESP_LOGI(TAG, "다운링크 수신 후 calc_drop() 호출 완료 (cchr=%.1f)", device_data_get_mutable()->ordered_gtt);
                    
                    /* LCD sleeping이면 TFT 업데이트 스킵 (fail_count 증가 방지) */
                    if (!tft_is_lcd_sleeping()) {
                        iringer_update_tft_display_data();
                        ESP_LOGI(TAG, "다운링크 수신 후 LCD 업데이트 완료 (연결 상태 및 GTT=%.1f 등)", device_data_get_mutable()->gtt);
                    }
                    device_data_unlock();
                    
                    // 다운링크 수신 완료 이벤트 설정 (Sleep 진입 대기용)
                    s_last_successful_downlink_time_us = esp_timer_get_time();
                    if (sleep_wait_event_group != NULL) {
                        xEventGroupSetBits(sleep_wait_event_group, EVENT_BIT_DOWNLINK_RECEIVED);
                        ESP_LOGD(TAG, "다운링크 수신 완료: Sleep 대기 이벤트 설정");
                    }
                    
                    // v2.0 방식: 다운링크 처리 후 리포트 재전송하지 않음
                    // 다운링크 처리 후 리포트를 재전송하면 Gateway가 first_downlink_received 플래그로
                    // 서버 응답을 무시하여 다운링크를 보내지 않게 됨
                    // 따라서 다운링크 처리 후에는 리포트를 재전송하지 않고, 정기 리포트 주기에 따라 전송됨
                } else {
                    ESP_LOGW(TAG, "Invalid downlink payload size: %d (expected %zu)", 
                             data_len, sizeof(ir_downlink_payload_t));
                }
            }
        }
    }
    
    return ESP_OK;
}

// Zigbee Action 핸들러
static esp_err_t zb_action_handler(esp_zb_core_action_callback_id_t callback_id, const void *message)
{
    esp_err_t ret = ESP_OK;
    switch (callback_id) {
    case ESP_ZB_CORE_SET_ATTR_VALUE_CB_ID:
        ESP_LOGD(TAG, "ESP_ZB_CORE_SET_ATTR_VALUE_CB_ID received");
        ret = zb_set_attr_value_handler((esp_zb_zcl_set_attr_value_message_t *)message);
        break;
    case ESP_ZB_CORE_CMD_READ_ATTR_RESP_CB_ID:
        ESP_LOGD(TAG, "ESP_ZB_CORE_CMD_READ_ATTR_RESP_CB_ID received (Time Cluster 응답)");
        ret = zb_read_attr_resp_handler((esp_zb_zcl_cmd_read_attr_resp_message_t *)message);
        break;
    default:
        ESP_LOGD(TAG, "Receive Zigbee action(0x%x) callback", callback_id);
        break;
    }
    return ret;
}

/* APS data confirm no-op (리포트 TX는 딜레이 기반, SDK 등록 요구사항 충족) */
static void aps_data_confirm_noop(esp_zb_apsde_data_confirm_t confirm)
{
    (void)confirm;
}

static void bdb_start_top_level_commissioning_cb(uint8_t mode_mask)
{
    ESP_RETURN_ON_FALSE(esp_zb_bdb_start_top_level_commissioning(mode_mask) == ESP_OK, ,
                        TAG, "Failed to start Zigbee bdb commissioning");
}

#if IRINGER_ED_JOIN_SPECIFIC_PAN_ENABLE
static void ed_scan_retry_cb(uint8_t param, uint32_t time);

static void ed_scan_complete_cb(esp_zb_zdp_status_t zdo_status, uint8_t count,
                                esp_zb_network_descriptor_t *nwk_descriptor)
{
    if (zdo_status != ESP_ZB_ZDP_STATUS_SUCCESS || nwk_descriptor == NULL) {
        ESP_LOGW(TAG, "스캔 실패 또는 결과 없음 (status=%d), %d ms 후 스캔 재시도", (int)zdo_status,
                 (int)IRINGER_ED_SCAN_RETRY_DELAY_MS);
        esp_zb_scheduler_alarm((esp_zb_callback_t)ed_scan_retry_cb, 0,
                               IRINGER_ED_SCAN_RETRY_DELAY_MS);
        return;
    }
    /* 스캔된 PAN ID 목록 로그 출력 */
    ESP_LOGI(TAG, "스캔된 네트워크 %d개:", (int)count);
    for (uint8_t i = 0; i < count; i++) {
        ESP_LOGI(TAG, "  [%d] PAN ID: 0x%04x, EPID: %02x:%02x:%02x:%02x:%02x:%02x:%02x:%02x",
                 (int)i, (unsigned)nwk_descriptor[i].short_pan_id,
                 nwk_descriptor[i].extended_pan_id[0], nwk_descriptor[i].extended_pan_id[1],
                 nwk_descriptor[i].extended_pan_id[2], nwk_descriptor[i].extended_pan_id[3],
                 nwk_descriptor[i].extended_pan_id[4], nwk_descriptor[i].extended_pan_id[5],
                 nwk_descriptor[i].extended_pan_id[6], nwk_descriptor[i].extended_pan_id[7]);
    }
    for (uint8_t i = 0; i < count; i++) {
        if (nwk_descriptor[i].short_pan_id == IRINGER_ED_TARGET_PAN_ID) {
            esp_zb_set_extended_pan_id(nwk_descriptor[i].extended_pan_id);
            ESP_LOGI(TAG, "목표 PAN ID(0x%04x) 발견, 스티어링 시작", (unsigned)IRINGER_ED_TARGET_PAN_ID);
            esp_zb_bdb_start_top_level_commissioning(ESP_ZB_BDB_MODE_NETWORK_STEERING);
            return;
        }
    }
    ESP_LOGI(TAG, "목표 PAN 미발견, %d ms 후 스캔 재시도", (int)IRINGER_ED_SCAN_RETRY_DELAY_MS);
    esp_zb_scheduler_alarm((esp_zb_callback_t)ed_scan_retry_cb, 0,
                           IRINGER_ED_SCAN_RETRY_DELAY_MS);
}

static void ed_scan_retry_cb(uint8_t param, uint32_t time)
{
    (void)param;
    (void)time;
    /* 이미 조인된 상태에서 active scan 호출 시 Zigbee 스택 assertion 발생 방지.
     * BDB Reboot 실패 시 short_addr는 NVRAM에 남아 있지만 esp_zb_bdb_dev_joined()는 false.
     * BDB joined를 기준으로 판단해야 교착 상태 방지. */
    bool bdb_joined = esp_zb_bdb_dev_joined();
    if (bdb_joined) {
        uint16_t short_addr = esp_zb_get_short_address();
        if (short_addr != 0xFFFF && short_addr != 0x0000 && short_addr != 0xFFFE) {
            ESP_LOGI(TAG, "이미 네트워크 조인됨 (short_addr: 0x%04x) - 스캔 스킵", (unsigned)short_addr);
            s_steering_retry_count = 0;
            return;
        }
    }
    uint32_t channel_mask = esp_zb_get_primary_network_channel_set();
    esp_zb_zdo_active_scan_request(channel_mask, 5, ed_scan_complete_cb);
    ESP_LOGI(TAG, "네트워크 스캔 시작 (목표 PAN: 0x%04x)", (unsigned)IRINGER_ED_TARGET_PAN_ID);
}
#endif

void esp_zb_app_signal_handler(esp_zb_app_signal_t *signal_struct)
{
    uint32_t *p_sg_p     = signal_struct->p_app_signal;
    esp_err_t err_status = signal_struct->esp_err_status;
    esp_zb_app_signal_type_t sig_type = *p_sg_p;
    
    // 모든 신호에 대해 로그 출력 (디버깅용)
    // ESP_LOGI(TAG, "Signal type: %s %d", esp_zb_zdo_signal_to_string(sig_type), sig_type);
    
    switch (sig_type) {
    case ESP_ZB_ZDO_SIGNAL_SKIP_STARTUP:
        ESP_LOGI(TAG, "Initialize Zigbee stack");
        esp_zb_bdb_start_top_level_commissioning(ESP_ZB_BDB_MODE_INITIALIZATION);
        break;
    case ESP_ZB_BDB_SIGNAL_DEVICE_FIRST_START:
    case ESP_ZB_BDB_SIGNAL_DEVICE_REBOOT:
        if (err_status == ESP_OK) {
            // 데이터 업데이트 태스크는 이미 app_main()에서 시작됨
            // 여기서는 Zigbee 초기 리포트만 설정
            esp_app_iringer_data_init();
            ESP_LOGI(TAG, "Zigbee initial report setup completed");
            
            ESP_LOGI(TAG, "Device started up in%s factory-reset mode", 
                     esp_zb_bdb_is_factory_new() ? "" : " non");
            if (esp_zb_bdb_is_factory_new()) {
#if IRINGER_ED_JOIN_SPECIFIC_PAN_ENABLE
                ESP_LOGI(TAG, "목표 PAN(0x%04x) 검색을 위해 네트워크 스캔 시작", (unsigned)IRINGER_ED_TARGET_PAN_ID);
                ed_scan_retry_cb(0, 0);
#else
                ESP_LOGI(TAG, "Start network steering");
                esp_zb_bdb_start_top_level_commissioning(ESP_ZB_BDB_MODE_NETWORK_STEERING);
#endif
            } else {
                ESP_LOGI(TAG, "Device rebooted");
#if IRINGER_ED_JOIN_SPECIFIC_PAN_ENABLE
                uint16_t current_pan = esp_zb_get_pan_id();
                if (current_pan != IRINGER_ED_TARGET_PAN_ID) {
                    ESP_LOGI(TAG, "저장된 네트워크 PAN(0x%04x)이 목표(0x%04x)와 다름, Leave 후 스캔 시작",
                             (unsigned)current_pan, (unsigned)IRINGER_ED_TARGET_PAN_ID);
                    if (app_globals_lock()) { zb_network_joined = false; app_globals_unlock(); }
                    tft_set_connection_status(0);
                    esp_zb_bdb_reset_via_local_action();
                    break;
                }
#endif
                // 재부팅 시 네트워크 연결 상태 확인
                uint16_t short_addr = esp_zb_get_short_address();
                bool is_connected = (short_addr != 0xFFFF && short_addr != 0x0000 && short_addr != 0xFFFE);
                
                if (is_connected) {
                    storage_inc_reconnect_count();
                    if (app_globals_lock()) { zb_network_joined = true; app_globals_unlock(); }
                    tft_set_connection_status(1);
                    ESP_LOGI(TAG, "재부팅: 네트워크 연결 확인 (short_addr: 0x%04x)", short_addr);
                    request_time_from_coordinator();
                    ESP_LOGI(TAG, "재부팅: 리포트 설정 재적용 완료, Time Cluster Read Attributes 전송 (시간 동기화 대기 중)");
                } else {
                    if (app_globals_lock()) { zb_network_joined = false; app_globals_unlock(); }
                    tft_set_connection_status(0);
                    ESP_LOGI(TAG, "재부팅: 네트워크 미연결 (short_addr: 0x%04x) - 새로 조인 시작", short_addr);
#if IRINGER_ED_JOIN_SPECIFIC_PAN_ENABLE
                    ed_scan_retry_cb(0, 0);
#else
                    esp_zb_bdb_start_top_level_commissioning(ESP_ZB_BDB_MODE_NETWORK_STEERING);
#endif
                }
            }
        } else {
            ESP_LOGW(TAG, "%s failed with status: %s, 네트워크 조인 시도",
                     esp_zb_zdo_signal_to_string(sig_type), esp_err_to_name(err_status));
            if (app_globals_lock()) { zb_network_joined = false; app_globals_unlock(); }
            tft_set_connection_status(0);
#if IRINGER_ED_JOIN_SPECIFIC_PAN_ENABLE
            ESP_LOGI(TAG, "BDB Device Reboot 실패 - exponential backoff 후 스캔 재시도");
            uint32_t delay_ms = get_reconnect_backoff_ms();
            s_steering_retry_count++;
            ESP_LOGI(TAG, "BDB Reboot 실패, %lu ms 후 스캔 재시도 (retry %lu)",
                     (unsigned long)delay_ms, (unsigned long)s_steering_retry_count);
            esp_zb_scheduler_alarm((esp_zb_callback_t)ed_scan_retry_cb, 0, delay_ms);
#else
            ESP_LOGI(TAG, "BDB Device Reboot 실패 - exponential backoff 후 네트워크 조인 재시도");
            uint32_t delay_ms = get_reconnect_backoff_ms();
            s_steering_retry_count++;
            ESP_LOGI(TAG, "BDB Reboot 실패, %lu ms 후 스티어링 재시도 (retry %lu)",
                     (unsigned long)delay_ms, (unsigned long)s_steering_retry_count);
            esp_zb_scheduler_alarm((esp_zb_callback_t)bdb_start_top_level_commissioning_cb,
                                   ESP_ZB_BDB_MODE_NETWORK_STEERING, delay_ms);
#endif
        }
        break;
    case ESP_ZB_BDB_SIGNAL_STEERING:
        if (err_status == ESP_OK) {

            esp_zb_ieee_addr_t extended_pan_id;
            esp_zb_get_extended_pan_id(extended_pan_id);
            ESP_LOGI(TAG, "✅ Joined network successfully (Extended PAN ID: %02x:%02x:%02x:%02x:%02x:%02x:%02x:%02x, PAN ID: 0x%04hx, Channel:%d, Short Address: 0x%04hx)",
                     extended_pan_id[7], extended_pan_id[6], extended_pan_id[5], extended_pan_id[4],
                     extended_pan_id[3], extended_pan_id[2], extended_pan_id[1], extended_pan_id[0],
                     esp_zb_get_pan_id(), esp_zb_get_current_channel(), esp_zb_get_short_address());
            // TFT 연결 상태 업데이트 (Zigbee 연결됨), reconnect_count 증가, Self-healing retry 리셋
            s_steering_retry_count = 0;
            storage_inc_reconnect_count();
            if (app_globals_lock()) { zb_network_joined = true; app_globals_unlock(); }
            tft_set_connection_status(1);
            ESP_LOGI(TAG, "%s", "Zigbee 네트워크 연결 완료: 정기 리포트 전송 시작");
            request_time_from_coordinator();
            ESP_LOGI(TAG, "네트워크 조인: Time Cluster Read Attributes 전송 (시간 동기화 대기 중)");
            bool send_on_wakeup = false;
            if (app_globals_lock()) { send_on_wakeup = should_send_on_wakeup; app_globals_unlock(); }
            if (send_on_wakeup) {
                ESP_LOGI(TAG, "LP Core wakeup 재조인 완료: 리포트 전송 시작");
                // 리포트 전송 요청 큐에 추가
                if (report_queue != NULL) {
                    report_request_t request = {
                        .force_report = false
                    };
                    if (xQueueSend(report_queue, &request, pdMS_TO_TICKS(1000)) != pdTRUE) {
                        ESP_LOGW(TAG, "리포트 전송 요청 큐 전송 실패");
                    }
                }
            }
            
            // 리포트 설정 재적용 제거 (태스크 딜레이 방식으로 직접 전송하므로 불필요)
        } else {
            ESP_LOGI(TAG, "Network steering was not successful (status: %s)", esp_err_to_name(err_status));
#if IRINGER_ED_JOIN_SPECIFIC_PAN_ENABLE
            uint32_t delay_ms = get_reconnect_backoff_ms();
            s_steering_retry_count++;
            ESP_LOGI(TAG, "스티어링 실패, %lu ms 후 스캔부터 재시도 (retry %lu)", (unsigned long)delay_ms, (unsigned long)s_steering_retry_count);
            esp_zb_scheduler_alarm((esp_zb_callback_t)ed_scan_retry_cb, 0, delay_ms);
#else
            uint32_t delay_ms = get_reconnect_backoff_ms();
            s_steering_retry_count++;
            ESP_LOGI(TAG, "스티어링 실패, %lu ms 후 재시도 (retry %lu)", (unsigned long)delay_ms, (unsigned long)s_steering_retry_count);
            esp_zb_scheduler_alarm((esp_zb_callback_t)bdb_start_top_level_commissioning_cb,
                                   ESP_ZB_BDB_MODE_NETWORK_STEERING, delay_ms);
#endif
            if (app_globals_lock()) { zb_network_joined = false; app_globals_unlock(); }
            tft_set_connection_status(0);
        }
        break;
    case ESP_ZB_COMMON_SIGNAL_CAN_SLEEP:
    {
        /* CAN_SLEEP 카운터 (디버깅용) */
        static uint32_t s_can_sleep_count = 0;
        s_can_sleep_count++;

        alive_marker_set_location(MARKER_LOC_CAN_SLEEP_HANDLER_ENTER);
        alive_marker_inc_can_sleep_count();

        /* ── Zigbee Light Sleep 정석 구현 ──
        * 스택이 "지금 할 일 없다"고 판단했을 때만 이 시그널이 온다.
        * 조건을 충족하면 esp_zb_sleep_now()로 sleep 진입.
        * 조건 미충족 시 호출 안 하면 "정중한 거절" — 스택이 나중에 다시 시그널 보냄. */

        /* 조건 0: 네트워크 미조인 시 잠들지 않음 (스캔/조인 중 sleep 방지) */
        if (!esp_zb_bdb_dev_joined()) {
            ESP_LOGD(TAG, "CAN_SLEEP: 네트워크 미조인 — sleep 거절 (스캔/조인 진행)");
            break;
        }

        /* 조건 1: 첫 다운링크를 아직 수신하지 않았으면 잠들지 않음 (LCD ON 유지) */
        uint64_t elapsed_ms_since_dl = get_elapsed_ms_since_first_downlink();
        if (elapsed_ms_since_dl == UINT64_MAX) {
            ESP_LOGD(TAG, "CAN_SLEEP: 첫 다운링크 미수신 — sleep 거절 (LCD ON 유지)");
            break;
        }

        /* 조건 2: 첫 다운링크 수신 후 LCD_SLEEP_DELAY_MS 미경과 시 잠들지 않음 */
        if (elapsed_ms_since_dl < (uint64_t)FIRST_DOWNLINK_SLEEP_DELAY_MS) {
            ESP_LOGD(TAG, "CAN_SLEEP: LCD 대기 시간 미경과 (%llu ms) — sleep 거절",
                    (unsigned long long)elapsed_ms_since_dl);
            break;
        }

        /* 조건 3: alarm_authority가 ACTIVE면 잠들지 않음 */
#if !DISABLE_ALARM_FOR_BATTERY_TEST
        if (alarm_authority_is_active()) {
            ESP_LOGD(TAG, "CAN_SLEEP: alarm_authority ACTIVE — sleep 거절");
            break;
        }
#endif

        /* 조건 4: 부모 연결 건강성 — 리포트 주기 3배(90초) 이상 다운링크 없으면 sleep 거절
         * 코디 다운 시 sleep 중 rejoin 시도 → 스택 상태 꼬임 방지 */
        if (s_last_successful_downlink_time_us > 0) {
            int64_t since_last_dl_us = esp_timer_get_time() - s_last_successful_downlink_time_us;
            if (since_last_dl_us > (int64_t)REPORT_INTERVAL_US * 3) {
                /* watchdog vTaskResume 제거 — CAN_SLEEP에서 suspend 안 하므로 불필요 */
                /* 로그 스팸 방지: 30초에 한 번만 출력 */
                static int64_t s_last_cond4_log_us = 0;
                int64_t now_cond4 = esp_timer_get_time();
                if (now_cond4 - s_last_cond4_log_us > 30000000LL) {
                    ESP_LOGW(TAG, "CAN_SLEEP 거절: 마지막 다운링크 후 %lld초 경과 (부모 연결 불안정 추정)",
                             since_last_dl_us / 1000000LL);
                    s_last_cond4_log_us = now_cond4;
                }
                break;
            }
        }

#if LCD_SLEEP_WAKE_STRESS_TEST
        /* STRESS TEST: LCD on/off는 lcd_sleep_timer가 자체적으로 사이클을 돌리고 있음.
         * 여기서 LCD OFF + ui_task suspend를 하면 stress test의 자동 wake 메커니즘
         * (stress_test_schedule_wake)이 호출되지 않아 LCD가 영영 OFF stuck됨.
         * → sleep prep 자체를 스킵. 어차피 아래 esp_zb_sleep_now()도 가드로 막혀 있음. */
        {
            static int64_t s_last_stress_skip_log_us = 0;
            int64_t now_skip = esp_timer_get_time();
            if (now_skip - s_last_stress_skip_log_us > 30000000LL) {
                ESP_LOGW(TAG, "STRESS TEST: CAN_SLEEP sleep prep 스킵 (LCD/task 보존)");
                s_last_stress_skip_log_us = now_skip;
            }
            break;
        }
#endif

        /* 모든 조건 충족 — Sleep 진입 */
        /* LCD OFF (이미 꺼져있으면 스킵 — suspend된 UI태스크 타임아웃 5초 방지) */
        if (!tft_is_lcd_sleeping()) {
            tft_lcd_off_and_wait(TFT_LCD_OFF_WAIT_MS);
        }

        /* 모든 조건 충족 — Sleep 진입 */
        /* LCD OFF (이미 꺼져있으면 스킵 — suspend된 UI태스크 타임아웃 5초 방지) */
        if (!tft_is_lcd_sleeping()) {
            tft_lcd_off_and_wait(TFT_LCD_OFF_WAIT_MS);
        }

        /* ★ 더미 타이머 정지 (1ms wakeup source 제거 → 진짜 sleep) */
        if (dummy_timer_handle)        esp_timer_stop(dummy_timer_handle);
        if (dummy_drop_timer_handle)   esp_timer_stop(dummy_drop_timer_handle);
        if (dummy_sample_timer_handle) esp_timer_stop(dummy_sample_timer_handle);

        /* vTaskSuspend 제거 — Light Sleep은 CPU 자체를 파워다운하므로 태스크 강제 suspend
         * 불필요. suspend 시 lock 쥔 태스크가 얼어붙어 데드락(벽돌) 유발하던 원인 차단. */

        /* LP Core에 sleep 정보 전달 */
        lp_core_shared_data_t *shared_sleep = lp_core_get_shared_memory();
        if (shared_sleep) {
            shared_sleep->report_interval_us = REPORT_INTERVAL_US;
            shared_sleep->reset_wakeup_timer = true;
        }

        /* ── wakeup source 정리 (이전 호출의 잔여 신호 클리어) ── */
        esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);

        /* 필요한 wakeup source만 재등록 — [SLEEPDBG] 실패 여부 체크 */
        {
            esp_err_t tw_ret = esp_sleep_enable_timer_wakeup(REPORT_INTERVAL_US);
            if (tw_ret != ESP_OK) {
                ESP_LOGE(TAG, "[SLEEPDBG] enable_timer_wakeup 실패: %s", esp_err_to_name(tw_ret));
            }
            esp_err_t uw_ret = esp_sleep_enable_ulp_wakeup();
            if (uw_ret != ESP_OK) {
                ESP_LOGE(TAG, "[SLEEPDBG] enable_ulp_wakeup 실패: %s", esp_err_to_name(uw_ret));
            }
        }

#if SLEEP_WAKE_LOGGING
        if (s_swlog_pm_dump_count < SWLOG_PM_DUMP_MAX) {
            ESP_LOGW(TAG, "=== PM Lock 상태 (#%lu, sleep 직전) ===",
                     (unsigned long)s_swlog_pm_dump_count);
            esp_pm_dump_locks(stdout);
            s_swlog_pm_dump_count++;
        }
        s_swlog_sleep_start_us = esp_timer_get_time();
#endif

#if LCD_SLEEP_WAKE_STRESS_TEST
        ESP_LOGD(TAG, "STRESS TEST: sleep 호출 생략");
        break;
#else
        {
            static uint32_t s_sleep_cycle = 0;
            s_sleep_cycle++;

            alive_marker_set_location(MARKER_LOC_CAN_SLEEP_BEFORE_SLEEP_NOW);
            alive_marker_inc_sleep_now_enter();

            ESP_LOGW(TAG, "[SLEEPDBG] #%lu → esp_zb_sleep_now() 진입 (heap=%lu, lcd_sleeping=%d)",
                     (unsigned long)s_sleep_cycle,
                     (unsigned long)esp_get_free_heap_size(),
                     tft_is_lcd_sleeping() ? 1 : 0);
#if IRINGER_SLEEP_ROM_TRACE
            esp_rom_printf("\n[ROM] sleep_now ENTER #%u\n", (unsigned)s_sleep_cycle);
#endif
            esp_zb_sleep_now();
#if IRINGER_SLEEP_ROM_TRACE
            esp_rom_printf("[ROM] sleep_now EXIT  #%u cause=%d\n",
                           (unsigned)s_sleep_cycle,
                           (int)esp_sleep_get_wakeup_cause());
#endif
            alive_marker_set_location(MARKER_LOC_CAN_SLEEP_AFTER_SLEEP_NOW);
            alive_marker_inc_sleep_now_exit();

            ESP_LOGW(TAG, "[SLEEPDBG] #%lu ← esp_zb_sleep_now() 리턴 cause=%d heap=%lu",
                     (unsigned long)s_sleep_cycle,
                     (int)esp_sleep_get_wakeup_cause(),
                     (unsigned long)esp_get_free_heap_size());
        }
#endif

        /* ── Wake-up 후 처리 (esp_zb_sleep_now()에서 리턴) ── */
        /* 전략1: Zigbee 폴링 wake에서는 최소한만 수행.
         * 타이머/태스크 resume은 리포트 전송 시점(iringer_main_loop)에서 수행. */

#if SLEEP_WAKE_LOGGING
        swlog_record(esp_sleep_get_wakeup_cause());
#endif

        /* LCD 슬립 중이면 백라이트만 재고정.
         * SPI 핀(CS/DC/RST/MOSI/SCLK) 재고정 블록은 의도적으로 삭제:
         * 이 블록이 실행되는 esp_zb_task가 ui_task의 tft_display_on_impl과 타이밍 겹치면
         * ui_task가 방금 풀어놓은 GPIO hold를 여기서 다시 걸어 race → warm init이 SPI를
         * 쏘아도 실제 핀 출력 변화 없음 → ST7735 default 상태 유지 → 하얀 화면.
         * hold_en은 RTC 도메인 latch라 sleep 중 이미 유지되므로 wake 후 재설정 불필요. */
        if (tft_is_lcd_sleeping()) {
            tft_backlight_assert_off_after_wake();
        }

        /* LP Core 비상 체크: cause 관계없이 플래그 확인 */
        int wake_cause = esp_sleep_get_wakeup_cause();
        lp_core_shared_data_t *shared_wake = lp_core_get_shared_memory();
        if (shared_wake) {
            ESP_LOGW(TAG, "WAKE cause=%d gtt_chg=%d alert=%d inj_evt=%d gtt=%ld ds=%d",
                     wake_cause,
                     shared_wake->gtt_change_detected,
                     shared_wake->alert_detected,
                     shared_wake->injection_complete_event,
                     shared_wake->gtt,
                     shared_wake->drops_stopped);
#if !DISABLE_ALARM_FOR_BATTERY_TEST
            if (shared_wake->gtt_change_detected ||
                shared_wake->alert_detected ||
                shared_wake->injection_complete_event) {
                ESP_LOGI(TAG, "CAN_SLEEP wake: LP Core 비상 감지 (cause=%d) — 즉시 리포트 트리거", wake_cause);
                shared_wake->gtt_change_detected = false;
                shared_wake->alert_detected = false;
                shared_wake->injection_complete_event = false;
                if (sleep_wait_event_group != NULL) {
                    xEventGroupSetBits(sleep_wait_event_group, EVENT_BIT_EMERGENCY_REPORT);
                }
            }
#else
            /* 배터리 테스트 모드: 플래그만 소비하고 비상 리포트 안 함 (추가 라디오 TX 방지) */
            shared_wake->gtt_change_detected = false;
            shared_wake->alert_detected = false;
            shared_wake->injection_complete_event = false;
#endif
        }

        ESP_LOGD(TAG, "CAN_SLEEP: wake-up 완료 (cause=%d)", wake_cause);
        alive_marker_set_location(MARKER_LOC_CAN_SLEEP_HANDLER_EXIT);
        break;
    }
    case ESP_ZB_ZDO_SIGNAL_DEVICE_UPDATE:
        ESP_LOGW(TAG, "DEVICE_UPDATE: status=%s, short=0x%04x, joined=%d",
                 esp_err_to_name(err_status), esp_zb_get_short_address(), esp_zb_bdb_dev_joined());
        if (err_status == ESP_OK) {
            // 실제 네트워크 연결 상태 확인 (항상 확인하여 상태 동기화)
            // 0xfffe는 임시 주소로 실제 연결 안됨 상태를 나타냄
            uint16_t short_addr = esp_zb_get_short_address();
            bool is_connected = (short_addr != 0xFFFF && short_addr != 0x0000 && short_addr != 0xFFFE);
            
            // Phase 6: LQI 기반 신호 강도 업데이트
            uint8_t lqi = 0;
            if (is_connected) {
                esp_zb_nwk_info_iterator_t iterator = {0};
                esp_zb_nwk_neighbor_info_t neighbor;
                while (true) {
                    esp_err_t err = esp_zb_nwk_get_next_neighbor(&iterator, &neighbor);
                    if (err == ESP_ERR_NOT_FOUND) {
                        break;
                    } else if (err != ESP_OK) {
                        break;
                    }
                    // Parent 또는 Coordinator 찾기
                    if (neighbor.relationship == ESP_ZB_NWK_RELATIONSHIP_PARENT || 
                        neighbor.device_type == 0) {  // Coordinator
                        lqi = neighbor.lqi;
                        break;
                    }
                }
            }
            
            // 신호 세기 표시 제거: 연결 여부만 표시 (연결 시 풀바, 미연결 시 0)
            uint8_t signal_level = is_connected ? 4 : 0;
            tft_set_signal_strength(signal_level);
            
            if (app_globals_lock()) {
                if (is_connected != zb_network_joined) {
                    if (is_connected) storage_inc_reconnect_count();
                    zb_network_joined = is_connected;
                    tft_set_connection_status(is_connected ? 1 : 0);
                    ESP_LOGI(TAG, "Device update: 네트워크 연결 상태 업데이트 (short_addr: 0x%04x, LQI: %d, signal: %d, connected: %s)", 
                             short_addr, lqi, signal_level, is_connected ? "true" : "false");
                } else if (is_connected) {
                    zb_network_joined = true;
                    tft_set_connection_status(1);
                }
                app_globals_unlock();
            }
        }
        ESP_LOGD(TAG, "ZDO signal: %s (0x%x), status: %s", 
                 esp_zb_zdo_signal_to_string(sig_type), sig_type, esp_err_to_name(err_status));
        break;
    case ESP_ZB_NLME_STATUS_INDICATION:  // 0x32: 네트워크 계층 상태 알림 (정상 동작 중 자주 발생)
        // NLME Status Indication은 정상적인 네트워크 동작 중 자주 발생하는 메시지이므로
        // 로그 출력 안함 (너무 자주 발생)
        break;
    default:
        ESP_LOGD(TAG, "ZDO signal: %s (0x%x), status: %s", 
                 esp_zb_zdo_signal_to_string(sig_type), sig_type, esp_err_to_name(err_status));
        break;
    }
}

// ⚠️ 중요: Task watchdog 에러 방지를 위한 yield 태스크
// ir_sensor 코드 제거로 인해 우선순위 1 태스크들이 없어져서 IDLE 태스크가 CPU 시간을 받지 못할 수 있음
// 주기적으로 taskYIELD()를 호출하는 태스크를 추가하여 IDLE 태스크가 CPU 시간을 받도록 함
// esp_task_wdt_add: 이 태스크를 TWDT에 등록, 100ms마다 esp_task_wdt_reset으로 feed → 교착 시 15초 내 리셋
static void watchdog_yield_task(void* arg) {
    esp_err_t err = esp_task_wdt_add(NULL);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Task WDT 등록 실패: %s (yield만 수행)", esp_err_to_name(err));
    }
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(100));
        taskYIELD();
        if (err == ESP_OK) {
            esp_task_wdt_reset();
        }
    }
}

// ⚠️ 중요: copy 버전과 유사한 환경 만들기 - 더미 esp_timer 콜백
// ir_sensor_init()이 생성하던 esp_timer 3개와 유사한 역할
// copy 버전: timer_callback(1ms), drop_timer_callback(1ms), ir_sensor_sample_callback(2ms)
static volatile uint32_t dummy_tmr = 0;  // copy 버전의 tmr와 유사
static void dummy_timer_callback(void* arg) {
    // copy 버전의 timer_callback과 유사: 변수 증가 (1ms마다)
    dummy_tmr++;  // 1ms마다 1씩 증가
}
static void dummy_drop_timer_callback(void* arg) {
    // copy 버전의 drop_timer_callback과 유사: 아무 작업도 하지 않음 (호환성 유지)
    // 실제로는 사용하지 않지만, copy 버전과 동일한 구조 유지
}

static void esp_zb_task(void *pvParameters)
{
    /* Initialize Zigbee stack */
    esp_zb_cfg_t zb_nwk_cfg = ESP_ZB_ZED_CONFIG();

    /* Zigbee Light Sleep 활성화 (CAN_SLEEP 정석 구현) */
    ESP_LOGI(TAG, "Zigbee 초기화 (sleep은 조인 후 활성화)");
    
    /* Long Poll Interval 설정 (30초 = 30000ms)
     * ⚠️ 중요: esp_zb_init() 전에 호출해야 함
     * End Device의 기본 Long Poll Interval을 설정하여 폴링 간격 제어
     * keep_alive(30000ms)와 함께 사용하여 30초 주기 리포트 전송 보장
     */
    esp_zb_set_default_long_poll_interval(30000);  // 30초 = 30000ms

    esp_zb_init(&zb_nwk_cfg);

#if LCD_SLEEP_WAKE_STRESS_TEST
    esp_zb_sleep_enable(false);
    ESP_LOGW(TAG, "STRESS TEST: Zigbee Light Sleep 비활성화");
#else
    /* 네트워크 조인 성공 — 이제 sleep 활성화 */
    esp_zb_sleep_enable(true);
    esp_zb_sleep_set_threshold(100);
    ESP_LOGI(TAG, "Zigbee Light Sleep 사전 활성화 (init 직후)");
#endif

    zigbee_setup_tx_power();

    /* Sleepy End Device 모드 설정 (rx_off_when_idle = false) */
    esp_zb_set_rx_on_when_idle(false);
    ESP_LOGI(TAG, "Sleepy End Device 모드 활성화: rx_on_when_idle=false");

    /* Sleep threshold 설정: 이 시간(ms) 이상 idle일 때만 sleep 진입 */
    //esp_zb_sleep_set_threshold(100);  /* 100ms — 짧은 idle은 sleep 안 함 */
    
    esp_zb_iringer_device_cfg_t device_cfg = ESP_ZB_DEFAULT_IRINGER_DEVICE_CONFIG();
    esp_zb_ep_list_t *esp_zb_iringer_ep = zigbee_iringer_ep_create(IRINGER_ENDPOINT, &device_cfg);

    /* Register the device */
    esp_zb_device_register(esp_zb_iringer_ep);

    /* Action handler 등록 (Write Attribute 명령 수신용) */
    esp_zb_core_action_handler_register(zb_action_handler);

    /* APS data confirm 콜백 등록 (SDK 요구사항, 리포트는 딜레이 기반으로 처리) */
    esp_zb_aps_data_confirm_handler_register(aps_data_confirm_noop);

    /* Custom data reporting 설정 제거 */
    // 태스크 딜레이 방식으로 직접 전송하므로 Zigbee 스택의 reporting interval 설정 불필요

    esp_zb_set_primary_network_channel_set(WIFI_SAFE_CHANNELS);

    ESP_ERROR_CHECK(esp_zb_start(false));

    esp_zb_stack_main_loop();
}

void print_zigbee_neighbors(void)
{
    static const char *MONITOR_TAG = "ZB_NEIGHBOR_MONITOR";

    uint16_t pan_id = esp_zb_get_pan_id();
    ESP_LOGD(MONITOR_TAG, "📡 Current PAN ID: 0x%04x", pan_id);

    esp_zb_nwk_info_iterator_t iterator = {0};  // 초기화 필수
    esp_zb_nwk_neighbor_info_t neighbor;

    ESP_LOGD(MONITOR_TAG, "Neighbor Table:");
    
    while (true) {
        esp_err_t err = esp_zb_nwk_get_next_neighbor(&iterator, &neighbor);

        if (err == ESP_ERR_NOT_FOUND) {
            break;  // 순회 완료
        } else if (err != ESP_OK) {
            ESP_LOGE(MONITOR_TAG, "Failed to get neighbor: %s", esp_err_to_name(err));
            break;
        }

        const char *relationship_str;
        switch (neighbor.relationship) {
            case ESP_ZB_NWK_RELATIONSHIP_PARENT:
                relationship_str = "Parent";
                break;
            case ESP_ZB_NWK_RELATIONSHIP_CHILD:
                relationship_str = "Child";
                break;
            case ESP_ZB_NWK_RELATIONSHIP_SIBLING:
                relationship_str = "Sibling";
                break;
            case ESP_ZB_NWK_RELATIONSHIP_NONE_OF_THE_ABOVE:
                relationship_str = "None";
                break;
            case ESP_ZB_NWK_RELATIONSHIP_PREVIOUS_CHILD:
                relationship_str = "Prev Child";
                break;
            case ESP_ZB_NWK_RELATIONSHIP_UNAUTHENTICATED_CHILD:
                relationship_str = "Unauthenticated Child";
                break;
            default:
                relationship_str = "Unknown";
                break;
        }

        ESP_LOGD(MONITOR_TAG, "ShortAddr: 0x%04x | LQI: %3d | Depth: %d | RxOn: %s | Type: %s | Rel: %s",
                 neighbor.short_addr,
                 neighbor.lqi,
                 neighbor.depth,
                 neighbor.rx_on_when_idle ? "Yes" : "No",
                 neighbor.device_type == 0 ? "Coordinator" :
                 neighbor.device_type == 1 ? "Router" : "EndDev",
                 relationship_str);
    }
}

// Sleep 진입 테스트를 위해 주석 처리
/*
void zb_neighbor_monitor_task(void *arg)
{
    while (1) {
        print_zigbee_neighbors();
        vTaskDelay(pdMS_TO_TICKS(5000));  // 5초 간격
    }
}
*/

/* 전원 이상 대응 (30일 PoC #6): cold boot / brownout 후 전원 안정화 대기 */
#define COLD_BOOT_STABILIZE_MS  50   /* 전원 인가(POWERON) 시 레일 안정화 */
#define BROWNOUT_RECOVERY_DELAY_MS  150

/* ── 커스텀 로그 출력: 서버 시간 동기화 후 [DD HH:MM:SS.mm] 타임스탬프 추가 ──
 * gettimeofday()는 Light Sleep 후 RTC 드리프트로 수십 분 점프할 수 있으므로 사용 금지.
 * 대신 esp_timer_get_time()(모노토닉) + g_server_time_base로 계산한다.
 * KST가 이미 g_server_time_base에 bake-in 되어있으므로 gmtime_r로 한국시간이 나온다. */
static int iringer_log_vprintf(const char *fmt, va_list args)
{
    uint32_t base = g_server_time_base;
    int64_t boot = g_boot_time_us;

    if (base == 0 || boot <= 0) {
        return vprintf(fmt, args);
    }

    /* 원본 로그를 버퍼에 렌더링 */
    char buf[256];
    int len = vsnprintf(buf, sizeof(buf), fmt, args);
    if (len <= 0) {
        return vprintf(fmt, args);
    }
    if ((size_t)len >= sizeof(buf)) {
        len = sizeof(buf) - 1;
    }

    /* ") " 패턴 찾기: "I (12345) TAG: msg" 에서 틱카운트 닫는 괄호 */
    char *insert_pos = strstr(buf, ") ");
    if (insert_pos == NULL) {
        /* 패턴 없으면 원본 그대로 출력 */
        return printf("%s", buf);
    }
    insert_pos += 1;  /* ')' 바로 뒤 */

    int64_t elapsed_us = esp_timer_get_time() - boot;
    time_t now = (time_t)base + (time_t)(elapsed_us / 1000000);
    struct tm tm_buf;
    gmtime_r(&now, &tm_buf);
    int cs = (int)((elapsed_us % 1000000) / 10000);

    /* ") " 앞까지 출력 → 타임스탬프 → 나머지 */
    char saved = *insert_pos;
    *insert_pos = '\0';
    int ret = printf("%s", buf);
    *insert_pos = saved;
    ret += printf(" [%02d %02d:%02d:%02d.%02d]%s",
                  tm_buf.tm_mday, tm_buf.tm_hour, tm_buf.tm_min, tm_buf.tm_sec,
                  cs, insert_pos);
    return ret;
}

void app_main(void)
{
    app_globals_init();  // 레이스 컨디션 방지용 뮤텍스 (first_downlink_*, zb_network_joined 등)

    /* ── ALIVE MARKER 초기화 (이전 부팅 사망 마커 출력 + 새 마커 시작) ──
     * 가능한 한 일찍 호출 — 다른 초기화로 RTC slow mem 노이즈 안 가게 */
    alive_marker_init_and_dump_previous();

    // Cold boot 또는 Brownout 리셋 시 전원 안정화 대기 후 초기화 진행
    esp_reset_reason_t reset_reason = esp_reset_reason();
    if (reset_reason == ESP_RST_POWERON) {
        ESP_LOGI(TAG, "Cold boot (POWERON) - 전원 안정화 대기 (%d ms)", COLD_BOOT_STABILIZE_MS);
        vTaskDelay(pdMS_TO_TICKS(COLD_BOOT_STABILIZE_MS));
    } else if (reset_reason == ESP_RST_BROWNOUT) {
        ESP_LOGW(TAG, "Brownout 리셋 감지 - 전원 안정화 대기 (%d ms)", BROWNOUT_RECOVERY_DELAY_MS);
        vTaskDelay(pdMS_TO_TICKS(BROWNOUT_RECOVERY_DELAY_MS));
    }

    // Zigbee sleep 방식: esp_zb_sleep_now()는 Light Sleep이므로 재부팅되지 않음
    // wake-up 원인 확인 (LP Core wakeup 등의 경우 처리)
    esp_sleep_wakeup_cause_t wakeup_cause = esp_sleep_get_wakeup_cause();
    if (wakeup_cause != ESP_SLEEP_WAKEUP_UNDEFINED) {
        // Wake-up 시간 기록 (iringer_data_update_task()에서 중복 기록 방지)
        if (wake_up_time_us == 0) {
            wake_up_time_us = esp_timer_get_time();
            ESP_LOGI(TAG, "Sleep에서 깨어남: 원인=%d (0=UNDEFINED, 1=EXT0, 2=EXT1, 3=TIMER, 4=TOUCHPAD, 5=ULP) - 깨어 있는 시간 기록 시작",
                     wakeup_cause);
            // Wakeup 시 LED 점등 기능 삭제 (고객사 협의 반영, LP Core에서 점멸/알람 점등 제어)
        }
        if (wakeup_cause == ESP_SLEEP_WAKEUP_ULP) {
            ESP_LOGI(TAG, "LP Core Wakeup: 리포트 전송 플래그 설정");
            if (app_globals_lock()) {
                should_send_on_wakeup = true;
                s_wakeup_for_report_only = true;
                app_globals_unlock();
            }
            if (sleep_wait_event_group != NULL) {
                xEventGroupClearBits(sleep_wait_event_group, EVENT_BIT_DOWNLINK_RECEIVED);
            }
        } else if (wakeup_cause == ESP_SLEEP_WAKEUP_TIMER) {
            ESP_LOGI(TAG, "keep_alive Wakeup: 리포트 전송 플래그 설정 (keep_alive=%dms)", ED_KEEP_ALIVE);
            if (app_globals_lock()) {
                should_send_on_wakeup = true;
                s_wakeup_for_report_only = true;
                app_globals_unlock();
            }
            if (sleep_wait_event_group != NULL) {
                xEventGroupClearBits(sleep_wait_event_group, EVENT_BIT_DOWNLINK_RECEIVED);
            }
        }
    }
    
    // 부팅 시간 초기화 (수액 종료 알람 로직용)
    device_boot_time_us = esp_timer_get_time();
    ESP_LOGI(TAG, "부팅 시간 기록: %llu us (알람 워밍업 시간: %d분)", 
             device_boot_time_us, ALARM_WARMUP_TIME_MINUTES);
    
    // 로그 레벨 최적화 (프로덕션 모드: WARN 이상만 출력)
    // 개발 중에는 INFO 레벨로 변경 가능
    esp_log_level_set("*", ESP_LOG_WARN);
    esp_log_level_set("IRINGER_REPORT", ESP_LOG_WARN);
    esp_log_level_set("IRINGER_IR_2.1", ESP_LOG_INFO);  // 메인 태그는 INFO 유지
    esp_log_level_set("CAPACITOR_SENSOR", ESP_LOG_INFO);  // 커패시터 센서 태그는 INFO 유지
    esp_log_level_set("TFT", ESP_LOG_DEBUG);  // TFT 태그는 WARN
    esp_log_level_set("IR_SENSOR", ESP_LOG_WARN);  // IR 센서 태그는 WARN
    esp_log_level_set("BATTERY", ESP_LOG_INFO);  // 배터리 태그는 INFO (디버깅 가능하도록)
    esp_log_level_set("POWER", ESP_LOG_WARN);  // 전원 태그는 WARN
    esp_log_level_set("ZB_NEIGHBOR_MONITOR", ESP_LOG_INFO);  // Zigbee neighbor monitor는 DEBUG

    /* 서버 시간 동기화 후 로그에 [DD HH:MM:SS.mm] 타임스탬프 자동 추가
     * esp_timer 모노토닉 기반 — Light Sleep 후에도 정확함 */
    esp_log_set_vprintf(iringer_log_vprintf);
    
    ESP_LOGI(TAG, "Starting i-Ringer IR End Device v2.1");
    buzzer_beep_once();  // 부팅 알림 음

    // NVS 초기화
    ESP_ERROR_CHECK(nvs_flash_init());

#if SLEEP_WAKE_LOGGING
    swlog_load_and_print();   /* 이전 세션의 sleep 로그가 NVS에 있으면 출력 */
#endif

    // 오류 로깅 및 통계: 리셋 원인, reboot_count NVS 저장 및 부팅 로그 (reset_reason은 app_main 상단에서 설정됨)
    storage_inc_reboot_count();
    storage_set_last_reset_reason((uint32_t)reset_reason);
    uint32_t reboot_count = storage_get_reboot_count();
    uint32_t reconnect_count = storage_get_reconnect_count();
    ESP_LOGI(TAG, "리셋 원인=%d (1=SW,2=잠깸,3=익셉션,4=SW_WDT,5=TG0_WDT,6=TG1_WDT,7=RTCWDT), reboot_count=%lu, reconnect_count=%lu",
             (int)reset_reason, (unsigned long)reboot_count, (unsigned long)reconnect_count);
    
    /* ESP Zigbee Light Sleep 초기화 (공식 예제 방식) - 필수, 성공할 때까지 재시도 */
    esp_err_t pm_ret;
    int pm_retry = 0;
    do {
        pm_ret = zigbee_power_save_init();
        if (pm_ret != ESP_OK) {
            ESP_LOGW(TAG, "Zigbee power save 초기화 실패 (재시도 %d): %s", pm_retry + 1, esp_err_to_name(pm_ret));
            vTaskDelay(pdMS_TO_TICKS(200));
            pm_retry++;
        }
    } while (pm_ret != ESP_OK);
    
    // 새로운 하드웨어 v2.1: 전원은 슬라이드 스위치로 ON/OFF (전원 관리 코드 불필요)
    // Phase 4: LED 초기화 (Sleep=LOW, Wakeup=HIGH)
    led_pwr_init();
    // 초기값: HIGH (Wakeup 시)
    
    // 디바이스 데이터 뮤텍스 초기화 (T-05: device_data 동시 접근 방지)
    device_data_init();
    // 디바이스 데이터 초기화
    init_device_data();
    
    ESP_LOGE("TRAP_1", "부팅 직후 뿌리 데이터: %.2f", device_data_get()->ordered_gtt);

    // 부팅 시 기기 정보 로그 출력
    uint8_t mac[8];  // IEEE802154 MAC 주소는 8바이트
    esp_read_mac(mac, ESP_MAC_IEEE802154);
    if (device_data_lock()) {
        ESP_LOGI(TAG, "기기 SN: iRinger-%.4s", device_data_get_mutable()->serial_number);
        device_data_unlock();
    }
    ESP_LOGI(TAG, "기기 MAC Address: %02x:%02x:%02x:%02x:%02x:%02x:%02x:%02x", 
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5], mac[6], mac[7]);
    // 배터리 모듈 초기화 - 필수, 성공할 때까지 재시도
    esp_err_t bat_ret;
    int bat_retry = 0;
    do {
        bat_ret = battery_init();
        if (bat_ret != ESP_OK) {
            ESP_LOGW(TAG, "배터리 모듈 초기화 실패 (재시도 %d): %s", bat_retry + 1, esp_err_to_name(bat_ret));
            vTaskDelay(pdMS_TO_TICKS(200));
            bat_retry++;
        }
    } while (bat_ret != ESP_OK);
    
    // 하드웨어 타이머 기능 제거됨: 직접 제어 모드만 사용 (LP Core에서 GPIO6으로 발광부/수광부 동기화)
    
    // IR 센서는 LP Core에서 처리됨 (HP Core 초기화 불필요)
    
    // 커패시터 센서 초기화 (수액 종료 감지) - 필수, 성공할 때까지 재시도
    esp_err_t cap_ret;
    int cap_retry = 0;
    do {
        cap_ret = capacitor_sensor_init();
        if (cap_ret != ESP_OK) {
            ESP_LOGW(TAG, "커패시터 센서 초기화 실패 (재시도 %d): %s", cap_retry + 1, esp_err_to_name(cap_ret));
            vTaskDelay(pdMS_TO_TICKS(200));
            cap_retry++;
        }
    } while (cap_ret != ESP_OK);

    // 1. timer_callback용 타이머 (1ms 주기)
    esp_timer_create_args_t dummy_timer_args = {
        .callback = dummy_timer_callback,
        .name = "dummy_timer"
    };
    if (esp_timer_create(&dummy_timer_args, &dummy_timer_handle) == ESP_OK) {
        esp_timer_start_periodic(dummy_timer_handle, 1000);  // 1ms
    }
    
    // 2. drop_timer_callback용 타이머 (1ms 주기)
    esp_timer_create_args_t dummy_drop_timer_args = {
        .callback = dummy_drop_timer_callback,
        .name = "dummy_drop_timer"
    };
    if (esp_timer_create(&dummy_drop_timer_args, &dummy_drop_timer_handle) == ESP_OK) {
        esp_timer_start_periodic(dummy_drop_timer_handle, 1000);  // 1ms
    }
    
    // 3. ir_sensor_sample_callback용 타이머 (2ms 주기, 500Hz)
    // 실제 샘플링은 하지 않지만, copy 버전과 동일한 주기로 콜백 실행
    esp_timer_create_args_t dummy_sample_timer_args = {
        .callback = dummy_drop_timer_callback,  // 더미 콜백 재사용
        .name = "dummy_sample_timer"
    };
    if (esp_timer_create(&dummy_sample_timer_args, &dummy_sample_timer_handle) == ESP_OK) {
        esp_timer_start_periodic(dummy_sample_timer_handle, 2000);  // 2ms (500Hz)
    }
    
    if (dummy_timer_handle && dummy_drop_timer_handle && dummy_sample_timer_handle) {
        ESP_LOGI(TAG, "더미 타이머 3개 시작 완료 (copy 버전과 유사한 환경 유지)");
    }
    
    // Phase 7-8: LP Core 초기화 (기존 알고리즘 사용)
    esp_err_t lp_core_err = lp_core_init();
    if (lp_core_err == ESP_OK) {
        ESP_LOGI(TAG, "LP Core 초기화 완료 (기존 알고리즘 사용)");
        // LP Core 시작 (500Hz 샘플링)
        lp_core_err = lp_core_start();
        if (lp_core_err == ESP_OK) {
            // LP Core가 물방울 감지를 담당 (HP Core IR 센서 코드 제거됨)
            
            // LP Core 실제 동작 확인 (약간의 지연 후 상태 확인)
            vTaskDelay(pdMS_TO_TICKS(100));  // 100ms 대기 (LP Core 시작 대기)
            if (lp_core_is_running()) {
                lp_core_shared_data_t lp_data;
                if (lp_core_get_data(&lp_data) == ESP_OK) {
                    ESP_LOGI(TAG, "LP Core 시작 완료 및 동작 확인 (GPIO3에서 500Hz 샘플링, data_ready=%d)", lp_data.data_ready);
                } else {
                    ESP_LOGW(TAG, "LP Core 시작 완료했으나 데이터 읽기 실패 (기존 인터럽트 방식 사용)");
                }
            } else {
                ESP_LOGW(TAG, "LP Core 시작 완료했으나 실행 상태 확인 실패 (기존 인터럽트 방식 사용)");
            }
        } else {
            ESP_LOGW(TAG, "LP Core 시작 실패: %s (기존 인터럽트 방식 사용)", esp_err_to_name(lp_core_err));
        }
    } else {
        ESP_LOGW(TAG, "LP Core 초기화 실패: %s (기존 인터럽트 방식 사용)", esp_err_to_name(lp_core_err));
    }

    /* ULP wakeup 설정 (한 번만 호출, sleep 후에도 유지됨)
     * LP Core 비상상황(GTT 급변, 수액 완료) 시 메인코어를 깨움 */
    esp_err_t ulp_ret = esp_sleep_enable_ulp_wakeup();
    if (ulp_ret == ESP_OK) {
        ESP_LOGI(TAG, "ULP wakeup 설정 완료 (LP Core 비상 wakeup 활성화)");
    } else {
        ESP_LOGW(TAG, "ULP wakeup 설정 실패: %s", esp_err_to_name(ulp_ret));
    }
    
    // TFT 디스플레이 초기화 (선택사항)
    esp_err_t tft_err = tft_init(true);
    if (tft_err == ESP_OK) {
        iringer_update_tft_display_data();
        tft_set_connection_status(0);  // 초기 상태: 연결 안됨
        display_main();  // 초기 디스플레이 설정
        
        // 초기 부팅 시 LCD 백라이트는 켜지 않음 (injection_complete일 때만 켜짐)
        // 백라이트는 Sleep 진입 시 OFF되고, Wakeup 시에도 OFF 상태 유지
        
        // 초기 부팅 시 GTT 측정 및 UI 업데이트 (네트워크 연결 여부와 관계없이)
        // calc_drop()을 호출하여 초기 데이터 계산
        // 배터리 전압/레벨도 먼저 측정하여 UI에 표시
        uint32_t battery_voltage_mv = battery_get_voltage();
        uint8_t battery_level = battery_get_level();
        if (!device_data_lock()) {
            ESP_LOGW(TAG, "TFT init: device_data_lock timeout, skip battery/calc_drop update");
        } else {
        device_data_get_mutable()->battery_level = battery_level;
        ESP_LOGI(TAG, "초기 배터리 측정: 전압=%lumV, 레벨=%d%%", battery_voltage_mv, battery_level);
        
        // calc_drop()을 호출하여 초기 데이터 계산 (성공 여부와 관계없이 UI 업데이트)
        calc_drop();
        // 데이터 변경 여부와 관계없이 초기 UI 업데이트 (GTT 값 표시)
        iringer_update_tft_display_data();
        print_data();
        device_data_unlock();
        }
        ESP_LOGI(TAG, "%s", "TFT 디스플레이 초기화 완료 (초기 GTT 측정 및 UI 업데이트 완료)");
    } else {
        ESP_LOGW(TAG, "%s", "TFT 디스플레이 초기화 실패 (선택사항이므로 계속 진행)");
    }
    
    // Zigbee 플랫폼 설정
    esp_zb_platform_config_t config = {
        .radio_config = ESP_ZB_DEFAULT_RADIO_CONFIG(),
        .host_config = ESP_ZB_DEFAULT_HOST_CONFIG(),
    };
    ESP_ERROR_CHECK(esp_zb_platform_config(&config));
    
    // 새로운 하드웨어 v2.1: 전원 버튼 모니터링 태스크 제거
    // 전원은 슬라이드 스위치로 ON/OFF하므로 전원 버튼 모니터링 불필요
    
    // GTT 측정 및 데이터 업데이트 태스크 시작 (Zigbee 연결과 독립적으로 실행)
    // Zigbee 연결이 실패하더라도 GTT 측정과 UI 업데이트는 계속 작동
    alarm_authority_init();
    ESP_LOGI(TAG, "Data update task %s",
             iringer_data_update_task_init() == ESP_OK ? "successful" : "failed");

    // ⚠️ 중요: Task watchdog 에러 방지를 위한 yield 태스크 추가
    // ir_sensor 코드 제거로 인해 우선순위 1 태스크들이 없어져서 IDLE 태스크가 CPU 시간을 받지 못할 수 있음
    // 주기적으로 taskYIELD()를 호출하는 태스크를 추가하여 IDLE 태스크가 CPU 시간을 받도록 함
    // 우선순위 4로 설정하여 Zigbee 태스크(우선순위 3)보다 높아서 주기적으로 실행되도록 함
    // 주기적으로 yield하므로 IDLE 태스크가 CPU 시간을 받을 수 있음
    xTaskCreate(watchdog_yield_task, "watchdog_yield", 2048, NULL, 4, &s_watchdog_task_handle);
    ESP_LOGI(TAG, "Watchdog yield 태스크 시작 완료 (Task watchdog 에러 방지)");
    
    ESP_LOGI(TAG, "%s", "Zigbee 네트워크 조인 시작");
    
    /* Start Zigbee stack task */
    // ⚠️ 중요: copy 버전과 동일한 우선순위 3으로 복원 (Zigbee 조인 문제 해결을 위해)
    xTaskCreate(esp_zb_task, "Zigbee_main", 4096, NULL, 3, NULL);  // 우선순위 3 (copy 버전과 동일)
    // Sleep 진입 테스트를 위해 주석 처리
    // xTaskCreate(zb_neighbor_monitor_task, "zb_neighbor_monitor", 4096, NULL, 1, NULL);
}

