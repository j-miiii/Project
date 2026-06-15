/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * Battery Management Module Implementation
 * 새로운 하드웨어 기판 v2.1 기준: IO4 (BAT_AD), IO15 (BAT_MEASURE)
 * 
 * 참고: Arduino 코드는 STC3115를 사용하지만, 현재는 ADC 방식으로 구현
 * 추후 STC3115 I2C 통신으로 업그레이드 가능
 */
#include "iringer_battery.h"
#include <stdbool.h>
#include "driver/gpio.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_system.h"  // esp_reset_reason, ESP_RST_BROWNOUT
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "BATTERY";

// ADC 핸들러
static adc_oneshot_unit_handle_t adc1_handle = NULL;
static adc_cali_handle_t adc1_cali_handle = NULL;
static bool adc_calibration_init = false;

// C6IRINGER3simple 배터리 측정 로직 포팅
#define ANALOGIC_RESOLUTION 4096  // ESP32-C6 ADC 해상도 (12bit)
#define REFERENCE_VOLTAGE 3.3f   // MCU 인가 전압 3.3V
#define EXPECTED_V_OUT 4.2f       // 충전 전압 4.2V
#define MEDIAN_SAMPLE_SIZE 11     // 중간값 계산용 샘플 수
// 실측 기반 1:1 분압 보정 계수 (4.2V / 2.035V ≈ 2.0638)
// vIn = vOut * CORRECTION_FACTOR
#define CORRECTION_FACTOR 2.0638f

// 중간값 계산용 배열
static float fSvalue[MEDIAN_SAMPLE_SIZE];

// 이전 측정값 (실패/비정상 시 사용)
static uint32_t s_last_voltage_mv = 0;
static uint8_t s_last_level = 0;

// 한 번 측정 후 get_voltage/get_level이 같은 값 공유 (get_voltage 호출 시 측정, get_level은 캐시 사용)
static uint32_t s_cached_voltage_mv = 0;
static uint8_t s_cached_level = 0;
static bool s_cache_valid = false;

// ADC 포화(4095) 등 비정상값 임계
#define ADC_ABNORMAL_HIGH  4080  // 12-bit ADC 포화 근접

// 포화 시 1회 재측정 대기 (노이즈/wake 직후 불안정 구간 완화)
#define ADC_SATURATION_RETRY_DELAY_MS  250

// BAT_MEASURE ON 직후 분압 회로 안정화 대기 (포화 오탐 완화)
#define BAT_MEASURE_SETTLE_MS  20

// ADC 캘리브레이션 초기화
static bool adc_calibration_init_func(adc_unit_t unit, adc_atten_t atten, adc_cali_handle_t *out_handle)
{
    adc_cali_handle_t handle = NULL;
    esp_err_t ret = ESP_FAIL;
    bool calibrated = false;

#if ADC_CALI_SCHEME_CURVE_FITTING_SUPPORTED
    if (!calibrated) {
        ESP_LOGI(TAG, "커브 피팅 캘리브레이션 스킴 사용");
        adc_cali_curve_fitting_config_t cali_config = {
            .unit_id = unit,
            .atten = atten,
            .bitwidth = ADC_BITWIDTH_DEFAULT,
        };
        ret = adc_cali_create_scheme_curve_fitting(&cali_config, &handle);
        if (ret == ESP_OK) {
            calibrated = true;
        }
    }
#endif

#if ADC_CALI_SCHEME_LINE_FITTING_SUPPORTED
    if (!calibrated) {
        ESP_LOGI(TAG, "선형 피팅 캘리브레이션 스킴 사용");
        adc_cali_curve_fitting_config_t cali_config = {
            .unit_id = unit,
            .atten = atten,
            .bitwidth = ADC_BITWIDTH_DEFAULT,
        };
        ret = adc_cali_create_scheme_curve_fitting(&cali_config, &handle);
        if (ret == ESP_OK) {
            calibrated = true;
        }
    }
#endif

    *out_handle = handle;
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "ADC 캘리브레이션 성공");
    } else if (ret == ESP_ERR_NOT_SUPPORTED || !calibrated) {
        ESP_LOGW(TAG, "캘리브레이션 스킴이 지원되지 않음, 기본값 사용");
    } else {
        ESP_LOGE(TAG, "ADC 캘리브레이션 실패");
    }

    return calibrated;
}

