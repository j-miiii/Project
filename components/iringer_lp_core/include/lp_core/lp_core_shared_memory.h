/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LP Core 공유 메모리 인터페이스
 * HP Core ↔ LP Core 간 데이터 공유를 위한 구조체 정의
 */
#ifndef LP_CORE_SHARED_MEMORY_H
#define LP_CORE_SHARED_MEMORY_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

// 정수 연산을 위한 스케일링 계수
// GTT와 퍼센트는 정수만 사용 (스케일링 없음, 오차 허용)
#define VOLUME_SCALE_FACTOR    10000    // 부피(ml): 0.0001 단위 (예: 0.0547 → 547, 소수 넷째자리까지)

// 정수 타입 정의
typedef int32_t gtt_int_t;      // GTT 정수형 (스케일링 없음, 직접 정수 값만 저장)
typedef int32_t volume_int_t;   // 부피 정수형 (VOLUME_SCALE_FACTOR 배, 소수 넷째자리까지)
typedef int32_t percent_int_t;   // 퍼센트 정수형 (스케일링 없음, 직접 퍼센트 값만 저장, 예: 30% → 30)

// IR 센서 관련 상수 (LP Core 전용)
#define LP_DEFAULT_DROP         0.037f        // 한 방울의 무게 (ml) - 호환성 유지용 (사용 안 함)
#define LP_DEFAULT_DROP_X10000  ((volume_int_t)(LP_DEFAULT_DROP * VOLUME_SCALE_FACTOR))  // 한 방울의 무게 (ml) * 10000 (0.0547 * 10000 = 547)
#define LP_IR_SENSOR_DEBOUNCE   70           // 디바운싱 시간 (ms)

// GTT 범위 체크 설정 (LP Core 전용) - 정수만 사용 (스케일링 없음)
#define LP_DEFAULT_ORDERED_GTT  30        // 기본 처방 속도 (gtt) - 정수만 사용
#define LP_DEFAULT_MIN_GTT      20        // 최소 허용 속도 (gtt) - 정수만 사용
#define LP_DEFAULT_MAX_GTT      40        // 최대 허용 속도 (gtt) - 정수만 사용

// 이상 감지 리포트 전송 설정 (LP Core 전용)
#define LP_DATA_UPDATE_INTERVAL_NORMAL  300000  // 정상: 5분 주기 리포트 전송 (ms, Phase 4)
#define LP_DATA_UPDATE_INTERVAL_ALERT   1000    // 이상 감지 시 1초 (ms)
#define LP_ALERT_IMMEDIATE_SEND_ENABLED 0       // 1: 이상 감지 시 즉시 전송, 0: 정기 전송만

// 수액 종료 감지 설정 (LP Core 전용)
#define LP_INJECTION_COMPLETE_TIMEOUT_NORMAL_US  3000000   // 일반: 3초 이상 미감지 시 수액 종료 판정 (마이크로초)
#define LP_INJECTION_COMPLETE_TIMEOUT_NEAR_END_US  15000000  // 임계값 이상: 15초 이상 미감지 시 수액 종료 판정 (마이크로초)
// LP_INJECTION_COMPLETE_THRESHOLD_PERCENT는 lp_core_algorithm_config.h로 이동됨

// IR TX 제어 모드 (하드웨어 타이머 기능 제거, 직접 제어 모드만 사용)
typedef enum {
    LP_IR_TX_MODE_DIRECT      // 직접 제어 모드: GPIO6으로 발광부/수광부 동기화 제어
} lp_ir_tx_mode_t;

