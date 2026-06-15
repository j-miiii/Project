/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 슬립 진입 조건 판단 구현
 */
#include "iringer_power.h"

bool power_can_enter_sleep(uint64_t elapsed_ms_since_first_downlink, uint32_t threshold_ms)
{
    return (elapsed_ms_since_first_downlink >= (uint64_t)threshold_ms);
}