// 중간값 찾기 함수 (C6IRINGER3simple FindMedianValue 포팅)
static float find_median_value(void)
{
    // 배열을 오름차순으로 정렬 (버블 정렬)
    for (int i = 0; i < MEDIAN_SAMPLE_SIZE - 1; i++) {
        for (int j = 0; j < MEDIAN_SAMPLE_SIZE - i - 1; j++) {
            if (fSvalue[j] > fSvalue[j + 1]) {
                float temp = fSvalue[j];
                fSvalue[j] = fSvalue[j + 1];
                fSvalue[j + 1] = temp;
            }
        }
    }
    
    return fSvalue[MEDIAN_SAMPLE_SIZE / 2];  // 중간값 반환
}

// Arduino map() 함수 대체 매크로 (adc_raw_to_level 등에서 사용)
#define MAP(x, in_min, in_max, out_min, out_max) \
  (((x) - (in_min)) * ((out_max) - (out_min)) / ((in_max) - (in_min)) + (out_min))

/**
 * 배터리 ADC 1회 측정 (BAT_MEASURE ON → 샘플 → OFF).
 * 포화(ADC_ABNORMAL_HIGH 이상) 시 1회 재측정 (Light Sleep 복귀 후 불안정 구간 대응).
 * @return ADC 원시값 (0~4095), 비정상/실패 시 -1
 */
static int battery_measure_adc(void)
{
    if (adc1_handle == NULL) {
        return -1;
    }
    gpio_hold_dis(BAT_MEASURE_PIN);
    gpio_set_level(BAT_MEASURE_PIN, 0);
    vTaskDelay(pdMS_TO_TICKS(BAT_MEASURE_SETTLE_MS));

    for (int i = 0; i < MEDIAN_SAMPLE_SIZE; i++) {
        int raw = 0;
        esp_err_t ret = adc_oneshot_read(adc1_handle, ADC_CHANNEL_4, &raw);
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "배터리 ADC 읽기 실패: %s", esp_err_to_name(ret));
            gpio_set_level(BAT_MEASURE_PIN, 1);
            gpio_hold_en(BAT_MEASURE_PIN);
            return -1;
        }
        fSvalue[i] = (float)raw;
        vTaskDelay(pdMS_TO_TICKS(10));
    }

    int adc_raw = (int)find_median_value();
    gpio_set_level(BAT_MEASURE_PIN, 1);
    gpio_hold_en(BAT_MEASURE_PIN);

    if (adc_raw >= ADC_ABNORMAL_HIGH) {
        /* 포화 시 1회 재측정 (Light Sleep 복귀 후 ADC 불안정/노이즈 완화) */
        vTaskDelay(pdMS_TO_TICKS(ADC_SATURATION_RETRY_DELAY_MS));
        gpio_hold_dis(BAT_MEASURE_PIN);
        gpio_set_level(BAT_MEASURE_PIN, 0);
        vTaskDelay(pdMS_TO_TICKS(500));  /* 재측정용 축약 대기 (분압 회로는 방금 OFF됐으므로 500ms로 충분) */
        int retry_raw = 0;
        for (int i = 0; i < MEDIAN_SAMPLE_SIZE; i++) {
            int r = 0;
            if (adc_oneshot_read(adc1_handle, ADC_CHANNEL_4, &r) == ESP_OK) {
                fSvalue[i] = (float)r;
            }
            vTaskDelay(pdMS_TO_TICKS(10));
        }
        retry_raw = (int)find_median_value();
        gpio_set_level(BAT_MEASURE_PIN, 1);
        gpio_hold_en(BAT_MEASURE_PIN);
        if (retry_raw < ADC_ABNORMAL_HIGH) {
            return retry_raw;
        }
        ESP_LOGW(TAG, "배터리 ADC 비정상값(포화): %d (재측정 후 %d)", adc_raw, retry_raw);
        return -1;
    }
    return adc_raw;
}

