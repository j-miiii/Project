/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LP Core 메인 루프 (LP Core에서 실행되는 코드)
 * ESP32-C6의 LP Core에서 실행되는 메인 루프
 * IR 센서 샘플링 및 알고리즘 처리 (LP_ALGO_SAMPLE_PERIOD_US 설정값 사용)
 * 적외선 발광부(GPIO6)와 수광부(GPIO3) 동기화 샘플링
 * 
 * 주의: 이 파일은 LP Core에서 실행되므로 제한된 API만 사용 가능
 * - LP GPIO API 사용 (GPIO3, GPIO6은 LP GPIO)
 * - LP 타이머 사용
 * - 공유 메모리 접근 (RTC 메모리)
 * 
 * 개선 사항:
 * - 샘플링 주기: LP_ALGO_SAMPLE_PERIOD_US 설정값 사용
 * - GTT 계산: 정수 나눗셈 → Float 연산으로 변경 (양자화 효과 제거)
 * - 알고리즘 파라미터: 상수로 정의하여 엔지니어가 쉽게 조절 가능
 * - 발광부/수광부 동기화: 샘플링 시 발광부 ON → 안정화 대기 → 수광부 읽기 → 발광부 OFF
 * - 물방울 감지 로직: LOW 카운트 임계값은 lp_core_algorithm_config.h에서 설정
 * - GTT 계산: drop_interval_us 기반 Float 연산
 */
#include "ulp_lp_core.h"
#include "ulp_lp_core_gpio.h"
#include "ulp_lp_core_utils.h"
#include "ulp_lp_core_lp_timer_shared.h"
#include "ulp_lp_core_interrupts.h"
#include "lp_core_shared_memory.h"
#include "lp_core_algorithm_config.h"  // 알고리즘 파라미터 상수
#include "esp_attr.h"  // RTC_SLOW_ATTR
#include "riscv/csr.h"  // RV_READ_CSR (인터럽트 시간 측정용)
#include <math.h>  // fabsf() 사용

// LP Core에서는 Zigbee/HP 의존성을 줄이기 위해 핀 번호를 직접 정의한다.
// ESP32-C6 보드 핀맵 v2.1: IR 수광 LP GPIO는 GPIO3, 커패시터 센서는 GPIO7.
// IR TX 제어: GPIO6 (직접 제어, 발광부/수광부 동기화)
// 주의: 하드웨어 타이머 기능 제거됨 (GPIO2 사용 안 함)
// GPIO1 PWR LED: LP Core에서 점등/점멸 제어 (알람 시 ON, 비알람 시 일정 간격 점멸)
#define LP_IR_RX_LP_GPIO LP_IO_NUM_3
#define LP_CAPACITOR_SENSOR_LP_GPIO LP_IO_NUM_7
#define LP_IR_TX_DIRECT_LP_GPIO LP_IO_NUM_6   // GPIO6: 직접 제어 모드 (발광부/수광부 동기화)
#define LP_LED_PWR_LP_GPIO LP_IO_NUM_1        // GPIO1: PWR LED (LP Core 제어)

// 공유 메모리 (RTC SLOW MEM, LP/HP 공용)
// 주의: CONFIG_ULP_SHARED_MEM(0x10) 영역은 IDF 내부 cfg 용도.
//       실제 공유 데이터는 RTC SLOW 섹션(.rtc.slow_mem)에 배치하여 웨이크 스텁 영역과 분리.
// LP Core에서 변수를 정의 (HP Core에서 extern으로 접근)
RTC_SLOW_ATTR lp_core_shared_data_t ulp_shared_data;

// 배터리 수명 테스트 모드 설정 가져오기 (ULP 호환 헤더)
#include "iringer_alarm_config.h"

// 물방울 카운트 시 깜빡임 모드용: 이 시각(us)까지 LED ON 유지 (LED_BLINK_MODE_ON_DROP일 때)
static uint32_t s_led_on_drop_until_us = 0;

// 물방울 감지 3단계 상태 (수정 계획서: HIGH 확정 → 디바운스 무시 → LOW 카운트)
#define IR_DROP_STATE_HIGH_CONFIRM    0   // 연속 HIGH로 HIGH 구간 확정 (LOW 끼면 high_count 리셋)
#define IR_DROP_STATE_DEBOUNCE_IGNORE 2   // 신호 무시 구간 (입력 판단/전이 없음)
#define IR_DROP_STATE_LOW_COUNT       1   // 연속 LOW로 방울 확정 (HIGH 끼면 low_count 리셋)

// =========================================================================
// 신규 센싱 알고리즘 상수 (Dynamic Threshold & Timestamp Overwrite)
// =========================================================================
#define LP_ALGO_MIN_LIMIT_US        5000     // 5ms (노이즈 방지 하한선)
#define LP_ALGO_MAX_LIMIT_US        200000   // 200ms (먹통 방지 상한선)
#define LP_ALGO_BUNDLE_TIMEOUT_US   500000   // 500ms (하나의 묶음으로 판단할 시간 차이)
#define LP_ALGO_DECAY_TIMEOUT_US    2000000  // 2s (GTT 감속 적응을 위한 반감기 타임아웃)

// 마이크로 버스트 묶기 파라미터
// 일부 점적통에서 한 방울이 자잘한 HIGH 여러 개로 쪼개져 들어오는 현상 대응
#define LP_ALGO_MICRO_BURST_WINDOW_US   30000   // 30ms 윈도우: 이 안에 들어온 HIGH들을 묶음 후보로 수집
#define LP_ALGO_MICRO_BURST_MIN_COUNT   3       // 최소 3개 이상이어야 버스트로 인정

typedef struct {
    // --- 센싱 알고리즘 상태 변수 (71분 오버플로우 방지를 위해 uint64_t) ---
    bool current_drop_detected;
    uint32_t drop_cnt;
    uint64_t last_drop_timestamp_us;
    uint32_t drop_interval_us;
    
    // 신규 추가: 상태 머신 및 임계값 추적용 변수
    bool is_high;
    uint64_t high_start_us;
    uint32_t max_high_us;
    uint32_t threshold_us;
    uint64_t prev_high_end_us;
    uint64_t last_decay_us;

    // 마이크로 버스트 수집 상태
    uint64_t burst_first_high_start_us;  // 버스트 내 첫 HIGH의 시작 시각
    uint64_t burst_last_high_end_us;     // 버스트 내 마지막 HIGH의 끝 시각
    uint32_t burst_count;                // 버스트 내 HIGH 개수
    bool burst_active;                   // 버스트 수집 중인지

    // --- 커패시터 센서 및 GTT 안정화 상태 변수 (기존 로직 유지) ---
    bool last_capacitor_sample;
    bool last_capacitor_stable_state;
    uint32_t capacitor_debounce_counter_us;
    uint64_t capacitor_no_detection_start_us;
    bool capacitor_injection_complete;
    bool capacitor_event_triggered;
    
    gtt_int_t gtt_stab_temporary_reference;
    gtt_int_t gtt_stab_reference;
    uint32_t gtt_stab_stable_count;
    bool gtt_stab_stable;
    uint32_t gtt_stab_out_of_range_count;
} lp_algo_state_t;

static lp_algo_state_t s_algo_state = {0};

// 확정된 HIGH(effective_high)를 기존 알고리즘에 투입
// Noise Cut → Bundle Check → max_high/threshold 갱신 → decay 리셋

