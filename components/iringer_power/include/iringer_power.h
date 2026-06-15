/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 슬립 진입 조건 판단 (메인 루프에서 사용)
 */
#ifndef IRINGER_POWER_H
#define IRINGER_POWER_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// 첫 다운링크 수신 후 경과 시간이 threshold_ms 이상이면 슬립 진입 가능
// elapsed_ms_since_first_downlink: 첫 다운링크 수신 후 경과 시간 (ms)
// threshold_ms: 슬립 진입 허용 최소 경과 시간 (ms, 예: LCD_SLEEP_DELAY_MS)
bool power_can_enter_sleep(uint64_t elapsed_ms_since_first_downlink, uint32_t threshold_ms);

#ifdef __cplusplus
}
#endif

#endif // IRINGER_POWER_H

