/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * Buzzer Module Implementation
 */
#include "iringer_buzzer.h"
#include "driver/ledc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "BUZZER";

static bool buzzer_pwm_initialized = false;

// 버저 PWM 초기화
static esp_err_t buzzer_pwm_init(void)
{
    if (buzzer_pwm_initialized) {
        return ESP_OK;
    }

    // LEDC 타이머 설정
    ledc_timer_config_t timer_conf = {
        .speed_mode = LEDC_LOW_SPEED_MODE,
        .timer_num = BUZZER_PWM_TIMER,
        .duty_resolution = LEDC_TIMER_8_BIT,  // 0-255
        .freq_hz = BUZZER_PWM_FREQ_HZ,
        .clk_cfg = LEDC_AUTO_CLK,
    };
    esp_err_t ret = ledc_timer_config(&timer_conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "버저 PWM 타이머 설정 실패: %s", esp_err_to_name(ret));
        return ret;
    }

    // LEDC 채널 설정
    ledc_channel_config_t channel_conf = {
        .gpio_num = BUZZER_PIN,
        .speed_mode = LEDC_LOW_SPEED_MODE,
        .channel = BUZZER_PWM_CHANNEL,
        .timer_sel = BUZZER_PWM_TIMER,
        .duty = 0,  // 초기값: OFF
        .hpoint = 0,
    };
    ret = ledc_channel_config(&channel_conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "버저 PWM 채널 설정 실패: %s", esp_err_to_name(ret));
        return ret;
    }

    buzzer_pwm_initialized = true;
    ESP_LOGI(TAG, "버저 PWM 초기화 완료 (GPIO%d, 주파수: %dHz, 듀티: %d%%)", 
             BUZZER_PIN, BUZZER_PWM_FREQ_HZ, BUZZER_PWM_DUTY_LOW);
    return ESP_OK;
}

// 버저 초기화
esp_err_t buzzer_init(void)
{
    return buzzer_pwm_init();
}

// 버저 듀티 사이클 설정 (0-100%)
void buzzer_set_duty(uint8_t duty)
{
    if (!buzzer_pwm_initialized) {
        return;
    }

    if (duty > 100) {
        duty = 100;
    }

    uint32_t duty_value = (duty * 255) / 100;
    esp_err_t ret1 = ledc_set_duty(LEDC_LOW_SPEED_MODE, BUZZER_PWM_CHANNEL, duty_value);
    esp_err_t ret2 = ledc_update_duty(LEDC_LOW_SPEED_MODE, BUZZER_PWM_CHANNEL);

    /* LEDC API 에러만 체크 (GPIO 레벨 체크는 PWM 특성상 거짓 양성 유발) */
    if (duty > 0 && (ret1 != ESP_OK || ret2 != ESP_OK)) {
        ESP_LOGE(TAG, "LEDC 설정 실패: set_duty=%s, update=%s",
                 esp_err_to_name(ret1), esp_err_to_name(ret2));
    }
}

// 버저 ON/OFF
void buzzer_set(bool on)
{
    if (!buzzer_pwm_initialized) {
        return;
    }

    if (on) {
        buzzer_set_duty(BUZZER_PWM_DUTY_LOW);  // 낮은 데시벨
    } else {
        buzzer_set_duty(0);  // OFF
    }
}

// 부팅 시 짧은 버저 알림
void buzzer_beep_once(void)
{
    // PWM 초기화 (실패 시 GPIO로 대체)
    esp_err_t ret = buzzer_pwm_init();
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "버저 PWM 초기화 실패, GPIO로 대체");
        // PWM 실패 시 GPIO 출력으로 대체
        gpio_config_t buzzer_conf = {
            .intr_type = GPIO_INTR_DISABLE,
            .mode = GPIO_MODE_OUTPUT,
            .pin_bit_mask = (1ULL << BUZZER_PIN),
            .pull_up_en = GPIO_PULLUP_DISABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
        };
        gpio_config(&buzzer_conf);
        gpio_set_level(BUZZER_PIN, 0);
        vTaskDelay(pdMS_TO_TICKS(10));
        gpio_set_level(BUZZER_PIN, 1);
        vTaskDelay(pdMS_TO_TICKS(80));
        gpio_set_level(BUZZER_PIN, 0);
        return;
    }

    // PWM으로 짧은 알림음 출력 (낮은 데시벨)
    buzzer_set(true);
    vTaskDelay(pdMS_TO_TICKS(100));  // 100ms
    buzzer_set(false);
}

// 수액 끝 알람: 원샷 타이머로 구간별 정확 타이밍 (폴링/주기 없음)
static bool fluid_end_alarm_active = false;

typedef enum {
    FLUID_END_ALARM_IDLE = 0,
    FLUID_END_ALARM_BEEP_ON,
    FLUID_END_ALARM_BEEP_OFF
} fluid_end_alarm_phase_t;

static fluid_end_alarm_phase_t fluid_end_alarm_phase = FLUID_END_ALARM_IDLE;
static int fluid_end_alarm_beep_count = 0;
static uint32_t fluid_end_alarm_interval_ms = 5000;  // 다음 "삐삐삐" 전 대기 (메인에서 set으로 갱신)
static esp_timer_handle_t fluid_end_alarm_timer_handle = NULL;

