/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LP Core 공유 메모리 구현
 */
#include "lp_core_shared_memory.h"
#include "lp_core_algorithm_config.h"  // 알고리즘 파라미터 상수
#include "esp_log.h"
#include "esp_attr.h" // RTC_DATA_ATTR
#include "esp_sleep.h" // esp_sleep_get_wakeup_cause
#include <string.h>
#include <stdint.h>  // uintptr_t

// LP Core 바이너리에서 자동 생성된 헤더 파일 include
// 이 헤더 파일은 ulp_embed_binary()에 의해 생성되며, LP Core의 전역 변수들을 ulp_ 접두사로 선언합니다
#include "lp_core_main.h"

static const char *TAG = "LP_CORE_SHARED_MEM";

// 공유 메모리 변수는 LP Core에서 정의됨 (lp_core_main_lp.c)
// HP Core에서는 자동 생성된 헤더 파일(lp_core_main.h)의 ulp_ulp_shared_data를 사용
// ESP-IDF는 모든 심볼을 uint32_t로 선언하므로, 구조체 포인터로 캐스팅하여 사용

static bool s_shared_memory_initialized = false;

// LP Core의 공유 메모리 변수 접근 헬퍼 함수
// ESP-IDF 문서에 따르면: "For functions and arrays, take the address of the symbol and cast it to the appropriate type."
// 구조체 변수도 배열과 유사하므로 주소를 가져와서 구조체 포인터로 캐스팅합니다.
// ulp_ulp_shared_data는 uint32_t로 선언되었지만, 링커 스크립트에서 구조체의 실제 주소로 정의됩니다.
static inline lp_core_shared_data_t* get_lp_core_shared_data(void)
{
    // ESP-IDF 문서: "take the address of the symbol and cast it to the appropriate type"
    return (lp_core_shared_data_t*)(uintptr_t)&ulp_ulp_shared_data;
}