// 공유 메모리 구조체 (HP Core ↔ LP Core)
// volatile 키워드로 메모리 배리어 보장
typedef struct {
    // 입력 데이터 (HP → LP)
    volatile bool lp_core_enable;      // LP Core 활성화 플래그
    volatile uint32_t sample_rate;     // 샘플링 주기 (마이크로초, LP_ALGO_SAMPLE_PERIOD_US 기본값 사용)
    volatile volume_int_t r_adrop_x10000;            // 한 방울당 무게 (ml) * 10000 - 주입량 계산용 (0.0547ml → 547)
    volatile volume_int_t r_volume_max_x10000;       // 총 수액량 (ml) * 10000 - 수액 투입률 계산용 (HP → LP)
    volatile uint8_t ir_tx_mode;       // IR TX 제어 모드 (lp_ir_tx_mode_t)
    volatile gtt_int_t ordered_gtt;        // 처방 속도 (gtt) - 정수만 사용 (30)
    volatile gtt_int_t min_gtt;            // 최소 허용 속도 (gtt) - 정수만 사용 (20)
    volatile gtt_int_t max_gtt;            // 최대 허용 속도 (gtt) - 정수만 사용 (40)
    volatile uint32_t data_update_interval_normal;  // 정상 리포트 전송 주기 (ms)
    volatile uint32_t data_update_interval_alert;   // 이상 감지 시 리포트 전송 주기 (ms)
    volatile bool alert_immediate_send_enabled;     // 이상 감지 시 즉시 전송 활성화
    volatile uint64_t server_time_base_us;          // 서버 시간 기준점 (Unix epoch 마이크로초, HP Core에서 설정)
    
    // 출력 데이터 (LP → HP)
    volatile gtt_int_t gtt;                 // 계산된 GTT 값 (방울/분) - 정수만 사용
    volatile uint32_t drop_cnt;         // 감지된 방울 수
    volatile volume_int_t injected_amount_x10000;     // 계산된 주입량 (ml) * 10000 = drop_cnt * r_adrop_x10000
    volatile bool gtt_change_detected;  // GTT 30% 변화 감지 플래그
    volatile bool gtt_out_of_range;     // (미사용) GTT 범위 이탈 플래그 - 기능 제외됨
    volatile bool alert_detected;       // 종합 이상 감지 플래그 (gtt_change_detected만 사용)
    volatile bool data_ready;           // 데이터 준비 플래그
    volatile uint64_t analysis_timestamp_us; // 분석 시각 (상대 시간, 마이크로초) - 71분 오버플로우 방지
    volatile uint64_t gtt_timestamp_us; // GTT 계산 시점의 타임스탬프 (Unix epoch 마이크로초)
    
// 수액 종료 감지 (LP → HP)
    volatile bool injection_complete;        // 수액 주입 종료 감지 플래그 (true = 수액 끝)
    volatile bool injection_complete_event;  // 수액 끝 이벤트 플래그 (한 번만 true, 읽으면 리셋 필요)
    volatile bool capacitor_sensor_level;    // 커패시터 센서 현재 레벨 (true = 수액 감지)
    volatile bool drops_stopped;             // 15초 이상 방울 없음 (true→false에 gtt≥4 필요, 노이즈 방어)
    
    // 상태 정보
    volatile bool lp_core_running;      // LP Core 실행 상태
    volatile uint32_t sample_count;     // 샘플링 카운트 (총 샘플 수)
    volatile uint32_t error_code;       // 에러 코드 (0 = 정상)
    volatile bool reset_wakeup_timer;   // HP Core Sleep 진입 시 타이머 리셋 플래그 (HP → LP)
    volatile bool request_drop_reset;   // HP 방울 카운터 리셋 요청 (HP → LP, LP만 drop_cnt/injected_amount 쓰기)
    volatile uint64_t report_interval_us; // 리포트 주기 (us). HP가 슬립 전 설정. LP가 이 주기로 HP 주기적 wake-up (0이면 미사용)
    
    // 디버깅 정보
    volatile uint64_t last_drop_timestamp_us;  // 마지막 방울 감지 시각 - 71분 오버플로우 방지
    volatile uint32_t drop_interval_us;        // 마지막 방울 간격 (마이크로초)
    volatile uint32_t old_tmr_us;              // 이전 방울 간격 (마이크로초, 디버깅용)
    volatile bool gpio3_last_sample;           // GPIO3 최근 샘플 값 (디버깅용)
    volatile uint32_t rising_edge_count;       // RISING 엣지 감지 카운트 (디버깅용)
    volatile uint32_t low_count_current;       // 현재 LOW 카운트 (디버깅용)
    volatile bool rising_detected_debug;        // (레거시) 0=HIGH_CONFIRM 여부 (디버깅용)
    volatile uint8_t ir_drop_state_debug;      // 3단계 상태: 0=HIGH_CONFIRM, 1=DEBOUNCE_IGNORE, 2=LOW_COUNT
    volatile uint32_t debounce_ignore_remaining_debug;  // DEBOUNCE_IGNORE 단계 남은 샘플 수 (튜닝/검증용)
    volatile uint32_t v1_debug;                  // v1 값 (디버깅용, ms 단위)
    volatile uint32_t ticks_per_sample_debug;   // ticks_per_sample 값 (디버깅용)
    volatile uint32_t current_ticks_debug;      // 현재 ticks 값 (디버깅용)
    volatile uint32_t last_sample_ticks_debug;  // 마지막 샘플 ticks 값 (디버깅용)
    
    // ========== GPIO 제어 확장 필드 ==========
    
    // 수액 종료 알람 활성 (HP → LP): Beep 알람 울릴 때 LED 점등용
    // HP Core가 알람 조건 체크 시 buzzer_alarm_fluid_end_is_active() 결과 기록
    volatile bool fluid_end_alarm_active;
    
    // GPIO1 LED 제어 (단순 ON/OFF, 듀티비 없음)
    volatile bool gpio1_led_on;  // LED ON/OFF (true = HIGH, false = LOW)
    volatile bool gpio1_led_lp_control;      // LP Core 제어 권한
    
    // GPIO6 IR 발광부 제어
    volatile bool gpio6_ir_tx_control_enable; // IR 발광부 제어 활성화 플래그
    volatile uint8_t gpio6_ir_tx_duty;       // IR 발광부 듀티 (0-100%)
    volatile bool gpio6_ir_tx_lp_control;     // LP Core 제어 권한
    
    // GPIO7 센서 상태
    volatile bool gpio7_sensor_control_enable; // 센서 제어 활성화 플래그
    volatile bool gpio7_sensor_level;          // 센서 레벨 (최신 읽기 값)
    volatile uint32_t gpio7_sensor_change_count; // 상태 변화 카운트
    volatile uint32_t gpio7_sensor_last_change_us; // 마지막 변화 시간 (32비트로 충분, 3초 = 3,000,000us < 2^32)
    volatile bool gpio7_fluid_end_detected;   // 수액 종료 감지 플래그 (LP Core → HP Core)
    
    // GTT 안정화 알고리즘 출력 (LP → HP)
    volatile gtt_int_t reference_gtt;           // 기준 GTT (안정화 완료 후) - 정수만 사용
    volatile bool gtt_stable;               // 기준 GTT 안정화 완료 플래그
} lp_core_shared_data_t;

// 공유 메모리 초기화
// RTC 메모리 또는 일반 메모리 영역 사용
esp_err_t lp_core_shared_memory_init(lp_core_shared_data_t **shared_data);

// 공유 메모리 주소 가져오기
lp_core_shared_data_t *lp_core_get_shared_memory(void);

#ifdef __cplusplus
}
#endif

#endif // LP_CORE_SHARED_MEMORY_H

