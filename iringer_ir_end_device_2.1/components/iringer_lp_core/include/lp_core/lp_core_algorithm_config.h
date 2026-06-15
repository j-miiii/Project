/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LP Core 알고리즘 파라미터 설정
 * 엔지니어가 샘플링 주기와 각 카운트 값을 독립적으로 설정할 수 있도록 상수로 정의
 */

#ifndef LP_CORE_ALGORITHM_CONFIG_H
#define LP_CORE_ALGORITHM_CONFIG_H

// LED 점등 파라미터는 contracts에서 단일 정의 (HP/LP 공통)
#include "iringer_led_config.h"

// 적외선 발광/수광부 샘플링 주파수 설정
// 목표 샘플링 주파수 (Hz 단위)
// 이 값으로 설정하면 실제 샘플링 주파수가 이 값에 맞춰집니다
// 예: 1000 = 1000Hz (1ms 주기)
#define LP_ALGO_TARGET_SAMPLE_RATE_HZ    1000   // 목표 샘플링 주파수 (Hz)
// 샘플링 주기 (마이크로초). lp_core_shared_memory_init / lp_core_start 등에서 초기값으로 사용
#define LP_ALGO_SAMPLE_PERIOD_US         (1000000 / LP_ALGO_TARGET_SAMPLE_RATE_HZ)   // 1000 us = 1 ms

// 발광부 안정화 딜레이 (마이크로초)
// 발광부를 켠 후 수광부를 읽기 전까지 필요한 안정화 대기 시간
// HP Core 80MHz와 LP Core 20MHz 차이를 고려한 값
// 이 값이 클수록 안정적이지만 샘플링 주기가 느려집니다
// 주의: 이 값은 하드웨어 테스트를 통해 측정된 필수 값입니다 (변경 시 센서 오류 가능)
#define LP_ALGO_IR_STABILIZATION_DELAY_US 250   // 발광부 안정화 딜레이 (μs)

// IR 발광부 동작 모드 (상수로 선택)
// 0: 토글 모드 - 샘플마다 발광 ON → 안정화 대기 → 수광 읽기 → 발광 OFF (송수신 타이밍 동기화)
// 1: 상시 ON 모드 - 발광부 한 번 켠 뒤 수광부만 주기적으로 읽기 (전력/수명 트레이드오프 가능)
#define LP_ALGO_IR_TX_ALWAYS_ON            0   // 0: 토글, 1: 상시 ON

// 실제 샘플링 주기는 루프 끝에서 자동 보정됩니다.
// 샘플링 조건 체크 주기는 코드에서 타겟 주기에서 딜레이만 제외하여 계산합니다.
// 계산식: (1000000 / LP_ALGO_TARGET_SAMPLE_RATE_HZ) - LP_ALGO_IR_STABILIZATION_DELAY_US
// 예: (1000000 / 1000) - 250 = 1000 - 250 = 750μs
// 
// 주의: 샘플링 조건 체크 주기는 샘플링 시작 시점을 결정하는 데만 사용되며,
// 실제 샘플링 주기는 루프 끝에서 자동 보정으로 정확히 타겟 주기(1000μs = 1000Hz)가 됩니다.
// 루프 끝에서 실제 경과 시간을 측정하고 타겟 주기만큼 경과했는지 확인하여
// 부족하면 딜레이를 자동으로 추가하므로, 별도 상수 정의가 불필요합니다.

// HIGH 신호 감지 파라미터
#define LP_ALGO_HIGH_COUNT_THRESHOLD     2    // HIGH 구간 인식 최소 카운트 (샘플 수)
                                                // 이 값 이상이면 HIGH 구간으로 인식하고 디바운싱 후 LOW 감지 시작
