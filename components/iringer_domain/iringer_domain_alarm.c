/*
 * SPDX-FileCopyrightText: 2026 Sinsungtech
 *
 * SPDX-License-Identifier: Proprietary
 *
 * 도메인 로직: 수액 종료 알람 판단 (순수 로직)
 */
#include "iringer_domain_alarm.h"

uint8_t iringer_calc_injection_percent(float injected_amount_ml, float r_volume_max_ml)
{
    if (r_volume_max_ml <= 0.0f) {
        return 0;
    }
    float percent = (injected_amount_ml / r_volume_max_ml) * 100.0f;
    if (percent <= 0.0f) {
        return 0;
    }
    if (percent >= 255.0f) {
        return 255;
    }
    return (uint8_t)(percent + 0.5f);
}

iringer_alarm_condition_t iringer_eval_alarm_condition(uint64_t uptime_minutes,
                                                       uint8_t injection_percent,
                                                       bool is_gtt_zero,
                                                       bool is_capacitor_empty,
                                                       uint8_t injection_threshold_percent,
                                                       uint32_t warmup_minutes,
                                                       bool enable_injection_complete_alarm)
{
    // 조건 1: 워밍업 미경과
    if (uptime_minutes < (uint64_t)warmup_minutes) {
        return IRINGER_ALARM_CONDITION_NONE;
    }

    // 조건 2: 투여율 임계값(95%) 이상 AND (0gtt OR 센서 물없음) — enable_injection_complete_alarm이 0이면 비활성
    if (enable_injection_complete_alarm &&
        injection_percent >= injection_threshold_percent &&
        (is_gtt_zero || is_capacitor_empty)) {
        return IRINGER_ALARM_CONDITION_5SEC;
    }

    // 조건 3: 0gtt만
    if (is_gtt_zero) {
        return IRINGER_ALARM_CONDITION_10SEC;
    }

    return IRINGER_ALARM_CONDITION_NONE;
}

