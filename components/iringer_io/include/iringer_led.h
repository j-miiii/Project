/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LED 제어 모듈
 * GPIO1을 사용하여 PWR LED 제어 (HP Core에서 직접 제어)
 */

#ifndef IRINGER_LED_H
#define IRINGER_LED_H

#include <stdbool.h>
#include "driver/gpio.h"
#include "esp_err.h"
#include "iringer_led_config.h"

#ifdef __cplusplus
extern "C" {
#endif

// LED_PWR (IO1) 제어 - HP Core에서 직접 제어
// Sleep 시 LOW, Wakeup 시 HIGH (듀티비 없음, 단순 ON/OFF)
#define LED_PWR_GPIO GPIO_NUM_1  // GPIO1: PWR LED

/**
 * @brief LED 초기화
 * GPIO1을 출력 모드로 초기화하여 HP Core에서 직접 제어
 * 초기값: HIGH (Wakeup 시)
 */
void led_pwr_init(void);

/**
 * @brief LED ON/OFF 설정
 * @param on true = HIGH (ON), false = LOW (OFF)
 */
void led_pwr_set(bool on);

#ifdef __cplusplus
}
#endif

#endif // IRINGER_LED_H