static void process_effective_high(uint32_t effective_high_us, uint64_t event_time_us, uint32_t *raw_edge_count_ptr) {
    // 1. Noise Cut (동적 임계값 비교)
    if (effective_high_us >= s_algo_state.threshold_us) {
        (*raw_edge_count_ptr)++;

        uint64_t time_since_last_drop = 0;
        if (s_algo_state.last_drop_timestamp_us > 0) {
            time_since_last_drop = event_time_us - s_algo_state.last_drop_timestamp_us;
        }

        // 동적 묶음 타임아웃 계산
        uint64_t dynamic_bundle_timeout = (uint64_t)s_algo_state.max_high_us * 3;
        if (dynamic_bundle_timeout < LP_ALGO_MIN_LIMIT_US) {
            dynamic_bundle_timeout = LP_ALGO_MIN_LIMIT_US;
        }
        if (dynamic_bundle_timeout > LP_ALGO_BUNDLE_TIMEOUT_US) {
            dynamic_bundle_timeout = LP_ALGO_BUNDLE_TIMEOUT_US;
        }
        // 2. Bundle Check (타임스탬프 덮어쓰기 판단)
        if (s_algo_state.drop_cnt > 0 && time_since_last_drop <= dynamic_bundle_timeout) {
            // [같은 묶음] 타임스탬프 덮어쓰기 (카운트 증가 안함)
            if (effective_high_us > s_algo_state.max_high_us) {
                s_algo_state.max_high_us = effective_high_us;

                uint32_t half_max = s_algo_state.max_high_us >> 1;
                if (half_max < LP_ALGO_MIN_LIMIT_US) half_max = LP_ALGO_MIN_LIMIT_US;
                if (half_max > LP_ALGO_MAX_LIMIT_US) half_max = LP_ALGO_MAX_LIMIT_US;
                s_algo_state.threshold_us = half_max;
            }

            s_algo_state.last_drop_timestamp_us = event_time_us;
            if (s_algo_state.prev_high_end_us > 0) {
                s_algo_state.drop_interval_us = (uint32_t)(s_algo_state.last_drop_timestamp_us - s_algo_state.prev_high_end_us);
            }

        } else {
            // [새로운 묶음] 정상 카운트 (새로운 방울 인정)
            s_algo_state.drop_cnt++;
#if (LED_BLINK_MODE == LED_BLINK_MODE_ON_DROP)
            s_led_on_drop_until_us = event_time_us + (uint64_t)LED_ON_DROP_DURATION_MS * 1000ULL;
#endif

            s_algo_state.prev_high_end_us = s_algo_state.last_drop_timestamp_us;
            s_algo_state.last_drop_timestamp_us = event_time_us;

            if (s_algo_state.prev_high_end_us > 0) {
                s_algo_state.drop_interval_us = (uint32_t)(s_algo_state.last_drop_timestamp_us - s_algo_state.prev_high_end_us);
            }

            s_algo_state.max_high_us = effective_high_us;
            uint32_t half_max = s_algo_state.max_high_us >> 1;
            if (half_max < LP_ALGO_MIN_LIMIT_US) half_max = LP_ALGO_MIN_LIMIT_US;
            if (half_max > LP_ALGO_MAX_LIMIT_US) half_max = LP_ALGO_MAX_LIMIT_US;
            s_algo_state.threshold_us = half_max;
        }

        s_algo_state.last_decay_us = event_time_us;
    }
}

// 마이크로 버스트 확정 처리: 수집된 버스트를 평가하고 기존 알고리즘에 투입
// - count >= 3: 자잘한 HIGH가 한 방울로 인정, 전체 span이 effective_high
// - count < 3: 정상 HIGH, span = 개별 HIGH 길이(count=1) 또는 근접 2개의 span
// 어느 쪽이든 span을 process_effective_high에 넘겨서 기존 Noise Cut + Bundle Check 수행
static void finalize_burst(uint32_t *raw_edge_count_ptr) {
    uint32_t span = (uint32_t)(s_algo_state.burst_last_high_end_us - s_algo_state.burst_first_high_start_us);
    process_effective_high(span, s_algo_state.burst_last_high_end_us, raw_edge_count_ptr);
    // 버스트 상태 리셋
    s_algo_state.burst_active = false;
    s_algo_state.burst_count = 0;
    s_algo_state.burst_first_high_start_us = 0;
    s_algo_state.burst_last_high_end_us = 0;
}

// GTT 안정화 알고리즘 검증 함수 (정수 연산)
// 주의: 기존 물방울 감지 및 GTT 계산 로직은 절대 수정하지 않음
//      shared->gtt 값만 읽어서 안정화 검증만 수행
static void verify_gtt_stabilization(gtt_int_t current_gtt, uint64_t time_since_last_drop_us, lp_core_shared_data_t *shared) {
    // current_gtt는 shared->gtt에서 읽은 값 (읽기 전용, 정수)
    // time_since_last_drop_us는 마지막 방울 감지 후 경과 시간 (기존 GTT 타임아웃 로직과 동일)
    
    // 1. GTT가 0이고 10초 이상 지난 경우: 기준 GTT 리셋 (수액 중단 또는 오류 상황)
    // 기존 GTT 타임아웃 로직(LP_ALGO_GTT_TIMEOUT_US)과 동일한 조건 사용
    if (current_gtt == 0 && time_since_last_drop_us >= LP_ALGO_GTT_TIMEOUT_US) {
        if (s_algo_state.gtt_stab_stable) {
            // 기준 GTT가 설정되어 있던 경우 리셋 (원자성 보장)
            s_algo_state.gtt_stab_stable = false;
            s_algo_state.gtt_stab_reference = 0;
            s_algo_state.gtt_stab_temporary_reference = 0;
            s_algo_state.gtt_stab_stable_count = 0;
            s_algo_state.gtt_stab_out_of_range_count = 0;  // Phase 8: 범위 이탈 카운트도 리셋
            
            // 공유 메모리 업데이트 (원자성 보장)
            // volatile 키워드로 선언되어 있어 컴파일러 최적화 방지됨
            shared->reference_gtt = 0;
            shared->gtt_stable = false;
        }
        // 물방울 감지 타임스탬프 및 간격 초기화: 다음 방울 측정 시 최소 2개 방울이 필요하도록 함
        // (GTT 계산에는 최소 2개 방울 간격이 필요하므로, last_drop_timestamp_us와 drop_interval_us를 0으로 초기화)
        s_algo_state.last_drop_timestamp_us = 0;
        s_algo_state.drop_interval_us = 0;
        shared->last_drop_timestamp_us = 0;
        shared->drop_interval_us = 0;
        // volatile 키워드로 선언되어 있어 컴파일러 최적화 방지됨
        return;  // GTT가 0이고 10초 이상 지나면 더 이상 처리하지 않음
    }
    
    // GTT가 0이지만 10초가 안 지난 경우: 기준 GTT 유지 (일시적인 측정 오류일 수 있음)
    if (current_gtt == 0) {
        return;  // GTT가 0이지만 10초가 안 지났으면 기준 GTT 유지
    }
    
    if (!s_algo_state.gtt_stab_stable) {
        // 기준 GTT가 아직 설정되지 않은 경우: 안정화 검증 수행
        if (s_algo_state.gtt_stab_temporary_reference == 0) {
            // 첫 GTT 값: 임시 기준으로 설정
            s_algo_state.gtt_stab_temporary_reference = current_gtt;
            s_algo_state.gtt_stab_stable_count = 1;
        } else {
            // 임시 기준 GTT 기준으로 ±30% 범위 검증 (정수 연산)
            // tolerance = reference * 30 / 100
            gtt_int_t tolerance = (s_algo_state.gtt_stab_temporary_reference * LP_ALGO_GTT_STABLE_VARIANCE_PERCENT) / 100;
            gtt_int_t min_gtt = s_algo_state.gtt_stab_temporary_reference - tolerance;
            gtt_int_t max_gtt = s_algo_state.gtt_stab_temporary_reference + tolerance;
            
            if (current_gtt >= min_gtt && current_gtt <= max_gtt) {
                // 범위 내: 안정화 카운트 증가
                s_algo_state.gtt_stab_stable_count++;
                
                if (s_algo_state.gtt_stab_stable_count >= LP_ALGO_GTT_STABLE_ENTRY_COUNT) {
                    // 10회 연속 성공: 기준 GTT 확정
                    s_algo_state.gtt_stab_reference = s_algo_state.gtt_stab_temporary_reference;
                    s_algo_state.gtt_stab_stable = true;
                    
            // 공유 메모리 업데이트 (원자성 보장)
            // volatile 키워드로 선언되어 있어 컴파일러 최적화 방지됨
            shared->reference_gtt = s_algo_state.gtt_stab_reference;
            shared->gtt_stable = true;
                }
            } else {
                // 범위 벗어남: 새로운 임시 기준 GTT로 변경하고 카운트 리셋
                s_algo_state.gtt_stab_temporary_reference = current_gtt;
                s_algo_state.gtt_stab_stable_count = 1;  // 현재 값부터 다시 카운트 시작
            }
        }
    } else {
        // Phase 8: 기준 GTT가 이미 설정된 경우 - 재설정 로직
        // 기준 GTT 기준으로 ±30% 범위를 지속적으로 모니터링
        // 연속 10회 범위 이탈 시 재설정 시작 (실제 수액 속도 변경 감지)
        
        if (s_algo_state.gtt_stab_reference > 0 && current_gtt > 0) {
            // 기준 GTT 기준으로 ±30% 범위 계산 (정수 연산)
            gtt_int_t tolerance = (s_algo_state.gtt_stab_reference * LP_ALGO_GTT_STABLE_VARIANCE_PERCENT) / 100;
            if (tolerance < 2) tolerance = 2; // 추가: 저속에서 최소 2 GTT의 여유 쿠션 부여
            gtt_int_t min_gtt = s_algo_state.gtt_stab_reference - tolerance;
            gtt_int_t max_gtt = s_algo_state.gtt_stab_reference + tolerance;
            
            // 범위 이탈 체크
            if (current_gtt < min_gtt || current_gtt > max_gtt) {
                // 범위 벗어남: 연속 범위 이탈 카운트 증가
                s_algo_state.gtt_stab_out_of_range_count++;
                
                // 연속 10회 범위 이탈 시 재설정 시작
                if (s_algo_state.gtt_stab_out_of_range_count >= LP_ALGO_GTT_STABLE_EXIT_COUNT) {
                    // 재설정 프로세스 시작: 기준 GTT 리셋하고 새로운 안정화 검증 시작
                    s_algo_state.gtt_stab_stable = false;
                    s_algo_state.gtt_stab_reference = 0;
                    s_algo_state.gtt_stab_temporary_reference = current_gtt;  // 현재 GTT를 새로운 임시 기준으로 설정
                    s_algo_state.gtt_stab_stable_count = 1;  // 현재 값부터 다시 카운트 시작
                    s_algo_state.gtt_stab_out_of_range_count = 0;  // 카운트 리셋
                    
                    // 공유 메모리 업데이트 (원자성 보장)
                    shared->reference_gtt = 0;
                    shared->gtt_stable = false;
                }
            } else {
                // 범위 내: 카운트 리셋 (정상 상태)
                s_algo_state.gtt_stab_out_of_range_count = 0;
            }
        }
    }
}

