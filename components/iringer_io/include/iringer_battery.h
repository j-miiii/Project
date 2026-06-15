/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * Battery Management Module Header
 * IR_IRINGER_2.0_PINMAP.md 기준
 */
#ifndef IRINGER_BATTERY_H
#define IRINGER_BATTERY_H

#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_err.h"

// 배터리 핀 정의 (새로운 하드웨어 기판 v2.1 기준)
#define BAT_AD_PIN           GPIO_NUM_4   // IO4: BAT_AD (배터리 잔량 ADC)
#define BAT_MEASURE_PIN       GPIO_NUM_15  // IO15: BAT_MEASURE (배터리 측정 기능 ON: LOW)

// 기존 호환성을 위한 별칭 (사용 중단 예정)
// 주의: BAT_CON_PIN은 iringer_ir_end_device_2.1.h에서 정의됨 (중복 정의 방지)
#ifndef BAT_CON_PIN
#define BAT_CON_PIN          BAT_MEASURE_PIN  // IO15: BAT_MEASURE (별칭)
#endif

// 배터리 전압 범위 (기존 호환성 유지)
#define MAX_VOL              4200  // 최대 전압 (mV)
#define MIN_VOL              3100  // 최소 전압 (mV)

// 배터리 ADC 원시값 기준 매크로 (실제 하드웨어 실측값 적용 완료)
#define BATTERY_ADC_100_PCT  2035  // 4.2V 인가 시 실측 ADC
#define BATTERY_ADC_90_PCT   1940  // 4.0V 인가 시 실측 ADC
#define BATTERY_ADC_10_PCT   1700  // 3.5V 인가 시 실측 ADC
#define BATTERY_ADC_0_PCT    1453  // 3.0V 인가 시 실측 ADC

// 배터리 측정 주기 (저전력 최적화)
#define BATTERY_MEASURE_INTERVAL_MS  30000  // 30초 (ADC 전력 절감)

// 배터리 초기화
esp_err_t battery_init(void);

// Light Sleep 복귀 후 ADC 재설정 (포화 오류 방지)
void battery_adc_reinit(void);

// 배터리 레벨 읽기 (0-100%)
uint8_t battery_get_level(void);

// 배터리 전압 읽기 (mV)
uint32_t battery_get_voltage(void);


#endif // IRINGER_BATTERY_H