#define LP_ALGO_HIGH_COUNT_MAX           4    // HIGH 카운트 상한값 (샘플 수)
                                                // HIGH 신호가 계속 들어와도 카운트가 이 값을 넘지 않도록 제한
                                                // 목적: HIGH 구간은 짧은 시간이므로 비정상적으로 큰 값(노이즈/오동작) 방지
                                                // THRESHOLD(2)만 있으면 HIGH 구간 인식이 가능하지만,
                                                // MAX를 두는 이유는 노이즈로 인한 무한 증가 방지 및 메모리 보호

// LOW 신호 감지 파라미터
// 엔지니어가 샘플링 주기에 맞춰 적절한 값을 설정
// 계산 공식: 카운트 값 = 원하는 시간(ms) / 샘플링 주기(ms)
// 예: 1000Hz (1ms 주기)에서 50ms를 원한다면 50으로 설정
#define LP_ALGO_LOW_COUNT_THRESHOLD      10   // 방울 감지 최소 LOW 카운트 (샘플 수)

// 디바운싱 파라미터 (물방울 감지 3단계 상태머신)
// HIGH 구간 확정 후, 신호를 무시하는 샘플 수. 전이 직후 떨림/노이즈 제거용.
// 계산: ignore_count = ceil(ignore_time_ms / sample_period_ms). 5~20ms 권장 → 5~20 샘플 @1ms
#define LP_ALGO_DEBOUNCE_IGNORE_COUNT     100   // HIGH 확정 후 신호 무시 샘플 수 (튜닝 가능)
// GTT 계산 파라미터
#define LP_ALGO_GTT_CALC_INTERVAL_US     1000000  // GTT 계산 주기 (1초)
#define LP_ALGO_GTT_TIMEOUT_SEC          30   // GTT 타임아웃 (초): 이 값만 변경하면 됨
#define LP_ALGO_GTT_TIMEOUT_US           ((uint32_t)(LP_ALGO_GTT_TIMEOUT_SEC) * 1000000UL)
#define LP_ALGO_GTT_MAX                  300     // 최대 GTT (1분당 방울 수): 이 값만 변경하면 됨

// GTT 안정화 알고리즘 파라미터 (흔들림 방지)
#define LP_ALGO_GTT_STABLE_ENTRY_COUNT         5    // [수정] 안정화 '진입' 횟수 (기존처럼 3회 유지)
#define LP_ALGO_GTT_STABLE_EXIT_COUNT          1    // [신규] 안정화 '해제' 횟수 (1회만 벗어나도 즉시 해제)
#define LP_ALGO_GTT_STABLE_VARIANCE_PERCENT    30   // [12차] 안정화 변동 허용 범위 (±25%), 15초 윈도우와 연동

// drops_stopped true→false 전이 최소 GTT (이 값 미만은 0gtt 취급)
// 노이즈 드롭 방어: 1~3 gtt는 실제 수액 투여로 보지 않음
#define LP_ALGO_DROPS_STOPPED_MIN_GTT          2

// 알람 GTT 임계값: 이 값 미만이면 수액 정지로 판정하여 알람 발동
// LCD 및 서버 리포트에서도 이 값 미만이면 0으로 표시
// LP_ALGO_DROPS_STOPPED_MIN_GTT와 같은 값이지만 의미가 다름:
//   - DROPS_STOPPED_MIN_GTT: LP Core drops_stopped 플래그 노이즈 방어용
//   - ALARM_GTT_THRESHOLD: 알람 판정 기준 (alarm_authority, 화면 표시, 서버 리포트)
#define LP_ALGO_ALARM_GTT_THRESHOLD            2

// 수액 종료 감지 파라미터
// 이 임계값 이상에서만 수액 종료 감지를 시작함
// 예: 95% 이상이 되면 그때부터 수액 종료 감지 시작 (95% 미만에서는 수액 종료 감지 안 함)
#define LP_ALGO_INJECTION_COMPLETE_THRESHOLD_PERCENT  95  // 수액 투입률 임계값 (%)
                                                          // 이 값 이상에서만 수액 종료 감지 시작
                                                          // 이 값 미만에서는 수액 종료 감지 안 함

#endif // LP_CORE_ALGORITHM_CONFIG_H
