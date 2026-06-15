/*
 * iringer_alive_marker.h — RTC slow memory 기반 alive marker
 *
 * 목적:
 *   - 사망(원인 미상 freeze)이 일어나면 hard reset → 부팅 시 이전 마커를 prominently
 *     출력해서 정확히 어디서/언제 죽었는지 추적 가능
 *   - RTC_NOINIT_ATTR 사용: 전원 OFF 시에만 사라지고, soft reset / esptool flash에는 살아남음
 *
 * 사용:
 *   1. app_main 시작 시 alive_marker_init_and_dump_previous() 1회 호출
 *   2. 의심 가는 위치들에서 alive_marker_set_location(MARKER_LOC_*) 호출
 *      (1초 주기/30초 주기/이벤트 기반 등 자유)
 *   3. 사망 → 수동 reset → boot 시 이전 마커가 ESP_LOGE로 출력됨
 *
 * 매크로 IRINGER_ALIVE_MARKER_ENABLE=0이면 모든 함수가 no-op 인라인.
 *
 * 위치: components/iringer_contracts/include/iringer_alive_marker.h
 * (.c 구현은 main/iringer_alive_marker.c — main 컴포넌트에서 심볼 제공)
 */
#ifndef IRINGER_ALIVE_MARKER_H
#define IRINGER_ALIVE_MARKER_H

#include <stdint.h>
#include <stdbool.h>
#include "iringer_diag.h"

/* ── 마커 위치 enum ──
 * 새 위치를 추가할 때는 여기 끝에만 추가 (기존 값 유지). */
typedef enum {
    MARKER_LOC_NONE = 0,
    MARKER_LOC_APP_MAIN_START,
    MARKER_LOC_APP_MAIN_END,
    MARKER_LOC_DATA_UPDATE_TASK,
    MARKER_LOC_MAIN_LOOP_TOP,
    MARKER_LOC_MAIN_LOOP_BEFORE_REPORT,
    MARKER_LOC_MAIN_LOOP_AFTER_REPORT,
    MARKER_LOC_MAIN_LOOP_END,
    MARKER_LOC_CAN_SLEEP_HANDLER_ENTER,
    MARKER_LOC_CAN_SLEEP_PREP_DONE,
    MARKER_LOC_CAN_SLEEP_BEFORE_SLEEP_NOW,
    MARKER_LOC_CAN_SLEEP_AFTER_SLEEP_NOW,
    MARKER_LOC_CAN_SLEEP_HANDLER_EXIT,
    MARKER_LOC_TFTINIT_COLD_ENTER,
    MARKER_LOC_TFTINIT_COLD_EXIT,
    MARKER_LOC_TFTINIT_WARM_ENTER,
    MARKER_LOC_TFTINIT_WARM_EXIT,
    MARKER_LOC_TFT_DISPLAY_ON_ENTER,
    MARKER_LOC_TFT_DISPLAY_ON_EXIT,
    MARKER_LOC_TFT_DISPLAY_OFF_ENTER,
    MARKER_LOC_TFT_DISPLAY_OFF_EXIT,
    MARKER_LOC_ALARM_AUTH_TO_IDLE,
    MARKER_LOC_ALARM_AUTH_TO_ACTIVE,
    MARKER_LOC_ALARM_AUTH_TO_AWAKE_HOLD,
    MARKER_LOC_ALARM_AUTH_AWAKE_HOLD_TO_IDLE,    /* ★ 사망 직전 트리거 ★ */
    MARKER_LOC_LP_CORE_WAKE_RECEIVED,
    MARKER_LOC__MAX                              /* sentinel */
} alive_marker_location_t;

#if IRINGER_ALIVE_MARKER_ENABLE

/* ── boot 시 1회 호출: 이전 부팅 마커 출력 + 새 부팅 시작 ── */
void alive_marker_init_and_dump_previous(void);

/* ── 현재 위치 마커 갱신 (제일 자주 호출되는 함수) ──
 *   추가 메타데이터(iter, app_st, alarm_st, lcd_st)는 다른 setter로 갱신 */
void alive_marker_set_location(alive_marker_location_t loc);

/* ── 메타데이터 갱신 ── */
void alive_marker_set_main_loop_iter(uint32_t iter);
void alive_marker_set_app_state(uint8_t app_state);
void alive_marker_set_alarm_state(uint8_t alarm_state);
void alive_marker_set_lcd_sleeping(bool sleeping);

/* ── 이벤트 카운터 증가 ── */
void alive_marker_inc_can_sleep_count(void);
void alive_marker_inc_sleep_now_enter(void);
void alive_marker_inc_sleep_now_exit(void);
void alive_marker_inc_cold_count(void);
void alive_marker_inc_warm_count(void);
void alive_marker_inc_safety_net_1_fires(void);

/* ── AWAKE_HOLD → IDLE 전이 시각 기록 (30초 가설 검증용) ── */
void alive_marker_record_awake_hold_to_idle(void);

#else  /* IRINGER_ALIVE_MARKER_ENABLE == 0: 모든 함수 no-op */

static inline void alive_marker_init_and_dump_previous(void) {}
static inline void alive_marker_set_location(alive_marker_location_t loc) { (void)loc; }
static inline void alive_marker_set_main_loop_iter(uint32_t iter) { (void)iter; }
static inline void alive_marker_set_app_state(uint8_t app_state) { (void)app_state; }
static inline void alive_marker_set_alarm_state(uint8_t alarm_state) { (void)alarm_state; }
static inline void alive_marker_set_lcd_sleeping(bool sleeping) { (void)sleeping; }
static inline void alive_marker_inc_can_sleep_count(void) {}
static inline void alive_marker_inc_sleep_now_enter(void) {}
static inline void alive_marker_inc_sleep_now_exit(void) {}
static inline void alive_marker_inc_cold_count(void) {}
static inline void alive_marker_inc_warm_count(void) {}
static inline void alive_marker_inc_safety_net_1_fires(void) {}
static inline void alive_marker_record_awake_hold_to_idle(void) {}

#endif /* IRINGER_ALIVE_MARKER_ENABLE */

#endif /* IRINGER_ALIVE_MARKER_H */
