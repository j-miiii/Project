/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * Capacitor Sensor Module Header
 * 커패시터 센서 (수액 종료 감지) - LP Core 공유 메모리 래퍼
 */
#ifndef IRINGER_CAPACITOR_SENSOR_H
#define IRINGER_CAPACITOR_SENSOR_H

#include "driver/gpio.h"
#include "esp_err.h"

// 커패시터 센서 핀 정의 (GPIO7은 LP Core에서 제어)
#define CAPACITOR_SENSOR_PIN            GPIO_NUM_7   // IO7: 커패시터 센서 (LP GPIO)
#define CAPACITOR_SENSOR_FLUID_DETECTED_LEVEL  0     // LOW = 수액 감지 (true)

// 커패시터 센서 초기화
esp_err_t capacitor_sensor_init(void);

// 수액 주입 종료 여부 확인 (LP Core 공유 메모리에서 읽기)
bool capacitor_sensor_is_injection_complete(void);

// 수액 주입 종료 이벤트 확인 (한 번만 발생, 읽으면 자동 리셋)
bool capacitor_sensor_get_injection_complete_event(void);

// 센서 상태 리셋 (LP Core에 리셋 요청)
void capacitor_sensor_reset(void);

#endif // IRINGER_CAPACITOR_SENSOR_H

