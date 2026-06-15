/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * Buzzer Module Header
 * IR_IRINGER_2.0_PINMAP.md 기준
 */
#ifndef IRINGER_BUZZER_H
#define IRINGER_BUZZER_H

#include "driver/gpio.h"
#include "driver/ledc.h"
#include "esp_err.h"
#include "iringer_alarm_config.h"

// 버저 핀 정의
#define BUZZER_PIN              GPIO_NUM_5   // IO5: SOUND (버저)

// 버저 PWM 설정
#define BUZZER_PWM_CHANNEL      LEDC_CHANNEL_3
#define BUZZER_PWM_TIMER        LEDC_TIMER_3
#define BUZZER_PWM_FREQ_HZ      2000  // 2kHz (가청 주파수)
#define BUZZER_PWM_DUTY_LOW     20    // 낮은 데시벨을 위한 낮은 듀티 사이클 (20%)

// ============================================
// 수액 종료 알람 소리 크기 설정
// ============================================
// 테스트 엔지니어가 수액 종료 알람 소리 크기를 퍼센트 단위로 조절할 수 있습니다.
// 변경 예시:
//   - 작은 소리: FLUID_END_ALARM_VOLUME_PERCENT = 30
//   - 중간 소리: FLUID_END_ALARM_VOLUME_PERCENT = 50 (기본값)
//   - 큰 소리: FLUID_END_ALARM_VOLUME_PERCENT = 80
//   - 최대 소리: FLUID_END_ALARM_VOLUME_PERCENT = 100
#define FLUID_END_ALARM_VOLUME_PERCENT    0   // 알람 소리 크기 (퍼센트 단위, 0~100, 기본값: 50%)
// 수액 종료 알람 "삐삐삐" 반복 주기는 iringer_alarm_config.h 의 ALARM_INTERVAL_5SEC_MS / ALARM_INTERVAL_10SEC_MS 로 결정됨 (메인에서 interval_ms 인자로 전달)
// 수액 종료 알람 비프 패턴: 삐(0.1초 ON) - 침묵(0.2초 OFF) - 삐 - 침묵 - 삐 - 침묵 - (interval_ms 후 반복)
#define FLUID_END_ALARM_BEEP_ON_MS        200  // 비프 ON 구간 (ms). 0.1초
#define FLUID_END_ALARM_BEEP_OFF_MS       100  // 비프 OFF 구간 (ms). 0.2초, 인터벌 포함
#define FLUID_END_ALARM_BEEP_COUNT        3    // 한 주기당 비프 횟수 (삐삐삐)

// 버저 초기화
esp_err_t buzzer_init(void);

// 버저 ON/OFF
void buzzer_set(bool on);

// 버저 듀티 사이클 설정 (0-100%)
void buzzer_set_duty(uint8_t duty);

// 부팅 시 짧은 버저 알림
void buzzer_beep_once(void);

// 수액 끝 알람 활성화. interval_ms = iringer_alarm_config.h 의 ALARM_INTERVAL_5SEC_MS / ALARM_INTERVAL_10SEC_MS
void buzzer_alarm_fluid_end_start(uint32_t interval_ms);

// 수액 끝 알람 반복 간격 갱신 (메인에서 1초마다 호출 권장)
void buzzer_alarm_fluid_end_set_interval(uint32_t interval_ms);

// 수액 끝 알람 중지
void buzzer_alarm_fluid_end_stop(void);

// 수액 끝 알람 활성 상태 확인
bool buzzer_alarm_fluid_end_is_active(void);

#endif // IRINGER_BUZZER_H