static void fluid_end_alarm_timer_cb(void *arg)
{
    (void)arg;
    if (!fluid_end_alarm_active || fluid_end_alarm_timer_handle == NULL) {
        return;
    }
    if (!buzzer_pwm_initialized) {
        return;
    }

    switch (fluid_end_alarm_phase) {
    case FLUID_END_ALARM_BEEP_ON:
        buzzer_set_duty(0);
        fluid_end_alarm_phase = FLUID_END_ALARM_BEEP_OFF;
        esp_timer_start_once(fluid_end_alarm_timer_handle, FLUID_END_ALARM_BEEP_OFF_MS * 1000ULL);
        break;
    case FLUID_END_ALARM_BEEP_OFF:
        fluid_end_alarm_beep_count++;
        if (fluid_end_alarm_beep_count >= FLUID_END_ALARM_BEEP_COUNT) {
            fluid_end_alarm_phase = FLUID_END_ALARM_IDLE;
            ESP_LOGI(TAG, "수액 끝 알람 한 주기 완료 (볼륨: %d%%)", FLUID_END_ALARM_VOLUME_PERCENT);
            esp_timer_start_once(fluid_end_alarm_timer_handle, (uint64_t)fluid_end_alarm_interval_ms * 1000ULL);
        } else {
            fluid_end_alarm_phase = FLUID_END_ALARM_BEEP_ON;
            buzzer_set_duty(FLUID_END_ALARM_VOLUME_PERCENT);
            esp_timer_start_once(fluid_end_alarm_timer_handle, FLUID_END_ALARM_BEEP_ON_MS * 1000ULL);
        }
        break;
    case FLUID_END_ALARM_IDLE:
        fluid_end_alarm_phase = FLUID_END_ALARM_BEEP_ON;
        fluid_end_alarm_beep_count = 0;
        buzzer_set_duty(FLUID_END_ALARM_VOLUME_PERCENT);
        esp_timer_start_once(fluid_end_alarm_timer_handle, FLUID_END_ALARM_BEEP_ON_MS * 1000ULL);
        break;
    }
}

static void fluid_end_alarm_timer_ensure_created(void)
{
    if (fluid_end_alarm_timer_handle != NULL) {
        return;
    }
    esp_timer_create_args_t args = {
        .callback = fluid_end_alarm_timer_cb,
        .name = "fluid_end_alarm",
    };
    if (esp_timer_create(&args, &fluid_end_alarm_timer_handle) != ESP_OK) {
        fluid_end_alarm_timer_handle = NULL;
    }
}

// 수액 끝 알람 활성화 (interval_ms: 다음 "삐삐삐" 반복 전 대기, iringer_alarm_config.h 값 사용)
void buzzer_alarm_fluid_end_start(uint32_t interval_ms)
{
    if (fluid_end_alarm_active) {
        return;
    }
    fluid_end_alarm_active = true;
    fluid_end_alarm_interval_ms = interval_ms;
    if (!buzzer_pwm_initialized && buzzer_pwm_init() != ESP_OK) {
        fluid_end_alarm_active = false;
        ESP_LOGW(TAG, "버저 알람 실패: PWM 초기화 실패");
        return;
    }
    fluid_end_alarm_timer_ensure_created();
    if (fluid_end_alarm_timer_handle == NULL) {
        fluid_end_alarm_active = false;
        return;
    }
    fluid_end_alarm_phase = FLUID_END_ALARM_BEEP_ON;
    fluid_end_alarm_beep_count = 0;
    buzzer_set_duty(FLUID_END_ALARM_VOLUME_PERCENT);
    esp_timer_start_once(fluid_end_alarm_timer_handle, FLUID_END_ALARM_BEEP_ON_MS * 1000ULL);
    ESP_LOGW(TAG, "수액 끝 알람 시작 (기기 종료 시까지 무한 반복, interval=%lu ms)", (unsigned long)interval_ms);
}

// 수액 끝 알람 반복 간격 갱신 (메인에서 1초마다 5초/10초 설정 전달)
void buzzer_alarm_fluid_end_set_interval(uint32_t interval_ms)
{
    fluid_end_alarm_interval_ms = interval_ms;
}

// 수액 끝 알람 중지
void buzzer_alarm_fluid_end_stop(void)
{
    if (!fluid_end_alarm_active) {
        return;
    }
    fluid_end_alarm_active = false;
    if (fluid_end_alarm_timer_handle != NULL && esp_timer_is_active(fluid_end_alarm_timer_handle)) {
        esp_timer_stop(fluid_end_alarm_timer_handle);
    }
    fluid_end_alarm_phase = FLUID_END_ALARM_IDLE;
    fluid_end_alarm_beep_count = 0;
    buzzer_set(false);
    ESP_LOGI(TAG, "수액 끝 알람 중지 (수액 감지 재개)");
}

// 수액 끝 알람 활성 상태 확인
bool buzzer_alarm_fluid_end_is_active(void)
{
    return fluid_end_alarm_active;
}