// Phase 2: 인터럽트 핸들러 제거 (주기적 샘플링 방식으로 변경)
// 인터럽트 핸들러는 더 이상 사용하지 않음
// 주기적 샘플링 방식으로 변경되었으므로 인터럽트 핸들러 제거

// LP Core 메인 루프
// ESP32-C6의 LP Core에서 실행됨
// LP Core 스타트업 코드가 main()을 호출하므로 엔트리 심볼은 main 사용
void main(void)
{
    // 공유 메모리 가져오기 (LP Core에서 정의한 변수 사용)
    lp_core_shared_data_t *shared = &ulp_shared_data;
    
    // LP Core에서 직접 설정하는 값들 (HP Core 초기화와 무관하게 LP Core가 제어)
    // r_adrop: 한 방울당 무게 (ml) * 10000 - 주입량 계산용
    if (shared->r_adrop_x10000 <= 0) {
        shared->r_adrop_x10000 = LP_DEFAULT_DROP_X10000;  // 기본값: 0.05ml/방울 * 10000 = 500
    }
    
    // LP GPIO 초기화 (GPIO3: IR 센서)
    // 공유메모리/ copy 버전과 동일하게 LP Core에서 LP GPIO를 명시적으로 초기화
    ulp_lp_core_gpio_init(LP_IR_RX_LP_GPIO);
    ulp_lp_core_gpio_input_enable(LP_IR_RX_LP_GPIO);
    ulp_lp_core_gpio_pullup_disable(LP_IR_RX_LP_GPIO);
    ulp_lp_core_gpio_pulldown_disable(LP_IR_RX_LP_GPIO);
    
    // LP GPIO 초기화 (GPIO7: 커패시터 센서)
    // HP Core에서 RTC GPIO로 이미 초기화했으므로, LP Core에서는 init/input_enable 없이 바로 사용 가능
    
    // GPIO6: IR 발광부 직접 제어 (출력 모드)
    ulp_lp_core_gpio_output_enable(LP_IR_TX_DIRECT_LP_GPIO);
#if LP_ALGO_IR_TX_ALWAYS_ON
    // 상시 ON: 발광부 켜고 안정화 후 루프에서는 수광부만 읽음
    ulp_lp_core_gpio_set_level(LP_IR_TX_DIRECT_LP_GPIO, 1);  // 발광부 ON
    ulp_lp_core_delay_us(LP_ALGO_IR_STABILIZATION_DELAY_US); // 최초 1회 안정화
#else
    // 토글 방식: 초기값 LOW, 샘플링 시마다 ON → 안정화 → RX 읽기 → OFF
    ulp_lp_core_gpio_set_level(LP_IR_TX_DIRECT_LP_GPIO, 0);  // 초기값: LOW (발광부 OFF)
#endif
    
    // GPIO1 PWR LED 초기화 (LP Core에서 점등/점멸 제어)
    ulp_lp_core_gpio_init(LP_LED_PWR_LP_GPIO);
    ulp_lp_core_gpio_output_enable(LP_LED_PWR_LP_GPIO);
    ulp_lp_core_gpio_set_level(LP_LED_PWR_LP_GPIO, 0);  // 초기값: LOW (첫 점멸 주기에서 ON)
    
    // IR TX 모드 설정 (공유 메모리에서 읽기, 기본값: 직접 제어 모드)
    // 주의: 하드웨어 타이머 기능 제거됨, 직접 제어 모드만 사용
    uint8_t ir_tx_mode = shared->ir_tx_mode;
    if (ir_tx_mode == 0 || ir_tx_mode != LP_IR_TX_MODE_DIRECT) {
        ir_tx_mode = LP_IR_TX_MODE_DIRECT;  // 기본값: 직접 제어 모드
        shared->ir_tx_mode = ir_tx_mode;
    }
    
    // GPIO6은 샘플링 시점에 직접 제어 (발광부/수광부 동기화)
    
// === 알고리즘 초기화 (IR 센서 - 동적 임계값) ===
    s_algo_state.current_drop_detected = false;
    s_algo_state.drop_cnt = 0;
    s_algo_state.last_drop_timestamp_us = 0;
    s_algo_state.drop_interval_us = 0;
    
    s_algo_state.is_high = false;
    s_algo_state.high_start_us = 0;
    s_algo_state.max_high_us = LP_ALGO_MIN_LIMIT_US;
    s_algo_state.threshold_us = LP_ALGO_MIN_LIMIT_US;
    s_algo_state.prev_high_end_us = 0;
    s_algo_state.last_decay_us = 0;
    s_algo_state.burst_first_high_start_us = 0;
    s_algo_state.burst_last_high_end_us = 0;
    s_algo_state.burst_count = 0;
    s_algo_state.burst_active = false;
    // drop_per_min_x100와 last_gtt_x100는 Float 연산으로 변경되어 더 이상 사용하지 않음
    
    // Phase 2: 인터럽트 방식 제거, 주기적 샘플링 방식 사용
    // 인터럽트 비활성화 (주기적 샘플링 사용)
    
    // 알고리즘 초기화 (커패시터 센서)
    // LOW = 수액 감지됨 (true), HIGH = 수액 없음 (false)
    // 예제 방식: 직접 bool 캐스팅
    bool initial_cap_raw = (bool)ulp_lp_core_gpio_get_level(LP_CAPACITOR_SENSOR_LP_GPIO);
    // 디버깅: 읽은 값 확인 (false = LOW, true = HIGH)
    // GPIO7은 pull-down 활성화되어 있어서 센서 미연결 시 HIGH(true)여야 함
    bool initial_cap_level = !initial_cap_raw;  // LOW = 감지됨 (true), HIGH = 미감지 (false)
    s_algo_state.last_capacitor_sample = initial_cap_level;
    s_algo_state.last_capacitor_stable_state = initial_cap_level;  // 초기 안정 상태
    // 초기값: 디바운싱 완료로 설정 (즉시 안정 상태로 인정, 첫 샘플에서 바로 업데이트 가능)
    s_algo_state.capacitor_debounce_counter_us = 50000;  
    s_algo_state.capacitor_no_detection_start_us = 0;
    s_algo_state.capacitor_injection_complete = false;
    s_algo_state.capacitor_event_triggered = false;
    // 초기 안정 상태를 공유 메모리에 즉시 설정
    shared->capacitor_sensor_level = initial_cap_level;  // true = 수액 감지됨, false = 수액 없음
    shared->injection_complete = false;
    shared->injection_complete_event = false;
    
    // GPIO7 디버깅: 초기 원시 레벨을 공유 메모리에 저장 (HP Core에서 확인 가능)
    // GPIO7_raw: false = LOW, true = HIGH
    // 주의: GPIO7은 pull-down 활성화되어 있어서 센서 미연결 시 HIGH(true)여야 함
    shared->gpio7_sensor_level = initial_cap_raw;  // 원시 레벨 (HIGH = true, LOW = false)
    
    // 타겟 샘플링 주기 설정 (실제 목표 주기, 예: 1000μs = 1000Hz)
    uint32_t target_sample_period_us = 1000000 / LP_ALGO_TARGET_SAMPLE_RATE_HZ;  // 타겟 샘플링 주기 (μs)
    uint64_t ticks_per_target_period = ulp_lp_core_lp_timer_calculate_sleep_ticks(target_sample_period_us);
    
    // 샘플링 조건 체크 주기 설정
    // 토글 모드: 루프 내 안정화 딜레이가 있으므로 타겟에서 딜레이 제외
    // 상시 ON 모드: 루프 내 딜레이 없음 → 타겟 주기 그대로 사용
    uint32_t sample_period_us = shared->sample_rate;
    if (sample_period_us == 0) {
#if LP_ALGO_IR_TX_ALWAYS_ON
        sample_period_us = target_sample_period_us;  // 상시 ON: 루프 내 딜레이 없음
#else
        sample_period_us = target_sample_period_us - LP_ALGO_IR_STABILIZATION_DELAY_US;
#endif
    }
    uint64_t ticks_per_sample = ulp_lp_core_lp_timer_calculate_sleep_ticks(sample_period_us);
    
    // Phase 2-3: 주기적 샘플링 방식으로 변경
    // copy 버전의 ir_sensor_sample_callback() 로직 포팅
    uint64_t last_sample_ticks = 0;  // 샘플링 타이머
    uint64_t last_result_ticks = 0;   // 결과 업데이트 주기 (1초)
    
    // 커패시터 센서 샘플링 주기: 2Hz = 500ms (전력 절감)
    uint32_t capacitor_sample_period_us = 500000;  // 500ms = 2Hz
    uint64_t ticks_per_capacitor_sample = ulp_lp_core_lp_timer_calculate_sleep_ticks(capacitor_sample_period_us);
    uint64_t last_capacitor_sample_ticks = 0;  // 커패시터 센서 샘플링 타이머
    
    // LED 점멸/알람 점등 (LP Core, 고객사 협의 반영)
    uint32_t led_check_period_us = 100000;  // 100ms마다 LED 상태 갱신
    uint64_t ticks_per_led_check = ulp_lp_core_lp_timer_calculate_sleep_ticks(led_check_period_us);
    uint64_t last_led_check_ticks = 0;
    uint64_t last_blink_start_us = 0;  // 마지막 점등 사이클 시작 시각 (us) - 71분 오버플로우 방지
    bool s_led_should_be_on = false;   // LED를 켜야 하는 구간인지 (알람 또는 점등 ON 구간)
    // LED 밝기: 시간 기준 PWM (LED_PWM_FREQ_HZ 사용, 위상 카운터 제거)
    
    // LP Core 주기적 wake-up: report_interval_us마다 HP를 깨워 RTC와 이중으로 wake-up 안정성 확보
    uint64_t last_periodic_wake_ticks = 0;  // 마지막 주기 wake 시점 (reset_wakeup_timer 시 갱신)
    
    shared->lp_core_running = true;
    shared->data_ready = false;  // 초기값: 데이터 미준비
    shared->error_code = 0;
    
    // 비상상황 감지 플래그 (이전 상태 추적용)
    bool last_alert_detected = false;
    bool last_injection_complete_event = false;
    
    // 무한 루프: LP Core는 계속 실행되어야 함 (예제 코드처럼 while(1) 사용)
    while (1) {
        // IR TX 모드 변경 확인 (하드웨어 타이머 기능 제거됨, 직접 제어 모드만 사용)
        // 주의: 현재는 직접 제어 모드만 사용하므로 모드 변경 로직 불필요
        // GPIO6은 샘플링 시점에 직접 제어 (발광부/수광부 동기화)
        
        // 현재 시간 계산 (LP timer cycle count 기반) - 71분 오버플로우 방지를 위해 uint64_t
        uint64_t current_ticks = ulp_lp_core_lp_timer_get_cycle_count();
        uint64_t current_time_us = (current_ticks * sample_period_us) / ticks_per_sample;
        uint32_t now = (uint32_t)(current_time_us / 1000);  // ms 단위 (v1 등용)
        
        // HP 슬립 진입 시 타이머 리셋: 주기 wake 기준 시각 갱신
        if (shared->reset_wakeup_timer) {
            last_periodic_wake_ticks = current_ticks;
            shared->reset_wakeup_timer = false;
        }
        
        // HP 방울 카운터 리셋 요청 (레이스 컨디션 방지: LP만 drop_cnt/injected_amount 쓰기)
        if (shared->request_drop_reset) {
            s_algo_state.drop_cnt = 0;
            s_algo_state.last_drop_timestamp_us = 0;
            s_algo_state.drop_interval_us = 0;
            shared->drop_cnt = 0;
            shared->injected_amount_x10000 = 0;
            shared->request_drop_reset = false;
            __sync_synchronize();
        }
        
        // LED 점등/점멸: 100ms마다 "켜야 하는 구간" 여부만 갱신 (실제 출력은 매 루프에서 밝기 적용)
        if ((current_ticks - last_led_check_ticks) >= ticks_per_led_check) {
            last_led_check_ticks = current_ticks;
            bool alarm_active = shared->fluid_end_alarm_active;
            if (alarm_active) {
                s_led_should_be_on = true;
                shared->gpio1_led_on = true;
            } else {
#if (LED_BLINK_MODE == LED_BLINK_MODE_ON_DROP)
                // 물방울 카운트 시 깜빡임: 방울 감지 후 LED_ON_DROP_DURATION_MS 동안만 ON
                s_led_should_be_on = (current_time_us < s_led_on_drop_until_us);
                shared->gpio1_led_on = s_led_should_be_on;
#else
                // 주기적 깜빡임 모드
                uint64_t elapsed_us = current_time_us - last_blink_start_us;
                uint32_t interval_us = (uint32_t)(LED_BLINK_INTERVAL_US);
                uint32_t on_duration_us = (uint32_t)(LED_ON_DURATION_US);
                if (elapsed_us >= (uint64_t)interval_us) {
                    last_blink_start_us = current_time_us;
                    s_led_should_be_on = true;
                    shared->gpio1_led_on = true;
                } else if (elapsed_us < (uint64_t)on_duration_us) {
                    s_led_should_be_on = true;
                    shared->gpio1_led_on = true;
                } else {
                    s_led_should_be_on = false;
                    shared->gpio1_led_on = false;
                }
#endif
            }
        }
#if (LED_BLINK_MODE == LED_BLINK_MODE_ON_DROP)
        // 물방울 카운트 시 깜빡임 모드: 매 루프에서 구간 재계산 (방울 감지 직후 반응)
        if (!shared->fluid_end_alarm_active) {
            s_led_should_be_on = (current_time_us < s_led_on_drop_until_us);
            shared->gpio1_led_on = s_led_should_be_on;
        }
#endif
        // LED 실제 출력: 시간 기준 PWM (LED_PWM_FREQ_HZ). 루프~1kHz이므로 PWM 주파수는 이보다 낮게 두면
        // 주기당 여러 번 갱신되어 떨림 없이 부드럽게 켜짐. 1000Hz로 하면 주기=1ms로 갱신 1회뿐이라 지터 시 떨림.
        uint32_t pwm_freq_hz = (LED_PWM_FREQ_HZ >= 50 && LED_PWM_FREQ_HZ <= 1000) ? (uint32_t)LED_PWM_FREQ_HZ : 100;
        uint32_t period_us = 1000000 / pwm_freq_hz;
        uint32_t pos_us = (period_us > 0) ? (uint32_t)(current_time_us % (uint64_t)period_us) : 0;
        uint32_t brightness = (LED_BRIGHTNESS_PERCENT <= 100) ? (uint32_t)LED_BRIGHTNESS_PERCENT : 100;
        uint32_t on_threshold_us = (period_us > 0) ? ((uint32_t)brightness * period_us / 100) : 0;
        int led_level = 0;
        if (s_led_should_be_on) {
            led_level = (brightness >= 100 || pos_us < on_threshold_us) ? 1 : 0;
        }
        ulp_lp_core_gpio_set_level(LP_LED_PWR_LP_GPIO, led_level);
        
        static uint32_t raw_edge_count = 0;
        // Phase 2: IR 센서 샘플링 (LP_ALGO_IR_TX_ALWAYS_ON에 따라 토글 또는 상시 ON)
        if ((current_ticks - last_sample_ticks) >= ticks_per_sample) {
            last_sample_ticks = current_ticks;
#if LP_ALGO_IR_TX_ALWAYS_ON
            // 상시 ON: 발광부는 이미 켜져 있음, 수광부만 읽기
            bool current_level = (bool)ulp_lp_core_gpio_get_level(LP_IR_RX_LP_GPIO);
#else
            // 토글 방식: 발광부 ON → 안정화 대기 → 수광부 읽기 → 발광부 OFF
            ulp_lp_core_gpio_set_level(LP_IR_TX_DIRECT_LP_GPIO, 1);
            ulp_lp_core_delay_us(LP_ALGO_IR_STABILIZATION_DELAY_US);
            bool current_level = (bool)ulp_lp_core_gpio_get_level(LP_IR_RX_LP_GPIO);
            ulp_lp_core_gpio_set_level(LP_IR_TX_DIRECT_LP_GPIO, 0);
#endif

            // === 점적통 적외선 센싱 알고리즘 (마이크로 버스트 묶기 + 동적 임계값) ===
            // current_level: 1 = 차단됨(High), 0 = 비차단(Low)
            //
            // 흐름: 엣지 감지 → 마이크로 버스트 수집(30ms 윈도우) → 확정 시 effective_high 산출
            //       → Noise Cut → Bundle Check (기존 "제일 긴 놈만 패기" 알고리즘)
            
            // --- 엣지 감지 ---
            if (current_level == 1 && !s_algo_state.is_high) {
                // Rising Edge (Low -> High: 방울 진입 시작)
                s_algo_state.is_high = true;
                s_algo_state.high_start_us = current_time_us;
            } 
            else if (current_level == 0 && s_algo_state.is_high) {
                // Falling Edge (High -> Low: 방울 통과 완료)
                s_algo_state.is_high = false;
                uint32_t curr_high_us = (uint32_t)(current_time_us - s_algo_state.high_start_us);

                // --- 마이크로 버스트 수집 ---
                if (!s_algo_state.burst_active) {
                    // 버스트 미활성: 새 버스트 시작
                    s_algo_state.burst_active = true;
                    s_algo_state.burst_first_high_start_us = s_algo_state.high_start_us;
                    s_algo_state.burst_last_high_end_us = current_time_us;
                    s_algo_state.burst_count = 1;
                } else if ((current_time_us - s_algo_state.burst_first_high_start_us) <= LP_ALGO_MICRO_BURST_WINDOW_US) {
                    // 30ms 윈도우 이내: 같은 버스트에 추가
                    s_algo_state.burst_last_high_end_us = current_time_us;
                    s_algo_state.burst_count++;
                } else {
                    // 30ms 윈도우 초과: 이전 버스트 확정 후 새 버스트 시작
                    finalize_burst(&raw_edge_count);
                    s_algo_state.burst_active = true;
                    s_algo_state.burst_first_high_start_us = s_algo_state.high_start_us;
                    s_algo_state.burst_last_high_end_us = current_time_us;
                    s_algo_state.burst_count = 1;
                }
            }
            
            // --- 마이크로 버스트 윈도우 만료 체크 (매 샘플) ---
            // 버스트 수집 중이고, 현재 HIGH가 아니고, 30ms 윈도우를 넘겼으면 확정
            if (s_algo_state.burst_active && !s_algo_state.is_high) {
                if ((current_time_us - s_algo_state.burst_first_high_start_us) > LP_ALGO_MICRO_BURST_WINDOW_US) {
                    finalize_burst(&raw_edge_count);
                }
            }
            // 버스트 수집 중이고 현재 HIGH 진행 중이면: 30ms 넘겨도 HIGH 끝날 때까지 대기
            // (다음 Falling Edge에서 burst_last_high_end_us가 갱신되고, 그 다음 샘플에서 확정됨)

            // 3. GTT 변동 적응 (가속 대비 Threshold Decay 로직)
            if (s_algo_state.last_decay_us > 0) {
                uint64_t time_since_decay = current_time_us - s_algo_state.last_decay_us;
                
                if (time_since_decay >= (uint64_t)LP_ALGO_DECAY_TIMEOUT_US) {
                    s_algo_state.max_high_us >>= 1; // 2초 넘게 방울이 없으면 절반으로 깎음
                    
                    uint32_t half_max = s_algo_state.max_high_us >> 1;
                    if (half_max < LP_ALGO_MIN_LIMIT_US) half_max = LP_ALGO_MIN_LIMIT_US;
                    if (half_max > LP_ALGO_MAX_LIMIT_US) half_max = LP_ALGO_MAX_LIMIT_US;
                    s_algo_state.threshold_us = half_max;
                    
                    s_algo_state.last_decay_us = current_time_us; // 타이머 리셋
                }
            }
            
            shared->sample_count++;
            // 디버깅: 상태/카운트 (튜닝·검증용) - 신규 알고리즘 변수로 대체 매핑
            if (shared->sample_count % 100 == 0) {
                shared->low_count_current = s_algo_state.max_high_us; // 가장 두꺼운 방울(응딩이) 유지 시간
                shared->rising_detected_debug = s_algo_state.is_high; // 센서가 현재 방울을 읽고 있는지 여부
                shared->ir_drop_state_debug = (uint8_t)(s_algo_state.threshold_us / 1000); // 현재 동적 임계값 (ms)
                shared->debounce_ignore_remaining_debug = s_algo_state.drop_interval_us / 1000; // 최근 방울 간격 (ms)
            }
        }
        
        // GPIO 샘플링 (GPIO7: 커패시터 센서) - 2Hz 샘플링 (500ms마다, 전력 절감)
        // 커패시터 센서는 수액 종료 감지 목적이므로 2Hz로 충분
        if ((current_ticks - last_capacitor_sample_ticks) >= ticks_per_capacitor_sample) {
            last_capacitor_sample_ticks = current_ticks;
            
            // 예제 방식: 직접 bool 캐스팅
            bool cap_raw_level = (bool)ulp_lp_core_gpio_get_level(LP_CAPACITOR_SENSOR_LP_GPIO);
            bool capacitor_sample_raw = !cap_raw_level;  // LOW = 수액 감지 (false = LOW → true)
            // 디버깅: 원시 레벨을 공유 메모리에 저장 (HP Core에서 확인 가능)
            shared->gpio7_sensor_level = cap_raw_level;  // HIGH = true, LOW = false
            
            // === 커패시터 센서 알고리즘 처리 (수액 종료 감지) ===
            // 디바운싱: 50ms (상태 변화 후 50ms 동안 안정화 대기)
            if (capacitor_sample_raw != s_algo_state.last_capacitor_sample) {
                // 상태 변화 감지: 디바운스 타이머 시작
                s_algo_state.capacitor_debounce_counter_us = 0;
            } else {
                // 상태 변화 없음: 디바운스 타이머 증가 (2Hz 샘플링 기준)
                s_algo_state.capacitor_debounce_counter_us += capacitor_sample_period_us;
            }
            
            // 디바운싱 완료 확인 (50ms 경과 후 안정적인 상태로 인정)
            if (s_algo_state.capacitor_debounce_counter_us >= 50000) {  // 50ms
                bool new_stable_state = capacitor_sample_raw;
                
                // 안정적인 상태 변화 체크
                if (new_stable_state != s_algo_state.last_capacitor_stable_state) {
                    // 상태 변화: 감지 → 미감지 또는 미감지 → 감지
                    if (!new_stable_state) {
                        // 수액 감지 실패 시작 (미감지)
                        if (s_algo_state.capacitor_no_detection_start_us == 0) {
                            s_algo_state.capacitor_no_detection_start_us = current_time_us;
                        }
                    } else {
                        // 수액 감지 재개
                        s_algo_state.capacitor_no_detection_start_us = 0;
                        s_algo_state.capacitor_injection_complete = false;
                        s_algo_state.capacitor_event_triggered = false;
                    }
                    s_algo_state.last_capacitor_stable_state = new_stable_state;
                }
            }
            
            // 수액 끝 판정 (안정적인 상태 기준)
            if (!s_algo_state.last_capacitor_stable_state) {
                // 계속 미감지 상태
                
                // 수액 투입률 확인: 임계값 이상에서만 수액 종료 감지 시작 (정수 연산)
                bool should_detect_injection_complete = false;
                if (shared->r_volume_max_x10000 > 0 && shared->injected_amount_x10000 > 0) {
                    // injection_percent = (injected_amount_x10000 * 100) / r_volume_max_x10000
                    // 예: injected_amount_x10000=950000 (95.0000ml), r_volume_max_x10000=1000000 (100.0000ml) → injection_percent = 95
                    percent_int_t injection_percent = 
                        ((uint64_t)shared->injected_amount_x10000 * 100) / shared->r_volume_max_x10000;
                    percent_int_t threshold = LP_ALGO_INJECTION_COMPLETE_THRESHOLD_PERCENT;
                    if (injection_percent >= threshold) {
                        // 임계값 이상: 수액 종료 감지 시작
                        should_detect_injection_complete = true;
                    }
                }
                
                if (should_detect_injection_complete) {
                    // 임계값 이상에서만 수액 종료 감지 시작
                    if (s_algo_state.capacitor_no_detection_start_us == 0) {
                        s_algo_state.capacitor_no_detection_start_us = current_time_us;
                    }
                    
                    // 수액 끝 판정: 타임아웃 시간 이상 미감지
                    uint32_t timeout_us = LP_INJECTION_COMPLETE_TIMEOUT_NEAR_END_US;  // 15초
                    uint64_t no_detection_elapsed_us = current_time_us - s_algo_state.capacitor_no_detection_start_us;
                    if (no_detection_elapsed_us >= (uint64_t)timeout_us) {
                        if (!s_algo_state.capacitor_injection_complete) {
                            // 수액 끝 상태로 변경 (처음 판정 시에만)
                            s_algo_state.capacitor_injection_complete = true;
                            if (!s_algo_state.capacitor_event_triggered) {
                                // 수액 끝 이벤트 발생 (한 번만)
                                s_algo_state.capacitor_event_triggered = true;
                            }
                        }
                    }
                } else {
                    // 임계값 미만: 수액 종료 감지 안 함 (타이머 리셋)
                    s_algo_state.capacitor_no_detection_start_us = 0;
                }
            } else {
                // 계속 감지 상태
                s_algo_state.capacitor_no_detection_start_us = 0;
            }
            
            s_algo_state.last_capacitor_sample = capacitor_sample_raw;
            // 안정적인 상태를 공유 메모리에 업데이트 (디바운싱 완료된 값)
            // capacitor_sample_raw: true = LOW = 수액 감지됨, false = HIGH = 수액 없음
            // 디바운싱이 완료된 후에만 안정 상태 업데이트 (50ms = 50000us)
            // 주의: 초기화 시 capacitor_debounce_counter_us = 50000으로 설정되어 있으므로
            // 첫 샘플링부터 업데이트 가능 (상태가 변경되지 않은 경우)
            if (s_algo_state.capacitor_debounce_counter_us >= 50000) {
                // last_capacitor_stable_state는 디바운싱 완료 후 안정적인 상태
                shared->capacitor_sensor_level = s_algo_state.last_capacitor_stable_state;
            } else {
                // 디바운싱 중일 때는 이전 안정 상태 유지 (초기값 또는 마지막 안정 상태)
                // 초기화 시 이미 capacitor_sensor_level이 설정되어 있으므로 유지됨
            }
        }
        
        // LP Core 주기적 wake-up: 설정 주기(report_interval_us)마다 HP를 깨워 RTC와 이중으로 안정성 확보
        // RTC와 동일한 us 값(report_interval_us)을 LP 타이머 틱으로 변환 시 동일 API 사용
        if (shared->report_interval_us > 0 && last_periodic_wake_ticks > 0) {
            uint64_t report_interval_ticks = ulp_lp_core_lp_timer_calculate_sleep_ticks((uint32_t)shared->report_interval_us);
            if (report_interval_ticks > 0 && (current_ticks - last_periodic_wake_ticks) >= report_interval_ticks) {
                ulp_lp_core_wakeup_main_processor();
                last_periodic_wake_ticks = current_ticks;
            }
        }
        
        // 결과 업데이트 (1초마다)
        uint64_t ticks_since_result = current_ticks - last_result_ticks;
        uint64_t us_since_result = (ticks_since_result * sample_period_us) / ticks_per_sample;
        if (us_since_result >= 1000000ULL) {
            // 타임아웃 체크용: 마지막 방울 감지 후 경과 시간 확인 (drop_interval_us 재계산하지 않음)
            // 주의: drop_interval_us는 방울 감지 시점에 계산된 값을 유지해야 함 (재계산하면 안 됨!)
            // uint64_t 사용으로 71분 오버플로우 방지 (이전 uint32_t는 약 71분 후 overflow 발생)
            uint64_t time_since_last_drop_us = 0;
            if (s_algo_state.last_drop_timestamp_us > 0) {
                time_since_last_drop_us = current_time_us - s_algo_state.last_drop_timestamp_us;
            }
            
            // GTT 계산 (drop_interval_us 기반, 정수 연산)
            // drop_interval_us는 방울 감지 시점에 계산된 값을 사용 (1초마다 재계산하지 않음)
            // 주의: time_since_last_drop_us는 타임아웃 체크용이며, GTT 계산에는 사용하지 않음
            // gtt = 60 / (drop_interval_us / 1000000) = 60 * 1000000 / drop_interval_us
            if (s_algo_state.drop_cnt > 1 && s_algo_state.drop_interval_us > 0) {
                // 정수 연산: gtt = (60 * 1000000) / drop_interval_us
                uint64_t numerator = 60ULL * 1000000ULL;
                // 반올림(Round to nearest) 적용: 소수점 버림으로 인한 저속 오차 완벽 해결
                gtt_int_t gtt = (gtt_int_t)((numerator + (s_algo_state.drop_interval_us / 2)) / s_algo_state.drop_interval_us);

                    // 감쇠 GTT: 마지막 방울 이후 경과 시간이 drop_interval보다 길면
                    // gtt를 60 / 경과시간(초)로 자연 감소시킴.
                    // 예: 60gtt 흐르다 밸브 잠금 → t=10초: 6, t=15초: 4, t=16초: 3
                    // 경계 케이스(15.5초 간격): t=15초에 gtt=4 유지 → 깜빡임 없음
                    if (time_since_last_drop_us > (uint64_t)s_algo_state.drop_interval_us
                        && time_since_last_drop_us > 0) {
                        gtt_int_t decayed_gtt = (gtt_int_t)(numerator / time_since_last_drop_us);
                        if (decayed_gtt < gtt) {
                            gtt = decayed_gtt;
                        }
                    }
                    
                    // 최대 속도 제한 (GTT = 1분당 방울 수)
                gtt_int_t max_gtt = LP_ALGO_GTT_MAX;
                if (gtt > max_gtt) {
                    gtt = max_gtt;
                    }
                    
                    shared->gtt = gtt;
            } else {
                // 첫 방울만 감지된 경우 또는 측정이 없는 경우: GTT를 0으로 설정
                // 주의: 첫 방울만 감지된 경우(drop_cnt == 1) GTT를 계산할 수 없음
                // 방울 간격을 알려면 최소 2개의 방울이 필요하므로, 첫 방울만으로는 GTT 계산 불가능
                shared->gtt = 0;
            }

            bool speed_override = false;

            if (raw_edge_count > 0)
            {
                // === 고속 오동작 감지 ===
                static uint32_t prev_raw_edge_count = 0;
                uint32_t edges_this_second = raw_edge_count - prev_raw_edge_count;
                prev_raw_edge_count = raw_edge_count;

                static gtt_int_t gtt_history[10] = {0};
                static uint32_t gtt_hist_idx = 0;
                static uint32_t gtt_hist_filled = 0;

                gtt_history[gtt_hist_idx] = shared->gtt;
                gtt_hist_idx = (gtt_hist_idx + 1) % 10;
                if (gtt_hist_filled < 10) gtt_hist_filled++;


                // 조건 1: 지터 (10초 윈도우에서 연속 측정값 50% 이상 변동이 5회 이상)
                if (gtt_hist_filled >= 10) {
                    uint32_t jitter_hits = 0;
                    for (uint32_t i = 0; i < 9; i++) {
                        gtt_int_t a = gtt_history[i];
                        gtt_int_t b = gtt_history[i + 1];
                        if (a > 0 && b > 0) {
                            gtt_int_t d = (a > b) ? (a - b) : (b - a);
                            if (d * 100 / a >= 50) jitter_hits++;
                        }
                    }
                    if (jitter_hits >= 5) speed_override = true;
                }

                // 조건 2: 센서는 바쁜데 GTT가 낮음
                if (edges_this_second >= 5 && shared->gtt <= 20 && shared->gtt > 0) {
                    speed_override = true;
                }
            }

            if (speed_override) {
                shared->gtt = LP_ALGO_GTT_MAX;
            }

            /* 15초 이상 방울 없음 플래그 (HP Core 알람용)
             * - 방울이 한 번도 안 왔으면(last_drop_timestamp == 0) true가 아닌 false 유지
             *   (부팅 직후 알람 방지: 아직 점적통 미장착일 수 있음)
             * - 방울이 1번이라도 왔으면(drop_cnt > 0), 이후 15초 이상 없으면 true
             * - true→false 전이는 gtt >= LP_ALGO_DROPS_STOPPED_MIN_GTT 일 때만 허용
             *   (노이즈 드롭 1개로 알람 해제되는 것 방지, gtt 1~3은 0gtt 취급) */
            if (s_algo_state.drop_cnt > 0) {
                if (time_since_last_drop_us >= LP_ALGO_GTT_TIMEOUT_US) {
                    shared->drops_stopped = true;
                } else if (!shared->drops_stopped || shared->gtt >= LP_ALGO_DROPS_STOPPED_MIN_GTT) {
                    shared->drops_stopped = false;
                }
                /* else: drops_stopped=true이고 gtt < MIN_GTT → 유지 (노이즈 방어) */
            }
            
            // GTT 안정화 알고리즘 (독립적으로 추가, 기존 로직과 분리)
            // 주의: 기존 물방울 감지 및 GTT 계산 로직은 절대 수정하지 않음
            // time_since_last_drop_us는 기존 GTT 타임아웃 체크와 동일한 값 사용 (중복 제거)
            verify_gtt_stabilization(shared->gtt, time_since_last_drop_us, shared);

            // GTT 25% 변화 감지 — 15초 윈도우 링버퍼 (정수 연산)
            // 매 초 GTT를 링버퍼에 저장하고, 버퍼 내 모든 항목과 비교.
            // 15초 이내 어떤 시점과 비교해도 25% 이상 변동이면 gtt_change_detected.
            // 1초 만에 25% 변동해도 즉시 감지됨.
            #define GTT_CHANGE_BUF_SIZE 15
            static gtt_int_t s_gtt_change_buf[GTT_CHANGE_BUF_SIZE];
            static uint32_t s_gtt_change_wr = 0;
            static uint32_t s_gtt_change_cnt = 0;

            {
                gtt_int_t current_gtt = shared->gtt;

                // 버퍼 내 모든 항목과 비교 (최대 15회 정수 연산 — LP Core 20MHz에서 무시 가능)
                if (s_gtt_change_cnt > 0) {
                    for (uint32_t ci = 0; ci < s_gtt_change_cnt; ci++) {
                        gtt_int_t hist = s_gtt_change_buf[ci];
                        if (hist > 0) {
                            if (current_gtt == 0) {
                                // 양수→0 전환: 수액 중단 비상
                                shared->gtt_change_detected = true;
                                break;
                            }
                            gtt_int_t diff = (current_gtt > hist)
                                ? (current_gtt - hist) : (hist - current_gtt);
                            percent_int_t change_percent = (diff * 100) / hist;
                            if (change_percent >= LP_ALGO_GTT_STABLE_VARIANCE_PERCENT) {
                                shared->gtt_change_detected = true;
                                break;
                            }
                        }
                    }
                }

                // 현재 GTT를 링버퍼에 저장
                s_gtt_change_buf[s_gtt_change_wr] = current_gtt;
                s_gtt_change_wr = (s_gtt_change_wr + 1) % GTT_CHANGE_BUF_SIZE;
                if (s_gtt_change_cnt < GTT_CHANGE_BUF_SIZE) s_gtt_change_cnt++;
            }

            // 종합 이상 감지 플래그 계산 (LP Core에서 판단)
            // GTT 25% 변화 감지만 이상 감지로 간주 (범위 이탈 기능 제외)
            shared->alert_detected = shared->gtt_change_detected;
            shared->drop_cnt = s_algo_state.drop_cnt;
            
            // 주입량 계산: drop_cnt * r_adrop_x10000 (LP Core에서 계산, 정수 연산)
            // injected_amount_x10000 = drop_cnt * r_adrop_x10000
            // 예: drop_cnt=100, r_adrop_x10000=547 (0.0547ml) → injected_amount_x10000 = 54700 (5.4700ml)
            if (shared->r_adrop_x10000 > 0) {
                uint64_t injected_amount_x10000 = (uint64_t)s_algo_state.drop_cnt * shared->r_adrop_x10000;
                shared->injected_amount_x10000 = (volume_int_t)injected_amount_x10000;
            } else {
                shared->injected_amount_x10000 = 0;
            }
            
            shared->analysis_timestamp_us = current_time_us;
            
            // GTT 계산 시점의 타임스탬프 계산 (서버 시간 기준점 + 상대 시간)
            if (shared->server_time_base_us > 0) {
                // 서버 시간 기준점이 설정되어 있으면 절대 타임스탬프 계산
                // current_time_us는 LP Core 시작 후 경과 시간 (마이크로초)
                shared->gtt_timestamp_us = shared->server_time_base_us + current_time_us;
            } else {
                // 서버 시간이 동기화되지 않았으면 0으로 설정
                shared->gtt_timestamp_us = 0;
            }
            
            // 공유 메모리 업데이트 (HP Core에서 읽을 수 있도록)
            shared->data_ready = true;
            shared->last_drop_timestamp_us = s_algo_state.last_drop_timestamp_us;
            shared->drop_interval_us = s_algo_state.drop_interval_us;
            
            // 메모리 배리어: 공유 메모리 업데이트 후 HP Core가 읽을 수 있도록 보장
            // volatile 필드이므로 컴파일러 최적화 방지, 하지만 명시적으로 배리어 추가
            __sync_synchronize();  // 메모리 배리어 (GCC 내장 함수)
            
            // 수액 종료 감지 상태 업데이트
            shared->injection_complete = s_algo_state.capacitor_injection_complete;
            
            // ⚠️ 중요: HP Core가 injection_complete_event를 리셋했는지 확인
            // HP Core가 wake-up 후 injection_complete_event를 false로 리셋했는데,
            // capacitor_event_triggered가 여전히 true이면 중복 wake-up이 발생할 수 있음
            // 따라서 HP Core가 리셋한 것을 감지하고 capacitor_event_triggered도 리셋
            if (s_algo_state.capacitor_event_triggered && !shared->injection_complete_event) {
                // HP Core가 리셋한 것으로 간주: capacitor_event_triggered도 리셋하여 중복 wake-up 방지
                s_algo_state.capacitor_event_triggered = false;
            }
            
            // injection_complete_event: capacitor_event_triggered가 true인 동안 true로 유지
            shared->injection_complete_event = s_algo_state.capacitor_event_triggered;
            
            // ⚠️ 중요: 비상상황 감지 시 HP Core를 즉시 깨움
            // alert_detected: GTT 변화 감지 또는 범위 이탈
            // injection_complete_event: 수액 종료 감지
            bool current_alert_detected = shared->alert_detected;
            bool current_injection_complete_event = shared->injection_complete_event;
            
            // 비상상황이 새로 발생한 경우 (이전에는 없었는데 지금 발생)
            if ((current_alert_detected && !last_alert_detected) || 
                (current_injection_complete_event && !last_injection_complete_event)) {
                // HP Core를 즉시 깨워서 비상상황 리포트 전송 (단, 배터리 테스트 모드에서는 모든 비상 wake-up 차단)
                bool should_wakeup = true;
#if DISABLE_ALARM_FOR_BATTERY_TEST
                should_wakeup = false;
#endif
                if (should_wakeup) {
                    ulp_lp_core_wakeup_main_processor();
                }
            }
            
            // 이전 상태 업데이트 (다음 주기 비교용)
            last_alert_detected = current_alert_detected;
            last_injection_complete_event = current_injection_complete_event;
            
            // Phase 2: 인터럽트 카운트 제거 (주기적 샘플링 방식으로 변경)
            // error_code는 다른 용도로 사용 가능
            shared->error_code = 0;
            
            // last_gtt_x100는 더 이상 사용하지 않음 (Float 연산으로 변경)
            last_result_ticks = current_ticks;
        }
        
        // 전력 절감: 루프 주기를 타겟 샘플링 주기와 동기화
        // 메인 루프는 계속 실행되어 커패시터 센서 체크 및 인터럽트 처리 가능
        // 인터럽트는 비동기로 처리되므로 딜레이 중에도 ISR 호출 가능
        // ulp_lp_core_wait_for_intr()는 루프를 막아서 커패시터 센서 체크가 안되므로 사용 안 함
        
        // 타겟 샘플링 주기 기준으로 자동 딜레이 계산
        // 샘플링 시작 시점(last_sample_ticks)부터 타겟 주기만큼 경과했는지 확인
        // 부족하면 딜레이를 추가하여 정확히 타겟 주기를 맞춤
        // 이렇게 하면 내부 딜레이(250μs)와 오버헤드를 자동으로 보정하여 정확한 주기를 유지할 수 있음
        uint64_t next_sample_ticks = last_sample_ticks + ticks_per_target_period;
        
        // 루프 끝에서 현재 틱을 다시 확인 (샘플링 내부 딜레이와 오버헤드가 경과한 후)
        uint64_t current_ticks_end = ulp_lp_core_lp_timer_get_cycle_count();
        
        if (current_ticks_end < next_sample_ticks) {
            uint64_t remaining_ticks = next_sample_ticks - current_ticks_end;
            if (remaining_ticks > 0) {
                // 타이머 기반 딜레이 (마이크로초 단위로 변환)
                // 타겟 주기를 기준으로 변환하여 정확한 딜레이 계산
                uint32_t wait_us = (uint32_t)((remaining_ticks * target_sample_period_us) / ticks_per_target_period);
                if (wait_us > 0) {
                    // 타겟 샘플링 주기까지 대기 (전력 절감 및 정확한 주기 유지)
                    ulp_lp_core_delay_us(wait_us);
                }
            }
        }
    }
    
    shared->lp_core_running = false;
}
