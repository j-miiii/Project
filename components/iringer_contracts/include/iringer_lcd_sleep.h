/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LCD 슬립 구간 판단 API (TFT 모듈이 메인 앱 헤더 없이 사용하기 위한 최소 헤더)
 *
 * Contracts 레이어로 이동:
 * - 구현은 메인 앱에서 제공하지만, 선언은 컴포넌트 간 공용 계약이므로 contracts에 둔다.
 */
#ifndef IRINGER_LCD_SLEEP_H
#define IRINGER_LCD_SLEEP_H

#include <stdbool.h>

/* ── LCD Sleep/Wake 스트레스 테스트 모드 ──
 * 1로 설정하면: 알람(0GTT) 중에도 10초 후 LCD OFF → 재알람 → LCD ON → 반복.
 * 오실로스코프로 GPIO 글리치를 잡기 위한 자동 반복 모드.
 * 릴리스 빌드에서는 반드시 0으로 둘 것. */
#ifndef LCD_SLEEP_WAKE_STRESS_TEST
#define LCD_SLEEP_WAKE_STRESS_TEST 0
#endif

// LCD_SLEEP_DELAY 구간 여부: 첫 다운링크 수신 후 LCD_SLEEP_DELAY_MS 미경과 시 true
// (Phase 2 타이머 우선순위 판단용, 구현은 iringer_ir_end_device_2.1.c)
bool iringer_is_lcd_sleep_delay_period(void);

// 알람 활성 여부: alarm_authority가 ACTIVE 또는 AWAKE_HOLD이면 true
// (Phase 2 LCD 타이머 콜백에서 알람 중 LCD OFF 방지용, 구현은 iringer_alarm_authority.c)
bool iringer_is_alarm_active(void);

#endif // IRINGER_LCD_SLEEP_H