esp_err_t lp_core_shared_memory_init(lp_core_shared_data_t **shared_data)
{
    if (s_shared_memory_initialized) {
        if (shared_data) {
            *shared_data = get_lp_core_shared_data();
        }
        return ESP_OK;
    }
    
    // 공유 메모리 초기화
    // LP Core에서 정의된 ulp_shared_data 변수를 HP Core에서 접근하여 초기화
    lp_core_shared_data_t *ulp_data = get_lp_core_shared_data();
    
    // 컴파일러 경고 억제: ulp_ulp_shared_data는 uint32_t로 선언되었지만 실제로는 구조체입니다
    #pragma GCC diagnostic push
    #pragma GCC diagnostic ignored "-Warray-bounds"
    
    // Light Sleep 사용: HP Core만 꺼지고 LP Core는 계속 실행
    // 공유메모리는 항상 유지되므로, LP Core가 이미 실행 중이면 초기화하지 않음
    bool lp_core_already_running = (ulp_data->lp_core_enable == true || 
                                     ulp_data->lp_core_running == true ||
                                     ulp_data->sample_count > 0);
    
    if (lp_core_already_running) {
        // LP Core가 이미 실행 중이면 공유메모리 보존 (데이터 유지)
        ESP_LOGI(TAG, "LP Core가 이미 실행 중: 공유메모리 보존 (센서 데이터 유지)");
        s_shared_memory_initialized = true;
        if (shared_data) {
            *shared_data = ulp_data;
        }
        #pragma GCC diagnostic pop
        return ESP_OK;
    }
    
    // 처음 부팅하거나 LP Core가 실행되지 않은 경우에만 초기화
    // 컴파일러 경고 억제: ulp_ulp_shared_data는 uint32_t로 선언되었지만 실제로는 구조체의 주소입니다
    // ESP-IDF 문서에 따라 구조체는 배열처럼 주소를 가져와서 캐스팅하므로, 이 경고는 안전하게 무시할 수 있습니다.
    #pragma GCC diagnostic push
    #pragma GCC diagnostic ignored "-Wstringop-overflow"
    #pragma GCC diagnostic ignored "-Warray-bounds"
    memset((void*)ulp_data, 0, sizeof(lp_core_shared_data_t));
    
    // 기본값 설정
    ulp_data->lp_core_enable = false;
    ulp_data->sample_rate = LP_ALGO_SAMPLE_PERIOD_US;
    // r_adrop은 LP Core에서 직접 설정 (LP Core가 제어)
    ulp_data->r_adrop_x10000 = 0;  // LP Core에서 설정할 것임
    ulp_data->r_volume_max_x10000 = 0;  // 총 수액량 (HP Core에서 설정)
    ulp_data->ir_tx_mode = LP_IR_TX_MODE_DIRECT;  // 기본값: 직접 제어 모드
    ulp_data->ordered_gtt = LP_DEFAULT_ORDERED_GTT;  // 기본값: 30 gtt (정수만 사용)
    ulp_data->min_gtt = LP_DEFAULT_MIN_GTT;  // 기본값: 20 gtt (정수만 사용)
    ulp_data->max_gtt = LP_DEFAULT_MAX_GTT;  // 기본값: 40 gtt (정수만 사용)
    ulp_data->data_update_interval_normal = LP_DATA_UPDATE_INTERVAL_NORMAL;  // 기본값: 5분 (300000ms)
    ulp_data->data_update_interval_alert = LP_DATA_UPDATE_INTERVAL_ALERT;    // 기본값: 1초
    ulp_data->alert_immediate_send_enabled = LP_ALERT_IMMEDIATE_SEND_ENABLED;  // 기본값: 0 (비활성화)
    ulp_data->server_time_base_us = 0;  // 서버 시간 기준점 (HP Core에서 설정)
    ulp_data->gtt = 0;
    ulp_data->drop_cnt = 0;
    ulp_data->injected_amount_x10000 = 0;
    ulp_data->gtt_change_detected = false;
    ulp_data->gtt_out_of_range = false;
    ulp_data->alert_detected = false;
    ulp_data->data_ready = false;
    ulp_data->analysis_timestamp_us = 0;
    ulp_data->gtt_timestamp_us = 0;  // GTT 계산 시점 타임스탬프
    ulp_data->lp_core_running = false;
    ulp_data->sample_count = 0;
    ulp_data->error_code = 0;
    ulp_data->request_drop_reset = false;  // HP 방울 카운터 리셋 요청
    ulp_data->report_interval_us = 0;  // HP가 슬립 전 설정 (LP 주기적 wake-up용)
    ulp_data->last_drop_timestamp_us = 0;
    ulp_data->drop_interval_us = 0;
    ulp_data->injection_complete = false;
    ulp_data->injection_complete_event = false;
    ulp_data->capacitor_sensor_level = false;
    ulp_data->drops_stopped = false;
    
    // 수액 종료 알람 활성 (HP가 알람 체크 시 기록)
    ulp_data->fluid_end_alarm_active = false;
    
    // GPIO1 LED 제어 기본값 설정
    ulp_data->gpio1_led_on = true;              // 기본값: HIGH (Wakeup 시)
    ulp_data->gpio1_led_lp_control = true;       // 기본값: LP Core 제어 권한
    
    // GPIO7 센서 디버깅 초기값
    ulp_data->gpio7_sensor_level = false;        // 초기값: LOW (감지됨)
    
    // GTT 안정화 알고리즘 초기값
    ulp_data->reference_gtt = 0;              // 기준 GTT (초기값: 0, 정수만 사용)
    ulp_data->gtt_stable = false;                // 기준 GTT 안정화 완료 플래그 (초기값: false)
    
    #pragma GCC diagnostic pop  // 기본값 설정 완료, 경고 억제 해제
    
    s_shared_memory_initialized = true;
    
    if (shared_data) {
        *shared_data = ulp_data;  // LP Core의 공유 메모리 주소 반환
    }
    
    ESP_LOGI(TAG, "공유 메모리 초기화 완료 (크기: %zu 바이트, 주소: %p)", sizeof(lp_core_shared_data_t), (void*)ulp_data);
    return ESP_OK;
}

lp_core_shared_data_t *lp_core_get_shared_memory(void)
{
    if (!s_shared_memory_initialized) {
        ESP_LOGW(TAG, "공유 메모리가 초기화되지 않음, 자동 초기화");
        lp_core_shared_memory_init(NULL);
    }
    return get_lp_core_shared_data();  // LP Core의 공유 메모리 주소 반환
}

