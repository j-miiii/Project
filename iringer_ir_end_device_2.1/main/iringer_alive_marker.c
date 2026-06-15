/*
 * iringer_alive_marker.c — RTC slow memory 기반 alive marker 구현
 *
 * 데이터는 RTC_NOINIT_ATTR로 RTC slow memory에 저장된다.
 * 전원 OFF 시 사라지지만 soft reset / esptool flash에는 살아남는다.
 *
 * 위치: main/iringer_alive_marker.c
 * 헤더 위치: components/iringer_contracts/include/iringer_alive_marker.h
 *
 * CMakeLists.txt 등록 필요:
 *   main/CMakeLists.txt의 SRCS 목록에 "iringer_alive_marker.c" 추가
 */
#include "iringer_alive_marker.h"

#if IRINGER_ALIVE_MARKER_ENABLE

#include <string.h>
#include <inttypes.h>
#include "esp_attr.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"

static const char *TAG = "ALIVE";

/* ── 매직 시그니처: 이전 부팅의 데이터인지 검증 ── */
#define ALIVE_MARKER_MAGIC      0xA11BEEF0u  /* "alive beef" */
#define ALIVE_MARKER_VERSION    1

/* ── RTC slow memory 데이터 구조 ──
 * 변경 시 ALIVE_MARKER_VERSION 증가시킬 것 */
typedef struct {
    uint32_t magic;
    uint32_t version;
    uint32_t boot_count;             /* 누적 부팅 횟수 */
    uint64_t boot_time_us;           /* 이번 부팅 시작 시각 (esp_timer 기준) */
    uint64_t last_update_us;         /* 마지막 마커 갱신 시각 */
    uint32_t update_count;           /* 마커 갱신 누적 횟수 */
    uint32_t main_loop_iter;
    uint32_t can_sleep_count;
    uint32_t sleep_now_enter_count;
    uint32_t sleep_now_exit_count;
    uint32_t tftinit_cold_count;
    uint32_t tftinit_warm_count;
    uint32_t safety_net_1_fires;
    uint64_t awake_hold_to_idle_us;  /* AWAKE_HOLD→IDLE 전이 시각 (30초 가설 검증) */
    uint8_t  last_app_state;
    uint8_t  last_alarm_state;
    uint8_t  last_lcd_sleeping;
    uint8_t  last_marker_location;
    uint32_t reserved[4];            /* future expansion */
} alive_marker_t;

static RTC_NOINIT_ATTR alive_marker_t s_marker;

/* 마커 위치 enum → 문자열 변환 */
static const char *marker_loc_str(uint8_t loc)
{
    switch ((alive_marker_location_t)loc) {
        case MARKER_LOC_NONE:                          return "NONE";
        case MARKER_LOC_APP_MAIN_START:                return "APP_MAIN_START";
        case MARKER_LOC_APP_MAIN_END:                  return "APP_MAIN_END";
        case MARKER_LOC_DATA_UPDATE_TASK:              return "DATA_UPDATE_TASK";
        case MARKER_LOC_MAIN_LOOP_TOP:                 return "MAIN_LOOP_TOP";
        case MARKER_LOC_MAIN_LOOP_BEFORE_REPORT:       return "MAIN_LOOP_BEFORE_REPORT";
        case MARKER_LOC_MAIN_LOOP_AFTER_REPORT:        return "MAIN_LOOP_AFTER_REPORT";
        case MARKER_LOC_MAIN_LOOP_END:                 return "MAIN_LOOP_END";
        case MARKER_LOC_CAN_SLEEP_HANDLER_ENTER:       return "CAN_SLEEP_HANDLER_ENTER";
        case MARKER_LOC_CAN_SLEEP_PREP_DONE:           return "CAN_SLEEP_PREP_DONE";
        case MARKER_LOC_CAN_SLEEP_BEFORE_SLEEP_NOW:    return "CAN_SLEEP_BEFORE_SLEEP_NOW";
        case MARKER_LOC_CAN_SLEEP_AFTER_SLEEP_NOW:     return "CAN_SLEEP_AFTER_SLEEP_NOW";
        case MARKER_LOC_CAN_SLEEP_HANDLER_EXIT:        return "CAN_SLEEP_HANDLER_EXIT";
        case MARKER_LOC_TFTINIT_COLD_ENTER:            return "TFTINIT_COLD_ENTER";
        case MARKER_LOC_TFTINIT_COLD_EXIT:             return "TFTINIT_COLD_EXIT";
        case MARKER_LOC_TFTINIT_WARM_ENTER:            return "TFTINIT_WARM_ENTER";
        case MARKER_LOC_TFTINIT_WARM_EXIT:             return "TFTINIT_WARM_EXIT";
        case MARKER_LOC_TFT_DISPLAY_ON_ENTER:          return "TFT_DISPLAY_ON_ENTER";
        case MARKER_LOC_TFT_DISPLAY_ON_EXIT:           return "TFT_DISPLAY_ON_EXIT";
        case MARKER_LOC_TFT_DISPLAY_OFF_ENTER:         return "TFT_DISPLAY_OFF_ENTER";
        case MARKER_LOC_TFT_DISPLAY_OFF_EXIT:          return "TFT_DISPLAY_OFF_EXIT";
        case MARKER_LOC_ALARM_AUTH_TO_IDLE:            return "ALARM_AUTH_TO_IDLE";
        case MARKER_LOC_ALARM_AUTH_TO_ACTIVE:          return "ALARM_AUTH_TO_ACTIVE";
        case MARKER_LOC_ALARM_AUTH_TO_AWAKE_HOLD:      return "ALARM_AUTH_TO_AWAKE_HOLD";
        case MARKER_LOC_ALARM_AUTH_AWAKE_HOLD_TO_IDLE: return "ALARM_AUTH_AWAKE_HOLD_TO_IDLE";
        case MARKER_LOC_LP_CORE_WAKE_RECEIVED:         return "LP_CORE_WAKE_RECEIVED";
        default:                                       return "UNKNOWN";
    }
}

