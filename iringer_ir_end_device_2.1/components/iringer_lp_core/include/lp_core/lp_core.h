/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LP Core 통합 API (HP Core에서 사용)
 */
#ifndef LP_CORE_H
#define LP_CORE_H

#include "esp_err.h"
#include "lp_core_shared_memory.h"

#ifdef __cplusplus
extern "C" {
#endif

// LP Core 초기화
// 공유 메모리 초기화 및 알고리즘 등록
esp_err_t lp_core_init(void);

// LP Core 시작
// LP Core를 시작하여 IR 센서 샘플링 시작 (LP_ALGO_SAMPLE_PERIOD_US 설정값 사용)
esp_err_t lp_core_start(void);

// LP Core 중지
esp_err_t lp_core_stop(void);

// LP Core 실행 상태 확인
bool lp_core_is_running(void);

// 공유 메모리에서 데이터 읽기
esp_err_t lp_core_get_data(lp_core_shared_data_t *data);

// LP Core 활성화/비활성화
void lp_core_set_enable(bool enable);

// IR TX 제어 모드 설정
void lp_core_set_ir_tx_mode(uint8_t mode);  // lp_ir_tx_mode_t 값

// GTT 범위 설정 (HP Core → LP Core)
void lp_core_set_gtt_range(float ordered_gtt, float min_gtt, float max_gtt);

// 서버 시간 기준점 설정 (HP Core → LP Core)
// server_time_base_us: 서버 시간 기준점 (Unix epoch 마이크로초)
void lp_core_set_server_time_base(uint64_t server_time_base_us);

// 총 수액량 설정 (HP Core → LP Core)
// r_volume_max: 총 수액량 (ml) - 수액 투입률 계산 및 수액 종료 판정용
void lp_core_set_r_volume_max(float r_volume_max);

// 방울 카운터 리셋 요청 (HP Core → LP Core)
// HP 직접 쓰기 대신 요청 플래그 사용 (레이스 컨디션 방지)
void lp_core_request_drop_reset(void);

#ifdef __cplusplus
}
#endif

#endif // LP_CORE_H