/** ADC 원시값 → 전압(mV) 변환 */
static uint32_t adc_raw_to_voltage_mv(int adc_raw)
{
    float vOut = (adc_raw * REFERENCE_VOLTAGE) / ANALOGIC_RESOLUTION;
    float vIn = vOut * CORRECTION_FACTOR;
    return (uint32_t)(vIn * 1000.0f);
}

/** ADC 원시값 → 레벨(0~100%) 변환 (5% 단계 유지) */
static uint8_t adc_raw_to_level(int adc_raw)
{
    int percent = 0;
    if (adc_raw >= BATTERY_ADC_100_PCT) {
        percent = 100;
    } else if (adc_raw >= BATTERY_ADC_90_PCT) {
        percent = MAP(adc_raw, BATTERY_ADC_90_PCT, BATTERY_ADC_100_PCT, 90, 100);
    } else if (adc_raw >= BATTERY_ADC_10_PCT) {
        percent = MAP(adc_raw, BATTERY_ADC_10_PCT, BATTERY_ADC_90_PCT, 10, 90);
    } else if (adc_raw >= BATTERY_ADC_0_PCT) {
        percent = MAP(adc_raw, BATTERY_ADC_0_PCT, BATTERY_ADC_10_PCT, 0, 10);
    } else {
        percent = 0;
    }
    int current_step = (percent / 5) * 5;
    static int change_bat = 0;
    static uint8_t bat = 0;
    if (!change_bat) {
        change_bat = current_step;
    }
    if (change_bat != current_step) {
        change_bat = current_step;
    } else {
        bat = (uint8_t)current_step;
    }
    return bat;
}

/* 전원 이상 대응 (30일 PoC #6): brownout 시에만 ADC 초기화 전 전원 안정화 대기.
   cold boot(POWERON) 대기는 app_main에서 이미 수행되며, battery_init 추가 대기는
   capacitor_sensor_init/lp_core 타이밍에 영향을 줄 수 있어 제거함. */
#define ADC_INIT_DELAY_MS  100

/** Light Sleep 복귀 후 ADC 유닛 해제 및 재생성 (IDFGH-6252 대응: 포화 오류 방지).
 * config_channel만으로는 내부 상태가 초기화되지 않아 adc_oneshot_del_unit + new_unit 필요. */
void battery_adc_reinit(void)
{
    if (adc1_handle == NULL) {
        return;
    }
    adc_oneshot_del_unit(adc1_handle);
    adc1_handle = NULL;

    adc_oneshot_unit_init_cfg_t init_cfg = {
        .unit_id = ADC_UNIT_1,
    };
    esp_err_t ret = adc_oneshot_new_unit(&init_cfg, &adc1_handle);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "ADC 유닛 재생성 실패: %s", esp_err_to_name(ret));
        return;
    }

    adc_oneshot_chan_cfg_t chan_cfg = {
        .bitwidth = ADC_BITWIDTH_DEFAULT,
        .atten = ADC_ATTEN_DB_12,
    };
    ret = adc_oneshot_config_channel(adc1_handle, ADC_CHANNEL_4, &chan_cfg);
    if (ret == ESP_OK) {
        ESP_LOGD(TAG, "ADC 유닛 재초기화 완료 (Light Sleep 복귀)");
    } else {
        ESP_LOGW(TAG, "ADC 채널 재설정 실패: %s", esp_err_to_name(ret));
    }
}