void alive_marker_init_and_dump_previous(void)
{
    esp_reset_reason_t rr = esp_reset_reason();
    bool is_power_on = (rr == ESP_RST_POWERON);
    bool magic_valid = (s_marker.magic == ALIVE_MARKER_MAGIC && s_marker.version == ALIVE_MARKER_VERSION);

    /* ── 이전 부팅 마커 출력 조건 ──
     *   1. magic이 valid해야 함 (RTC slow mem에 의미있는 데이터)
     *   2. reset reason이 power-on이 아니어야 함 (power cycle 시 garbage 가능성 배제)
     *   둘 다 만족할 때만 "이전 사망" 정보로 간주 */
    if (magic_valid && !is_power_on) {
        ESP_LOGE(TAG, "==================== ALIVE MARKER: 이전 부팅 사망 감지 ====================");
        ESP_LOGE(TAG, "  reset_reason = %d (1=SW,2=잠깸,3=익셉션,4=SW_WDT,5=TG0_WDT,6=TG1_WDT,7=RTCWDT)", (int)rr);
        ESP_LOGE(TAG, "  이전 부팅 #%lu, version=%lu",
                 (unsigned long)s_marker.boot_count, (unsigned long)s_marker.version);
        ESP_LOGE(TAG, "  boot_time_us=%" PRIu64 ", last_update_us=%" PRIu64,
                 s_marker.boot_time_us, s_marker.last_update_us);
        ESP_LOGE(TAG, "  살아있던 시간 = %" PRIu64 " ms",
                 (s_marker.last_update_us - s_marker.boot_time_us) / 1000);
        ESP_LOGE(TAG, "  update_count=%lu, main_loop_iter=%lu",
                 (unsigned long)s_marker.update_count,
                 (unsigned long)s_marker.main_loop_iter);
        ESP_LOGE(TAG, "  can_sleep=%lu, sleep_now_enter=%lu, sleep_now_exit=%lu",
                 (unsigned long)s_marker.can_sleep_count,
                 (unsigned long)s_marker.sleep_now_enter_count,
                 (unsigned long)s_marker.sleep_now_exit_count);
        if (s_marker.sleep_now_enter_count > s_marker.sleep_now_exit_count) {
            ESP_LOGE(TAG, "  ★ sleep_now ENTER > EXIT — 마지막 sleep에서 wake 못함 (retention 깨짐 의심)");
        }
        ESP_LOGE(TAG, "  tft_init: cold=%lu, warm=%lu",
                 (unsigned long)s_marker.tftinit_cold_count,
                 (unsigned long)s_marker.tftinit_warm_count);
        ESP_LOGE(TAG, "  안전망1 발동 누적 = %lu", (unsigned long)s_marker.safety_net_1_fires);
        ESP_LOGE(TAG, "  마지막 위치 = [%u] %s",
                 (unsigned)s_marker.last_marker_location,
                 marker_loc_str(s_marker.last_marker_location));
        ESP_LOGE(TAG, "  마지막 app_state=%u alarm_state=%u lcd_sleeping=%u",
                 (unsigned)s_marker.last_app_state,
                 (unsigned)s_marker.last_alarm_state,
                 (unsigned)s_marker.last_lcd_sleeping);

        /* AWAKE_HOLD → IDLE 후 살아있던 시간 (30초 가설 검증) */
        if (s_marker.awake_hold_to_idle_us > 0 &&
            s_marker.last_update_us > s_marker.awake_hold_to_idle_us) {
            uint64_t survived_after_ah_to_idle_ms =
                (s_marker.last_update_us - s_marker.awake_hold_to_idle_us) / 1000;
            ESP_LOGE(TAG, "  ★ AWAKE_HOLD→IDLE 후 살아있던 시간 = %" PRIu64 " ms (사망까지)",
                     survived_after_ah_to_idle_ms);
        }
        ESP_LOGE(TAG, "==========================================================================");
    } else if (magic_valid && is_power_on) {
        ESP_LOGW(TAG, "ALIVE MARKER: power-on reset이지만 이전 마커가 존재함 (#%lu) — 무시",
                 (unsigned long)s_marker.boot_count);
    } else {
        ESP_LOGI(TAG, "ALIVE MARKER: 이전 마커 없음 (magic=0x%08lX, reset=%d) — 첫 부팅 또는 power cycle",
                 (unsigned long)s_marker.magic, (int)rr);
    }

    /* ── 새 부팅 마커 초기화 ── */
    uint32_t prev_boot_count = magic_valid ? s_marker.boot_count : 0;
    memset(&s_marker, 0, sizeof(s_marker));
    s_marker.magic = ALIVE_MARKER_MAGIC;
    s_marker.version = ALIVE_MARKER_VERSION;
    s_marker.boot_count = prev_boot_count + 1;
    s_marker.boot_time_us = (uint64_t)esp_timer_get_time();
    s_marker.last_update_us = s_marker.boot_time_us;
    s_marker.last_marker_location = (uint8_t)MARKER_LOC_APP_MAIN_START;

    ESP_LOGW(TAG, "ALIVE MARKER 초기화 완료: 부팅 #%lu", (unsigned long)s_marker.boot_count);
}

