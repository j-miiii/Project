/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LP Core 통합 구현 (HP Core에서 사용)
 * ESP32-C6의 LP Core는 ulp_riscv 컴포넌트를 사용
 */
#include "lp_core.h"
#include "lp_core_shared_memory.h"
#include "lp_core_algorithm_config.h"  // LP_ALGO_SAMPLE_PERIOD_US
#include "esp_log.h"
#include "esp_sleep.h"
#include "ulp_lp_core.h"
#include "lp_core_main_lp.h"  // LP Core 메인 함수 선언
#include "driver/rtc_io.h"    // RTC GPIO 초기화용
#include "driver/gpio.h"      // GPIO_NUM_* 정의 포함
#include <string.h>           // memcpy

static const char *TAG = "LP_CORE";

// LP Core 실행 상태
static bool s_lp_core_running = false;
static bool s_lp_core_initialized = false;

esp_err_t lp_core_init(void)
{
    if (s_lp_core_initialized) {
        ESP_LOGW(TAG, "LP Core가 이미 초기화됨");
        return ESP_OK;
    }
    
    // 공유 메모리 초기화
    lp_core_shared_data_t *shared = NULL;
    esp_err_t ret = lp_core_shared_memory_init(&shared);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "공유 메모리 초기화 실패: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // LP Core에서 사용할 GPIO 핀들을 RTC GPIO로 초기화
    // ESP32-C6 보드 핀맵 v2.1: GPIO3(IR RX), GPIO7(커패시터 센서), GPIO1(LED), GPIO6(IR TX), GPIO2(IR TX)
    // 주의: ESP32-C6에서는 모든 GPIO가 LP Core에서 사용 가능하지만, 
    //       HP Core에서 RTC GPIO로 초기화하여 LP Core에서 사용할 수 있도록 설정해야 함
    
    // GPIO3: IR 센서 (LP Core 입력)
    ret = rtc_gpio_init(GPIO_NUM_3);
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_ARG && ret != ESP_ERR_NOT_SUPPORTED) {
        // ESP_ERR_INVALID_ARG: 이미 초기화됨
        // ESP_ERR_NOT_SUPPORTED: ESP32-C6에서는 일부 GPIO가 RTC GPIO를 지원하지 않을 수 있음
        ESP_LOGE(TAG, "GPIO3 RTC GPIO 초기화 실패: %s", esp_err_to_name(ret));
        return ret;
    }
    if (ret == ESP_OK) {
        // 초기화 성공한 경우에만 방향 및 풀업/풀다운 설정
        rtc_gpio_set_direction(GPIO_NUM_3, RTC_GPIO_MODE_INPUT_ONLY);
        rtc_gpio_pulldown_dis(GPIO_NUM_3);
        rtc_gpio_pullup_dis(GPIO_NUM_3);  // 풀업 비활성화 (copy 버전과 동일하게 신호 편향 제거)
    }
    
    // GPIO7: 커패시터 센서 (LP Core 입력)
    ret = rtc_gpio_init(GPIO_NUM_7);
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_ARG && ret != ESP_ERR_NOT_SUPPORTED) {
        ESP_LOGE(TAG, "GPIO7 RTC GPIO 초기화 실패: %s", esp_err_to_name(ret));
        return ret;
    }
    if (ret == ESP_OK) {
        rtc_gpio_set_direction(GPIO_NUM_7, RTC_GPIO_MODE_INPUT_ONLY);
        rtc_gpio_pullup_dis(GPIO_NUM_7);
        rtc_gpio_pulldown_en(GPIO_NUM_7);  // 풀다운 활성화 (안전 모드)
    }
    
    // GPIO1 LED는 HP Core에서 직접 제어 (LP Core에서 제어하지 않음)
    // GPIO1은 HP Core에서 일반 GPIO로 초기화 및 제어
    
    // GPIO6: IR 발광부 (공유메모리 방식: HP가 RTC GPIO 출력으로 준비, LP에서 enable/set 제어)
    ret = rtc_gpio_init(GPIO_NUM_6);
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_ARG && ret != ESP_ERR_NOT_SUPPORTED) {
        ESP_LOGE(TAG, "GPIO6 RTC GPIO 초기화 실패: %s", esp_err_to_name(ret));
        return ret;
    }
    if (ret == ESP_OK) {
        rtc_gpio_set_direction(GPIO_NUM_6, RTC_GPIO_MODE_OUTPUT_ONLY);
        rtc_gpio_pullup_dis(GPIO_NUM_6);
        rtc_gpio_pulldown_dis(GPIO_NUM_6);
        rtc_gpio_set_level(GPIO_NUM_6, 0);  // 초기값: LOW (발광부 OFF) - LP에서 제어
    }
    
    // GPIO2: 하드웨어 타이머 기능 제거됨
    // 하드웨어 타이머는 LOW일 때 동작하므로, HIGH로 명시적으로 설정하여 비활성화 유지
    ret = rtc_gpio_init(GPIO_NUM_2);
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_ARG && ret != ESP_ERR_NOT_SUPPORTED) {
        ESP_LOGE(TAG, "GPIO2 RTC GPIO 초기화 실패: %s", esp_err_to_name(ret));
        return ret;
    }
    if (ret == ESP_OK) {
        rtc_gpio_set_direction(GPIO_NUM_2, RTC_GPIO_MODE_OUTPUT_ONLY);
        rtc_gpio_pullup_dis(GPIO_NUM_2);
        rtc_gpio_pulldown_dis(GPIO_NUM_2);
        rtc_gpio_set_level(GPIO_NUM_2, 1);  // HIGH로 설정하여 하드웨어 타이머 비활성화 유지
    }
    
    ESP_LOGI(TAG, "RTC GPIO 초기화 완료: GPIO3(IR RX), GPIO7(커패시터), GPIO6(IR TX 직접 제어), GPIO2(HIGH, 타이머 비활성화)");
    
    // 알고리즘은 lp_core_main_lp.c에서 직접 구현됨 (인터페이스 방식 미사용)
    s_lp_core_initialized = true;
    ESP_LOGI(TAG, "LP Core 초기화 완료");
    
    return ESP_OK;
}

