#pragma once

#include <stdbool.h>
#include <stdint.h>

/* ── Alarm Authority: 알람 판정·출력의 유일한 권위자 ──
 * 부저, LCD, 태스크 resume, LP Core LED를 이 모듈만 직접 제어한다.
 * 외부에서는 alarm_authority_update() / alarm_authority_enter_awake_hold()만 호출.
 */

/* 슬립에서 GTT 변동 깨어남 후 LCD ON 유지 시간 (초) */
#define AWAKE_HOLD_DURATION_SEC  30

/* ACTIVE → IDLE 전이에 필요한 gtt >= THRESHOLD 연속 유지 시간 (초)
 * 노이즈 방울 방어: 잠깐 gtt가 올라갔다 내려가는 것으로 알람이 해제되지 않도록 */
#define ALARM_RECOVERY_SUSTAIN_SEC  3

typedef enum {
    ALARM_STATE_IDLE,        /* 정상 — CAN_SLEEP 허용 */
    ALARM_STATE_ACTIVE,      /* 0gtt 알람 — CAN_SLEEP 거절, 부저 ON */
    ALARM_STATE_AWAKE_HOLD,  /* GTT 변동 깨어남 — CAN_SLEEP 거절, 부저 OFF, 2분 대기 */
} alarm_authority_state_t;

/* 초기화 (app_main에서 1회 호출) */
void alarm_authority_init(void);

/* 상태 갱신 — 아래 3곳에서 호출:
 *   1) EMERGENCY_REPORT 블록 (main_loop)
 *   2) data_update_task 알람 체크 구간
 *   3) 보조 알람 체크 (#6, 리포트 전송 시)
 *
 * 내부에서 부저/LCD/태스크/LP Core LED를 직접 제어한다.
 * 호출자는 부저·LCD를 절대 직접 건드리지 않는다.
 */
void alarm_authority_update(void);

/* CAN_SLEEP 조건 3: ACTIVE 또는 AWAKE_HOLD이면 true → sleep 거절 */
bool alarm_authority_is_active(void);

/* 현재 상태 조회 (디버그/로그용) */
alarm_authority_state_t alarm_authority_get_state(void);

/* GTT 변동으로 깨어났으나 0gtt가 아닌 경우: 2분간 LCD ON 유지
 * ACTIVE보다 우선순위 낮음 — ACTIVE면 무시됨 */
void alarm_authority_enter_awake_hold(void);