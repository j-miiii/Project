#include "iringer_alive_marker.h"
#include "iringer_alarm_authority.h"
#include "iringer_app_common.h"
#include "iringer_ir_end_device_2.1.h"
#include "iringer_buzzer.h"
#include "iringer_tft.h"
#include "iringer_device_data.h"
#include "lp_core/lp_core.h"
#include "lp_core/lp_core_shared_memory.h"
#include "lp_core/lp_core_algorithm_config.h"  /* LP_ALGO_ALARM_GTT_THRESHOLD */
#include "iringer_lcd_sleep.h"
#include "esp_log.h"
#include "esp_timer.h"

static const char *TAG = "ALARM_AUTH";

/* ── 내부 상태 ── */
static alarm_authority_state_t s_state = ALARM_STATE_IDLE;
static uint64_t s_awake_hold_start_us = 0;

/* ACTIVE → IDLE 전이용: gtt >= THRESHOLD 연속 유지 시작 시각 (0이면 미시작) */
static uint64_t s_gtt_recovery_start_us = 0;

/* ── 외부 태스크 핸들 (end_device.c에서 extern) ── */
extern TaskHandle_t s_data_update_task_handle;

void alarm_authority_init(void)
{
    s_state = ALARM_STATE_IDLE;
    s_awake_hold_start_us = 0;
    s_gtt_recovery_start_us = 0;
    ESP_LOGI(TAG, "alarm_authority 초기화 완료 (3상태: IDLE/ACTIVE/AWAKE_HOLD, threshold=%d)",
             LP_ALGO_ALARM_GTT_THRESHOLD);
}

/* ── 알람 조건 판정: 감쇠 GTT < THRESHOLD ── */
static bool evaluate_should_alarm(void)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (!shared) return false;

    /* 방울이 한 번도 안 왔으면(점적통 미장착 가능) 알람 불필요 */
    if (shared->drop_cnt == 0) return false;

    /* 감쇠 GTT가 THRESHOLD 이상이면 수액 흐르는 중 */
    if (shared->gtt >= LP_ALGO_ALARM_GTT_THRESHOLD) return false;

    /* 워밍업: 부팅 후 ALARM_WARMUP_TIME_MINUTES 미경과 시 알람 안 울림 */
    extern uint64_t device_boot_time_us;
    uint64_t elapsed_min = (esp_timer_get_time() - device_boot_time_us) / (60ULL * 1000000ULL);
    if (elapsed_min < (uint64_t)ALARM_WARMUP_TIME_MINUTES) return false;

    return true;
}

/* ── AWAKE_HOLD 만료 체크 ── */
static bool awake_hold_expired(void)
{
    if (s_awake_hold_start_us == 0) return true;
    uint64_t elapsed_us = esp_timer_get_time() - s_awake_hold_start_us;
    return (elapsed_us >= ((uint64_t)AWAKE_HOLD_DURATION_SEC * 1000000ULL));
}

/* ── 공통: LP Core GTT → device_data 동기화 ──
 * LCD와 서버 리포트용: gtt < THRESHOLD이면 0으로 표시 */
static void sync_lp_gtt_to_device_data(void)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared && device_data_lock()) {
        gtt_int_t raw_gtt = shared->gtt;
        float display_gtt = (raw_gtt < LP_ALGO_ALARM_GTT_THRESHOLD) ? 0.0f : (float)raw_gtt;
        device_data_get_mutable()->gtt = display_gtt;
        device_data_get_mutable()->drop_per_sec = display_gtt / 60.0f;
        device_data_unlock();
    }
}

