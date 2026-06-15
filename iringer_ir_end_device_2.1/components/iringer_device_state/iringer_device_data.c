/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 디바이스 데이터 단일 보관 및 접근 API 구현
 */
#include "iringer_device_data.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static const char *TAG = "device_data";

// device_data 접근 동기화 (T-05)
static SemaphoreHandle_t s_device_data_mutex = NULL;

void device_data_init(void)
{
    if (s_device_data_mutex == NULL) {
        s_device_data_mutex = xSemaphoreCreateMutex();
    }
}

bool device_data_lock(void)
{
    if (s_device_data_mutex == NULL) {
        return false;
    }
    if (xSemaphoreTake(s_device_data_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGW(TAG, "device_data_lock: mutex timeout");
        return false;
    }
    return true;
}

void device_data_unlock(void)
{
    if (s_device_data_mutex != NULL) {
        xSemaphoreGive(s_device_data_mutex);
    }
}

// 주의:
// - 이 컴포넌트는 "상태 저장소" 역할만 수행한다.
// - LP Core(또는 main)에 대한 의존을 제거하기 위해, 기본값은 이 파일 내부에서 상수로 유지한다.
//   (필요 시 후속 단계에서 contracts로 승격)
//static const float IRINGER_DEFAULT_ORDERED_GTT = 30.0f;
static const float IRINGER_DEFAULT_ORDERED_GTT = 0.0f;
static const float IRINGER_DEFAULT_MIN_GTT = 20.0f;
static const float IRINGER_DEFAULT_MAX_GTT = 40.0f;

static iringer_device_data_t device_data = {
    .device_type   = DEVICE_TYPE,
    .battery_level = DUMMY_BATTERY_LEVEL,
    .fluid_weight  = DUMMY_FLUID_WEIGHT,
    .gtt = 0.0f,
    .ml_per_hour = 0.0f,
    .rest_min = 0,
    .injected_amount = 0.0f,
    .drop_per_sec = 0.0f,
    .drop_cnt = 0,
    .r_volume_max = 1000.0f,
    .r_volume_now = 1000.0f,
    .ordered_gtt = IRINGER_DEFAULT_ORDERED_GTT,
    .min_gtt = IRINGER_DEFAULT_MIN_GTT,
    .max_gtt = IRINGER_DEFAULT_MAX_GTT
};

const iringer_device_data_t *device_data_get(void)
{
    return &device_data;
}

iringer_device_data_t *device_data_get_mutable(void)
{
    return &device_data;
}

