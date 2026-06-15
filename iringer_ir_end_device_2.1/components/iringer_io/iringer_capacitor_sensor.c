/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * Capacitor Sensor Module Implementation
 * 커패시터 센서 (수액 종료 감지) - LP Core 공유 메모리 래퍼
 * 
 * 주의: 실제 센서 처리는 LP Core에서 수행되며, HP Core는 공유 메모리를 통해 데이터를 읽습니다.
 */
#include "iringer_capacitor_sensor.h"
#include "lp_core/lp_core_shared_memory.h"
#include "esp_log.h"

static const char *TAG = "CAPACITOR_SENSOR";

// 커패시터 센서 초기화
esp_err_t capacitor_sensor_init(void)
{
    // GPIO7은 LP Core에서 RTC GPIO로 초기화되므로, HP Core에서는 초기화 불필요
    // 공유 메모리를 통해 LP Core의 데이터를 읽기만 함
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        // 초기값 확인 (LP Core에서 이미 설정됨)
        ESP_LOGI(TAG, "커패시터 센서 초기화 완료 (LP Core에서 제어, GPIO%d)", CAPACITOR_SENSOR_PIN);
        return ESP_OK;
    }
    
    ESP_LOGE(TAG, "커패시터 센서 초기화 실패: 공유 메모리 접근 불가");
    return ESP_ERR_INVALID_STATE;
}

// 수액 주입 종료 여부 확인 (LP Core 공유 메모리에서 읽기)
bool capacitor_sensor_is_injection_complete(void)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        // LP Core에서 계산한 injection_complete 값 반환
        // true = 수액 끝, false = 수액 감지 중
        return shared->injection_complete;
    }
    
    // 공유 메모리 접근 실패 시 기본값: 수액 감지 중 (false)
    return false;
}

// 수액 주입 종료 이벤트 확인 (한 번만 발생, 읽으면 자동 리셋)
bool capacitor_sensor_get_injection_complete_event(void)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        // 이벤트 플래그 읽기
        bool event = shared->injection_complete_event;
        
        // 이벤트가 발생했으면 리셋 (한 번만 true로 유지)
        if (event) {
            shared->injection_complete_event = false;
        }
        
        return event;
    }
    
    // 공유 메모리 접근 실패 시 기본값: 이벤트 없음
    return false;
}

// 센서 상태 리셋 (LP Core에 리셋 요청)
void capacitor_sensor_reset(void)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        // LP Core가 자동으로 수액 감지 재개 시 리셋하므로,
        // 여기서는 이벤트 플래그만 리셋
        shared->injection_complete_event = false;
        
        // 주의: injection_complete는 LP Core가 자동으로 관리하므로
        //       수액 감지 재개 시 자동으로 false로 변경됨
        ESP_LOGD(TAG, "커패시터 센서 이벤트 리셋 (수액 감지 재개 대기)");
    }
}