// 배터리 초기화
esp_err_t battery_init(void)
{
    ESP_LOGI(TAG, "배터리 모듈 초기화 시작");
    if (esp_reset_reason() == ESP_RST_BROWNOUT) {
        vTaskDelay(pdMS_TO_TICKS(ADC_INIT_DELAY_MS));  // brownout 시에만 전원 안정화 대기
    }

    // BAT_CON 핀 설정 (BAT_AD 기능 ON/OFF 제어)
    gpio_config_t bat_con_conf = {
        .intr_type = GPIO_INTR_DISABLE,
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = (1ULL << BAT_MEASURE_PIN),
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
    };
    gpio_config(&bat_con_conf);
    gpio_set_level(BAT_MEASURE_PIN, 1);  // 기본 OFF (HIGH), 측정 시에만 LOW
    
    // ADC1 초기화
    adc_oneshot_unit_init_cfg_t init_config1 = {
        .unit_id = ADC_UNIT_1,
    };
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&init_config1, &adc1_handle));
    
    // ADC 채널 설정 (BAT_AD 핀: GPIO_NUM_4 = ADC1_CHANNEL_4)
    adc_oneshot_chan_cfg_t config = {
        .bitwidth = ADC_BITWIDTH_DEFAULT,
        .atten = ADC_ATTEN_DB_12,  // 0-3.3V 범위
    };
    // ESP32-C6: GPIO 4 = ADC1_CHANNEL_4
    ESP_ERROR_CHECK(adc_oneshot_config_channel(adc1_handle, ADC_CHANNEL_4, &config));
    
    // ADC 캘리브레이션 초기화
    adc_calibration_init = adc_calibration_init_func(ADC_UNIT_1, ADC_ATTEN_DB_12, &adc1_cali_handle);
    
    ESP_LOGI(TAG, "배터리 모듈 초기화 완료");
    return ESP_OK;
}

// 배터리 전압 읽기 (mV). 측정 1회 수행 후 전압/레벨 캐시에 저장.
// 실패 또는 비정상값(포화 등) 시 이전값 반환 (크래시 방지)
uint32_t battery_get_voltage(void)
{
    if (adc1_handle == NULL) {
        ESP_LOGW(TAG, "ADC 핸들러가 초기화되지 않음");
        return s_last_voltage_mv;
    }

    int adc_raw = battery_measure_adc();
    if (adc_raw < 0) {
        return s_last_voltage_mv;
    }

    uint32_t voltage_mv = adc_raw_to_voltage_mv(adc_raw);
    s_last_voltage_mv = voltage_mv;
    s_cached_voltage_mv = voltage_mv;
    s_cached_level = adc_raw_to_level(adc_raw);
    s_cache_valid = true;

    ESP_LOGI(TAG, "배터리 전압 측정: ADC 원시값=%d, vIn=%lumV", adc_raw, (unsigned long)voltage_mv);
    return voltage_mv;
}

// 배터리 레벨 읽기 (0-100%). get_voltage() 직후 호출 시 캐시 사용(재측정 없음).
// 단독 호출 시 1회 측정 후 반환. 실패/비정상 시 이전값 반환.
uint8_t battery_get_level(void)
{
    if (adc1_handle == NULL) {
        ESP_LOGW(TAG, "ADC 핸들러가 초기화되지 않음");
        return s_last_level;
    }

    if (s_cache_valid) {
        s_cache_valid = false;
        s_last_level = s_cached_level;
        ESP_LOGI(TAG, "배터리 레벨: 캐시 사용 level=%d%%", s_cached_level);
        return s_cached_level;
    }

    int adc_raw = battery_measure_adc();
    if (adc_raw < 0) {
        return s_last_level;
    }

    uint8_t level = adc_raw_to_level(adc_raw);
    s_last_level = level;
    ESP_LOGI(TAG, "배터리 레벨 측정: ADC=%d, level=%d%%", adc_raw, level);
    return level;
}