esp_err_t lp_core_start(void)
{
    if (!s_lp_core_initialized) {
        ESP_LOGE(TAG, "LP Core가 초기화되지 않음");
        return ESP_ERR_INVALID_STATE;
    }

    if (s_lp_core_running) {
        ESP_LOGW(TAG, "LP Core가 이미 실행 중");
        return ESP_OK;
    }

    // 공유 메모리 업데이트
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        shared->lp_core_enable = true;
        shared->sample_rate = LP_ALGO_SAMPLE_PERIOD_US;
    }

    // LP Core 바이너리 로드
    extern const uint8_t lp_core_main_bin_start[] asm("_binary_lp_core_main_bin_start");
    extern const uint8_t lp_core_main_bin_end[] asm("_binary_lp_core_main_bin_end");

    size_t bin_size = (size_t)(lp_core_main_bin_end - lp_core_main_bin_start);
    esp_err_t ret = ulp_lp_core_load_binary(lp_core_main_bin_start, bin_size);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "LP Core 바이너리 로드 실패: %s", esp_err_to_name(ret));
        return ret;
    }

    // LP Core 실행 설정
    ulp_lp_core_cfg_t cfg = {
        .wakeup_source = ULP_LP_CORE_WAKEUP_SOURCE_HP_CPU, // HP 이벤트로 깨움
        .lp_timer_sleep_duration_us = 0, // 타이머 미사용(연속 실행)
#if ESP_ROM_HAS_LP_ROM
        .skip_lp_rom_boot = false,
#endif
    };

    ret = ulp_lp_core_run(&cfg);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "LP Core 실행 실패: %s", esp_err_to_name(ret));
        return ret;
    }

    s_lp_core_running = true;
    ESP_LOGI(TAG, "LP Core 시작 (샘플링 주기: %d us, 발광부/수광부 동기화)", LP_ALGO_SAMPLE_PERIOD_US);

    return ESP_OK;
}

esp_err_t lp_core_stop(void)
{
    if (!s_lp_core_running) {
        ESP_LOGW(TAG, "LP Core가 실행 중이 아님");
        return ESP_OK;
    }
    
    // 공유 메모리 업데이트
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        shared->lp_core_enable = false;
    }
    
    // LP Core 중지 (공유 메모리 플래그로 제어)
    // LP Core는 lp_core_enable 플래그를 확인하여 자동으로 종료됨
    
    s_lp_core_running = false;
    ESP_LOGI(TAG, "LP Core 중지");
    
    return ESP_OK;
}

