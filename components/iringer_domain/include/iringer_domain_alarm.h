/*
 * SPDX-FileCopyrightText: 2026 Sinsungtech
 *
 * SPDX-License-Identifier: Proprietary
 *
 * 도메인 로직: 수액 종료 알람 판단 (순수 로직)
 * - ESP-IDF/FreeRTOS/드라이버 의존 금지
 * - 입력(상태/측정/설정) → 출력(알람 조건)만 수행
 */
#ifndef IRINGER_DOMAIN_ALARM_H
#define IRINGER_DOMAIN_ALARM_H

#include <stdbool.h>
#include <stdint.h>

typedef enum {
    IRINGER_ALARM_CONDITION_NONE = 0,
    IRINGER_ALARM_CONDITION_5SEC,
    IRINGER_ALARM_CONDITION_10SEC,
} iringer_alarm_condition_t;

// 투여율(%) 계산 (반올림)
uint8_t iringer_calc_injection_percent(float injected_amount_ml, float r_volume_max_ml);

// 알람 조건 판단
// - uptime_minutes: 부팅 후 경과 시간(분)
// - injection_threshold_percent: 예) 95
// - enable_injection_complete_alarm: 0이면 투여율 95% 이상일 때 알람(5초) 비활성 (iringer_alarm_config.h ENABLE_ALARM_AT_INJECTION_COMPLETE)
iringer_alarm_condition_t iringer_eval_alarm_condition(uint64_t uptime_minutes,
                                                       uint8_t injection_percent,
                                                       bool is_gtt_zero,
                                                       bool is_capacitor_empty,
                                                       uint8_t injection_threshold_percent,
                                                       uint32_t warmup_minutes,
                                                       bool enable_injection_complete_alarm);

#endif // IRINGER_DOMAIN_ALARM_H

