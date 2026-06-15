/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LED 공통 설정(Contracts)
 * - HP Core(LED 모듈)와 LP Core(점멸/밝기 제어)가 공유하는 파라미터를 단일 정의한다.
 * - GPIO 핀 정의 등 하드웨어 종속 값은 각 드라이버/모듈 헤더에서 정의한다.
 */
#ifndef IRINGER_LED_CONFIG_H
#define IRINGER_LED_CONFIG_H

#include <stdint.h>

// LED 점등 파라미터
// 한 사이클 = INTERVAL(전체 주기). 그중 ON_DURATION만 켜고 나머지는 끔.
// 예: 1초 ON + 1초 OFF → INTERVAL=2000, ON_DURATION=1000
#define LED_BLINK_INTERVAL_MS               2000   // 비알람 시 점멸 주기 (ms). 전체 한 사이클 길이 (ON 구간 + OFF 구간)
#define LED_ON_DURATION_MS                  1000   // 한 번 점등 시 LED ON 유지 시간 (ms). INTERVAL보다 작아야 꺼지는 구간 있음
#define LED_BLINK_INTERVAL_US               ((LED_BLINK_INTERVAL_MS) * 1000ULL)
#define LED_ON_DURATION_US                  ((uint64_t)(LED_ON_DURATION_MS) * 1000ULL)

// LED 밝기 (0~100). PWM 미사용, 시간 기준 소프트웨어 PWM. 100=최대밝기
// PWM 주파수는 루프 갱신률(~1kHz)보다 낮게 두어야 함.
#define LED_PWM_FREQ_HZ                    100     // 밝기 PWM 주파수 (Hz). 100=부드러움, 1000=떨림 가능
#define LED_BRIGHTNESS_PERCENT              50

// LED 점멸 모드 (상수로 선택)
// 0: 주기적 깜빡임 (비알람 시 일정 간격 ON/OFF)
// 1: 물방울 카운트 시 깜빡임 (방울 감지 시에만 짧게 ON)
#define LED_BLINK_MODE_PERIODIC            0
#define LED_BLINK_MODE_ON_DROP             1
#define LED_BLINK_MODE                     LED_BLINK_MODE_ON_DROP   // 기본값: 주기적

// 물방울 카운트 시 깜빡임: 한 방울 감지 시 LED ON 유지 시간 (ms)
// LED_BLINK_MODE == LED_BLINK_MODE_ON_DROP 일 때만 사용
#define LED_ON_DROP_DURATION_MS            150

#endif // IRINGER_LED_CONFIG_H