/* ── 출력 제어: IDLE/AWAKE_HOLD → ACTIVE 진입 시 ── */
static void do_activate(void)
{
#if !DISABLE_ALARM_FOR_BATTERY_TEST
    /* LP Core GTT → device_data 동기화 */
    sync_lp_gtt_to_device_data();

    /* 부저 시작 */
    if (!buzzer_alarm_fluid_end_is_active()) {
        buzzer_alarm_fluid_end_start(ALARM_INTERVAL_10SEC_MS);
        ESP_LOGW(TAG, "부저 시작 (10초 간격)");
    }

    /* vTaskResume(ui_task) 제거 — CAN_SLEEP에서 suspend 안 하므로 불필요 */

    /* Phase 2 타이머 선제 중지 (LCD ON 중 콜백 방지) */
    tft_lcd_sleep_timer_stop();

    /* LCD ON (동기 — SPI init 완료 대기) */
    if (tft_is_lcd_sleeping()) {
        tft_lcd_on_and_wait(3000);
    }

    /* LCD ON 내부에서 Phase 2 타이머가 재시작되므로 다시 중지 */
#if LCD_SLEEP_WAKE_STRESS_TEST
    /* 스트레스 테스트: 타이머를 멈추지 않아 10초 후 LCD OFF → 재알람 → LCD ON 반복 */
    ESP_LOGW(TAG, "STRESS TEST: LCD sleep 타이머 유지 (10초 후 LCD OFF 예정)");
#else
    tft_lcd_sleep_timer_stop();
#endif

    /* vTaskResume(data_update_task) 제거 — CAN_SLEEP에서 suspend 안 하므로 불필요 */

    /* LP Core LED */
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) shared->fluid_end_alarm_active = true;

    /* 해제 타이머 리셋 */
    s_gtt_recovery_start_us = 0;
#endif
}

/* ── 출력 제어: ACTIVE → IDLE 전이 시 ── */
static void do_deactivate(void)
{
#if !DISABLE_ALARM_FOR_BATTERY_TEST
    if (buzzer_alarm_fluid_end_is_active()) {
        buzzer_alarm_fluid_end_stop();
        ESP_LOGI(TAG, "부저 중지 (방울 재개)");
    }

    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) shared->fluid_end_alarm_active = false;

    s_gtt_recovery_start_us = 0;

    /* 태스크 suspend와 LCD off는 다음 CAN_SLEEP이 처리 (기존 흐름 유지) */
#endif
}

/* ── 상태 머신 갱신 ── */
void alarm_authority_update(void)
{
    bool should_alarm = evaluate_should_alarm();

    lp_core_shared_data_t *sh = lp_core_get_shared_memory();
    gtt_int_t current_gtt = sh ? sh->gtt : 0;

    switch (s_state) {

    case ALARM_STATE_IDLE:
        if (should_alarm) {
            s_state = ALARM_STATE_ACTIVE;
            ESP_LOGW(TAG, "IDLE → ACTIVE (gtt=%ld < %d)", (long)current_gtt, LP_ALGO_ALARM_GTT_THRESHOLD);
            alive_marker_set_alarm_state((uint8_t)s_state);
            alive_marker_set_location(MARKER_LOC_ALARM_AUTH_TO_ACTIVE);
            do_activate();
        }
        break;

    case ALARM_STATE_ACTIVE:
        if (!should_alarm) {
            /* 방울이 재개되어 gtt >= THRESHOLD.
             * 노이즈 방어: THRESHOLD 이상이 ALARM_RECOVERY_SUSTAIN_SEC초 연속 유지돼야 해제. */
            if (current_gtt >= LP_ALGO_ALARM_GTT_THRESHOLD) {
                if (s_gtt_recovery_start_us == 0) {
                    /* 회복 타이머 시작 */
                    s_gtt_recovery_start_us = esp_timer_get_time();
                }
                uint64_t sustained_us = esp_timer_get_time() - s_gtt_recovery_start_us;
                if (sustained_us >= ((uint64_t)ALARM_RECOVERY_SUSTAIN_SEC * 1000000ULL)) {
                    /* 충분히 유지됨 → 알람 해제 */
                    s_state = ALARM_STATE_IDLE;
                    ESP_LOGI(TAG, "ACTIVE → IDLE (gtt=%ld, %d초 유지 확인)",
                             (long)current_gtt, ALARM_RECOVERY_SUSTAIN_SEC);
                    alive_marker_set_alarm_state((uint8_t)s_state);
                    alive_marker_set_location(MARKER_LOC_ALARM_AUTH_TO_IDLE);
                    do_deactivate();
                }
            } else {
                /* gtt < THRESHOLD로 다시 떨어짐 → 회복 타이머 리셋 */
                s_gtt_recovery_start_us = 0;
            }
        } else {
            /* should_alarm == true → 아직 수액 정지 상태, 회복 타이머 리셋 */
            s_gtt_recovery_start_us = 0;
        }
        break;

    case ALARM_STATE_AWAKE_HOLD:
        if (should_alarm) {
            /* 0gtt 감지 → ACTIVE 승격 (부저 시작) */
            s_state = ALARM_STATE_ACTIVE;
            ESP_LOGW(TAG, "AWAKE_HOLD → ACTIVE (gtt=%ld < %d)", (long)current_gtt, LP_ALGO_ALARM_GTT_THRESHOLD);
            alive_marker_set_alarm_state((uint8_t)s_state);
            alive_marker_set_location(MARKER_LOC_ALARM_AUTH_TO_ACTIVE);
            do_activate();
        } else if (awake_hold_expired()) {
            /* 대기 시간 경과, 방울 정상 → IDLE 복귀 */
            s_state = ALARM_STATE_IDLE;
            s_awake_hold_start_us = 0;
            ESP_LOGI(TAG, "AWAKE_HOLD → IDLE (%d초 경과)", AWAKE_HOLD_DURATION_SEC);
            /* ★ 30초 가설 검증용 마커 ★ */
            alive_marker_set_alarm_state((uint8_t)s_state);
            alive_marker_set_location(MARKER_LOC_ALARM_AUTH_AWAKE_HOLD_TO_IDLE);
            alive_marker_record_awake_hold_to_idle();
            /* LCD/태스크는 다음 CAN_SLEEP이 처리 */
        }
        break;
    }
}