bool lp_core_is_running(void)
{
    // 디버깅: 호출 확인 (처음 몇 번만 로그 출력)
    static uint32_t call_count = 0;
    static bool last_result = false;
    call_count++;
    
    bool result = s_lp_core_running;
    
    // 상태가 변경되거나 처음 몇 번 호출 시 로그 출력
    if (call_count <= 3 || result != last_result || call_count % 100 == 0) {
        ESP_LOGD(TAG, "[lp_core_is_running #%lu] 반환값: %d (s_lp_core_running=%d)", 
                 call_count, result, s_lp_core_running);
        last_result = result;
    }
    
    return result;
}

esp_err_t lp_core_get_data(lp_core_shared_data_t *data)
{
    if (data == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared == NULL) {
        return ESP_ERR_INVALID_STATE;
    }
    
    __sync_synchronize();
    if (!shared->data_ready) {
        memcpy(data, shared, sizeof(lp_core_shared_data_t));
        return ESP_OK;  // data_ready=false 상태 그대로 반환 (호출자가 체크)
    }
    // data_ready 이중 확인: LP 갱신 중 memcpy 시 불일치 스냅샷 방지
    const int max_retries = 3;
    for (int i = 0; i < max_retries; i++) {
        memcpy(data, shared, sizeof(lp_core_shared_data_t));
        __sync_synchronize();
        if (shared->data_ready) {
            return ESP_OK;  // 복사 중 LP가 갱신하지 않음
        }
    }
    memcpy(data, shared, sizeof(lp_core_shared_data_t));
    return ESP_OK;
}

void lp_core_set_enable(bool enable)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        shared->lp_core_enable = enable;
    }
}

// IR TX 제어 모드 설정
void lp_core_set_ir_tx_mode(uint8_t mode)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        shared->ir_tx_mode = mode;
    }
}

// GTT 범위 설정 (HP Core → LP Core)
// Float 값을 정수로 변환하여 저장 (반올림, 스케일링 없음)
void lp_core_set_gtt_range(float ordered_gtt, float min_gtt, float max_gtt)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        if (ordered_gtt > 0.0f) {
            shared->ordered_gtt = (gtt_int_t)(ordered_gtt + 0.5f);  // 반올림
        }
        if (min_gtt > 0.0f) {
            shared->min_gtt = (gtt_int_t)(min_gtt + 0.5f);  // 반올림
        }
        if (max_gtt > 0.0f) {
            shared->max_gtt = (gtt_int_t)(max_gtt + 0.5f);  // 반올림
        }
        ESP_LOGI(TAG, "LP Core GTT 범위 설정: ordered=%.2f→%ld, min=%.2f→%ld, max=%.2f→%ld", 
                 ordered_gtt, (long)shared->ordered_gtt, 
                 min_gtt, (long)shared->min_gtt, 
                 max_gtt, (long)shared->max_gtt);
    }
}

// 서버 시간 기준점 설정 (HP Core → LP Core)
void lp_core_set_server_time_base(uint64_t server_time_base_us)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        shared->server_time_base_us = server_time_base_us;
        __sync_synchronize();  // 64비트 쓰기 가시성 확보
        ESP_LOGI(TAG, "LP Core 서버 시간 기준점 설정: %llu (Unix epoch us)", server_time_base_us);
    }
}

// 총 수액량 설정 (HP Core → LP Core)
// Float 값을 정수로 변환하여 저장 (10000 스케일, 소수 넷째자리까지)
void lp_core_set_r_volume_max(float r_volume_max)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        shared->r_volume_max_x10000 = (volume_int_t)(r_volume_max * VOLUME_SCALE_FACTOR);
        ESP_LOGI(TAG, "LP Core 총 수액량 설정: %.4f ml (x10000=%ld)", r_volume_max, (long)shared->r_volume_max_x10000);
    }
}

// 방울 카운터 리셋 요청 (HP Core → LP Core)
// HP 직접 쓰기 대신 요청 플래그 사용 (레이스 컨디션 방지)
void lp_core_request_drop_reset(void)
{
    lp_core_shared_data_t *shared = lp_core_get_shared_memory();
    if (shared) {
        shared->request_drop_reset = true;
        __sync_synchronize();  // LP가 요청을 볼 수 있도록 메모리 배리어
    }
}