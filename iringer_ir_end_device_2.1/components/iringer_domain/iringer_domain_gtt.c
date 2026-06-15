/*
 * SPDX-FileCopyrightText: 2026 Sinsungtech
 *
 * SPDX-License-Identifier: Proprietary
 *
 * 도메인 로직: GTT 변화/범위 판단 (순수 로직)
 */
#include "iringer_domain_gtt.h"

static float absf(float x) { return x < 0.0f ? -x : x; }

bool iringer_is_gtt_changed_over_threshold(float prev_gtt, float current_gtt, float threshold_percent)
{
    // 이전 값이 0이면 변화율 계산 불가 (초기 상태)
    if (prev_gtt <= 0.0f) {
        // 0에서 0이 아닌 값으로 변하면 변화로 간주
        return (current_gtt > 0.0f);
    }

    // 현재 값이 0이면 변화로 간주 (정지 상태)
    if (current_gtt <= 0.0f) {
        return true;
    }

    float change_percent = absf(current_gtt - prev_gtt) / prev_gtt * 100.0f;
    return (change_percent >= threshold_percent);
}

bool iringer_is_gtt_out_of_range(float gtt, float ordered_gtt, float min_gtt, float max_gtt)
{
    // GTT가 0이면 범위 체크를 하지 않음 (초기 상태 또는 측정 없음)
    if (gtt <= 0.0f) {
        return false;
    }

    // 서버 설정값이 유효한 경우 (0이 아닌 경우) 범위 체크 수행
    if (min_gtt > 0.0f && max_gtt > 0.0f) {
        return (gtt < min_gtt || gtt > max_gtt);
    }

    // 서버 설정값이 없는 경우 기본 범위 체크 (처방 속도의 ±50%)
    if (ordered_gtt > 0.0f) {
        float min_allowed = ordered_gtt * 0.5f;
        float max_allowed = ordered_gtt * 1.5f;
        return (gtt < min_allowed || gtt > max_allowed);
    }

    return false;
}

