/*
 * SPDX-FileCopyrightText: 2026 Sinsungtech
 *
 * SPDX-License-Identifier: Proprietary
 *
 * 도메인 로직: GTT 변화/범위 판단 (순수 로직)
 * - ESP-IDF/FreeRTOS/드라이버 의존 금지
 */
#ifndef IRINGER_DOMAIN_GTT_H
#define IRINGER_DOMAIN_GTT_H

#include <stdbool.h>

// 변화율 임계치(threshold_percent) 이상 변화 여부
bool iringer_is_gtt_changed_over_threshold(float prev_gtt, float current_gtt, float threshold_percent);

// GTT 범위 이탈 여부
// - min/max가 유효(>0)하면 그 범위를 사용
// - 그렇지 않으면 ordered_gtt 기준 ±50% 기본 범위를 사용
bool iringer_is_gtt_out_of_range(float gtt, float ordered_gtt, float min_gtt, float max_gtt);

#endif // IRINGER_DOMAIN_GTT_H

