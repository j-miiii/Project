/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 수액 종료 알람 설정(Contracts)
 * - 알람 판단(도메인)과 알람 출력(버저)이 공통으로 사용하는 파라미터를 단일 정의한다.
 */
#ifndef IRINGER_ALARM_CONFIG_H
#define IRINGER_ALARM_CONFIG_H

// 부팅 후 워밍업 시간(분): 이 시간 이전에는 알람 조건을 평가하더라도 알람을 울리지 않는다.
#define ALARM_WARMUP_TIME_MINUTES           1

// 알람 반복 간격(밀리초)
#define ALARM_INTERVAL_5SEC_MS              5000
#define ALARM_INTERVAL_10SEC_MS             10000

// 배터리 수명 테스트 모드 설정 (외부 주입 또는 기본값)
// (1로 설정 시 수액 종료 감지로 인한 알람 및 LCD 켜짐 비활성화)
#ifndef DISABLE_ALARM_FOR_BATTERY_TEST
#define DISABLE_ALARM_FOR_BATTERY_TEST 0
#endif

// 투여율 95% 이상일 때 수액 종료 알람(5초 주기) 활성 여부
// 1 = 활성 (95% 이상 + 0gtt/센서 물없음 시 알람), 0 = 비활성 (95% 미만에서만 울리는 조건 끔)
#ifndef ENABLE_ALARM_AT_INJECTION_COMPLETE
#define ENABLE_ALARM_AT_INJECTION_COMPLETE 0
#endif

#endif // IRINGER_ALARM_CONFIG_H

