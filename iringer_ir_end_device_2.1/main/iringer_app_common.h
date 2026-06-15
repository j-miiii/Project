/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * IRINGER App 공통 선언
 * main 파일 분리 시 공유되는 변수/타입/함수 프로토타입
 */
#ifndef IRINGER_APP_COMMON_H
#define IRINGER_APP_COMMON_H

#include <stdbool.h>
#include <stdint.h>
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h"
#include "iringer_domain_alarm.h"
#include "iringer_alarm_config.h"

#ifdef __cplusplus
extern "C" {
#endif

// 앱 상태 머신 (30일 PoC 체크리스트 #7)
typedef enum {
    APP_INIT,
    APP_IDLE,
    APP_JOIN_WAIT,
    APP_REPORT,
    APP_DOWNLINK_WAIT,
    APP_LCD_SLEEP_DELAY,
    APP_SLEEP,
    APP_ERROR,
    APP_RECOVERY
} app_state_t;

// 수액 종료 알람 조건 타입 (Domain iringer_alarm_condition_t와 동일, Application 계층용 별칭)
typedef iringer_alarm_condition_t alarm_condition_t;

// 하위 호환용 매크로 (기존 ALARM_CONDITION_* 사용처 유지)
#define ALARM_CONDITION_NONE    IRINGER_ALARM_CONDITION_NONE
#define ALARM_CONDITION_5SEC    IRINGER_ALARM_CONDITION_5SEC
#define ALARM_CONDITION_10SEC   IRINGER_ALARM_CONDITION_10SEC

// 리포트 전송 요청
typedef struct {
    bool force_report;
} report_request_t;

// 공유 변수 (main에서 정의)
extern QueueHandle_t report_queue;
extern EventGroupHandle_t sleep_wait_event_group;

#define EVENT_BIT_DOWNLINK_RECEIVED (1 << 0)
#define EVENT_BIT_WAKEUP            (1 << 1)
#define EVENT_BIT_EMERGENCY_REPORT   (1 << 2)   /* LP Core 비상 wakeup 시 즉시 리포트 트리거 */

/* Sleep/Wake 진단 로깅 (1: 활성화, 0: 비활성화)
 * UART 연결 시: PM lock 목록이 시리얼에 출력됨
 * UART 분리 시: RAM에 wakeup cause/duration 기록 → UART 재연결 후 자동 출력 */
#define SLEEP_WAKE_LOGGING  0

// 서버 시간 동기화
extern uint32_t g_server_time_base;
extern int64_t g_boot_time_us;
extern bool g_server_time_synced;
extern uint64_t g_last_time_read_us;

// 첫 다운링크 수신
extern uint64_t first_downlink_time_us;
extern bool first_downlink_time_recorded;
extern uint32_t first_downlink_retry_count;

#define FIRST_DOWNLINK_RETRY_INTERVAL_MS 3000


// 메인 루프·데이터 업데이트 태스크 타이밍 상수
#define NETWORK_JOIN_WAIT_TIMEOUT_MS        60000   // 네트워크 조인 대기 최대 시간
#define NETWORK_JOIN_WAIT_STEP_MS           1000    // 조인 대기 시 폴링 간격
#define NETWORK_JOIN_STATUS_LOG_INTERVAL_MS 5000    // 조인 대기 중 상태 로그 간격

// Self-healing: 스티어링/조인 재시도 exponential backoff (재조인 완화)
#define RECONNECT_BACKOFF_BASE_MS           3000    // 초기 대기 (3초)
#define RECONNECT_BACKOFF_MAX_MS            30000   // 최대 대기 (30초)
#define RECONNECT_BACKOFF_MULTIPLIER        2       // 배수 (3s->6s->12s->24s->30s)

// 상태 머신 ERROR/RECOVERY (30일 PoC #7)
#define APP_ERROR_JOIN_TIMEOUT_THRESHOLD    1       // 조인 타임아웃 1회 시 ERROR 진입
#define APP_RECOVERY_DELAY_MS               10000   // ERROR 후 RECOVERY 전 대기 (10초)
#define DOWNLINK_WAIT_TIMEOUT_MS            5000    // 다운링크 수신 대기 최대 시간
#define ALARM_ACTIVE_SLEEP_RETRY_DELAY_MS   5000    // 알람 울리는 중 슬립 재확인 대기
#define TFT_LCD_OFF_WAIT_MS                 5000    // LCD OFF 완료 대기 시간
#define DATA_UPDATE_TASK_INTERVAL_MS        1000    // GTT·LCD 업데이트 주기 (1초)
#define CAPACITOR_LOG_INTERVAL_MS           5000    // 커패시터 센서 로그 주기
#define ALARM_CHECK_INTERVAL_MS             100     // 알람 조건 확인 주기
#define STATUS_LOG_INTERVAL_MS              5000    // 상태 로그 주기
#define TIME_CLUSTER_REREQUEST_INTERVAL_US  5000000ULL  // Time Cluster 재요청 간격 (5초)
#define GTT_CHANGE_THRESHOLD_PERCENT        30.0f   // GTT 변화 감지 임계값 (%)

// 부팅 시간 (알람 로직용)
extern uint64_t device_boot_time_us;

// 첫 다운링크 수신 후 경과 시간(ms). 미수신 시 UINT64_MAX 반환
uint64_t get_elapsed_ms_since_first_downlink(void);

// 네트워크 상태
extern volatile bool zb_network_joined;
extern volatile bool should_send_on_wakeup;
extern bool s_wakeup_for_report_only;

// App Globals 동기화 (레이스 컨디션 방지 - first_downlink_*, zb_network_joined, g_server_time_* 등)
void app_globals_init(void);
bool app_globals_lock(void);   /* 성공 true, 타임아웃 시 false */
void app_globals_unlock(void);

// Sleep 모듈 (iringer_app_sleep.c)
bool app_wait_for_downlink(uint32_t timeout_ms);

// 헬퍼 함수 (iringer_app_helpers.c)
void create_serial_number(char serial_number[4]);
uint16_t get_ed_parent_addr(void);
/** esp_zb_lock 보유 중만 호출. PARENT가 2개 이상이면 LQI>0인 행 중 LQI 최대, 없으면 전체 중 LQI 최대. */
uint16_t iringer_ed_pick_parent_short_addr_under_zb_lock(uint8_t *out_selected_lqi);
void iringer_update_gtt_settings(float ordered_gtt, float min_gtt, float max_gtt);
bool check_gtt_change_threshold(float prev_gtt, float current_gtt, float threshold_percent);
bool check_gtt_out_of_range(float gtt);
bool check_need_to_update(float drop_speed);
uint8_t calculate_injection_percent(float injected_amount, float r_volume_max);
alarm_condition_t check_alarm_condition(void);

#ifdef __cplusplus
}
#endif

#endif // IRINGER_APP_COMMON_H
