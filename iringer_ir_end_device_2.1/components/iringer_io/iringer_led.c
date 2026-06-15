/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LED 제어 모듈 구현
 * GPIO1을 사용하여 PWR LED 제어 (HP Core에서 직접 제어)
 */

#include "iringer_led.h"
#include "driver/gpio.h"
#include "esp_log.h"

static const char *TAG = "LED";

// LED GPIO 초기화
// GPIO1을 출력 모드로 초기화하여 HP Core에서 직접 제어
static esp_err_t led_pwm_init(void)
{
    // GPIO1 초기화 (출력 모드)
    gpio_config_t io_conf = {
        .intr_type = GPIO_INTR_DISABLE,
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = (1ULL << LED_PWR_GPIO),
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .pull_up_en = GPIO_PULLUP_DISABLE,
    };
    esp_err_t ret = gpio_config(&io_conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "GPIO1 초기화 실패: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // 초기값: HIGH (Wakeup 시)
    gpio_set_level(LED_PWR_GPIO, 1);
    
    ESP_LOGI(TAG, "LED 제어 초기화 완료 (GPIO1은 HP Core에서 직접 제어, Sleep=LOW, Wakeup=HIGH)");
    return ESP_OK;
}

// LED ON/OFF 설정 - HP Core에서 직접 GPIO 제어
void led_pwr_set(bool on)
{
    gpio_set_level(LED_PWR_GPIO, on ? 1 : 0);  // true = HIGH, false = LOW
    ESP_LOGD(TAG, "LED %s (GPIO1 직접 제어)", on ? "ON" : "OFF");
}

void led_pwr_init(void)
{
    // GPIO1을 출력 모드로 초기화하여 HP Core에서 직접 제어
    esp_err_t ret = led_pwm_init();
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "LED 제어 초기화 실패: %s", esp_err_to_name(ret));
    }
    // 초기값은 led_pwm_init()에서 HIGH로 설정됨
}