void alive_marker_set_location(alive_marker_location_t loc)
{
    s_marker.last_marker_location = (uint8_t)loc;
    s_marker.last_update_us = (uint64_t)esp_timer_get_time();
    s_marker.update_count++;
}

void alive_marker_set_main_loop_iter(uint32_t iter)       { s_marker.main_loop_iter = iter; }
void alive_marker_set_app_state(uint8_t app_state)        { s_marker.last_app_state = app_state; }
void alive_marker_set_alarm_state(uint8_t alarm_state)    { s_marker.last_alarm_state = alarm_state; }
void alive_marker_set_lcd_sleeping(bool sleeping)         { s_marker.last_lcd_sleeping = sleeping ? 1 : 0; }

void alive_marker_inc_can_sleep_count(void)               { s_marker.can_sleep_count++; }
void alive_marker_inc_sleep_now_enter(void)               { s_marker.sleep_now_enter_count++; }
void alive_marker_inc_sleep_now_exit(void)                { s_marker.sleep_now_exit_count++; }
void alive_marker_inc_cold_count(void)                    { s_marker.tftinit_cold_count++; }
void alive_marker_inc_warm_count(void)                    { s_marker.tftinit_warm_count++; }
void alive_marker_inc_safety_net_1_fires(void)            { s_marker.safety_net_1_fires++; }

void alive_marker_record_awake_hold_to_idle(void)
{
    s_marker.awake_hold_to_idle_us = (uint64_t)esp_timer_get_time();
}

#endif /* IRINGER_ALIVE_MARKER_ENABLE */