bool alarm_authority_is_active(void)
{
    return (s_state == ALARM_STATE_ACTIVE || s_state == ALARM_STATE_AWAKE_HOLD);
}

alarm_authority_state_t alarm_authority_get_state(void)
{
    return s_state;
}

void alarm_authority_enter_awake_hold(void)
{
    /* ACTIVE가 더 높은 우선순위 — ACTIVE면 무시 */
    if (s_state == ALARM_STATE_ACTIVE) return;

    if (s_state == ALARM_STATE_AWAKE_HOLD) {
        /* 이미 AWAKE_HOLD → 타이머만 리셋 */
        s_awake_hold_start_us = esp_timer_get_time();
        ESP_LOGI(TAG, "AWAKE_HOLD 타이머 리셋 (%d초)", AWAKE_HOLD_DURATION_SEC);
        return;
    }

    /* IDLE → AWAKE_HOLD */
    s_state = ALARM_STATE_AWAKE_HOLD;
    s_awake_hold_start_us = esp_timer_get_time();
    ESP_LOGW(TAG, "IDLE → AWAKE_HOLD (GTT 변동, %d초 대기)", AWAKE_HOLD_DURATION_SEC);
    alive_marker_set_alarm_state((uint8_t)s_state);
    alive_marker_set_location(MARKER_LOC_ALARM_AUTH_TO_AWAKE_HOLD);

#if !DISABLE_ALARM_FOR_BATTERY_TEST
    /* LP Core GTT → device_data 동기화 */
    sync_lp_gtt_to_device_data();

    /* vTaskResume(ui_task) 제거 — CAN_SLEEP에서 suspend 안 하므로 불필요 */

    /* Phase 2 타이머 선제 중지 */
    tft_lcd_sleep_timer_stop();

    /* LCD ON */
    if (tft_is_lcd_sleeping()) {
        tft_lcd_on_and_wait(3000);
    }

    /* LCD ON 내부에서 Phase 2 재시작되므로 다시 중지 */
    tft_lcd_sleep_timer_stop();

    /* vTaskResume(data_update_task) 제거 — CAN_SLEEP에서 suspend 안 하므로 불필요 */
#endif
}

/* ── contracts API: iringer_lcd_sleep.h에 선언 ── */
bool iringer_is_alarm_active(void)
{
    return alarm_authority_is_active();
}