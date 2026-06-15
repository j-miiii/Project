/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 앱 설정 NVS 저장소 모듈 구현
 */
#include "iringer_storage.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "esp_log.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char *TAG = "IRINGER_STORAGE";

void storage_set_total_ml(int value)
{
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err == ESP_OK) {
        char value_str[20];
        snprintf(value_str, sizeof(value_str), "%d", value);
        err = nvs_set_str(nvs_handle, IRINGER_STORAGE_KEY_ML, value_str);
        if (err == ESP_OK) {
            nvs_commit(nvs_handle);
            ESP_LOGI(TAG, "%s %d ml", "NVS에 총 수액량 저장:", value);
        } else {
            ESP_LOGW(TAG, "%s %s", "NVS 저장 실패:", esp_err_to_name(err));
        }
        nvs_close(nvs_handle);
    }
}

int storage_get_total_ml(void)
{
    nvs_handle_t nvs_handle;
    int result = -1;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err == ESP_OK) {
        size_t required_size = 20;
        char ml_str[20] = {0};
        err = nvs_get_str(nvs_handle, IRINGER_STORAGE_KEY_ML, ml_str, &required_size);
        if (err == ESP_OK) {
            result = atoi(ml_str);
        }
        nvs_close(nvs_handle);
    }
    return result;
}

bool storage_is_initial_data_received(void)
{
    nvs_handle_t nvs_handle;
    bool result = false;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err == ESP_OK) {
        uint8_t flag = 0;
        err = nvs_get_u8(nvs_handle, IRINGER_STORAGE_KEY_INIT, &flag);
        if (err == ESP_OK && flag == 1) {
            result = true;
        }
        nvs_close(nvs_handle);
    }
    return result;
}

void storage_set_initial_data_received(void)
{
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err == ESP_OK) {
        err = nvs_set_u8(nvs_handle, IRINGER_STORAGE_KEY_INIT, 1);
        if (err == ESP_OK) {
            nvs_commit(nvs_handle);
            ESP_LOGI(TAG, "%s", "초기 데이터 수신 플래그 저장 완료");
        } else {
            ESP_LOGW(TAG, "%s %s", "초기 데이터 수신 플래그 저장 실패:", esp_err_to_name(err));
        }
        nvs_close(nvs_handle);
    }
}

uint32_t storage_get_reboot_count(void)
{
    nvs_handle_t nvs_handle;
    uint32_t result = 0;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err == ESP_OK) {
        err = nvs_get_u32(nvs_handle, IRINGER_STORAGE_KEY_REBOOT_CNT, &result);
        if (err != ESP_OK) {
            result = 0;
        }
        nvs_close(nvs_handle);
    }
    return result;
}

void storage_inc_reboot_count(void)
{
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err == ESP_OK) {
        uint32_t cnt = 0;
        nvs_get_u32(nvs_handle, IRINGER_STORAGE_KEY_REBOOT_CNT, &cnt);
        cnt++;
        err = nvs_set_u32(nvs_handle, IRINGER_STORAGE_KEY_REBOOT_CNT, cnt);
        if (err == ESP_OK) {
            nvs_commit(nvs_handle);
        }
        nvs_close(nvs_handle);
    }
}

void storage_set_last_reset_reason(uint32_t reason)
{
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err == ESP_OK) {
        err = nvs_set_u32(nvs_handle, IRINGER_STORAGE_KEY_RESET_REASON, reason);
        if (err == ESP_OK) {
            nvs_commit(nvs_handle);
        }
        nvs_close(nvs_handle);
    }
}

uint32_t storage_get_last_reset_reason(void)
{
    nvs_handle_t nvs_handle;
    uint32_t result = 0;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err == ESP_OK) {
        err = nvs_get_u32(nvs_handle, IRINGER_STORAGE_KEY_RESET_REASON, &result);
        if (err != ESP_OK) {
            result = 0;
        }
        nvs_close(nvs_handle);
    }
    return result;
}

uint32_t storage_get_reconnect_count(void)
{
    nvs_handle_t nvs_handle;
    uint32_t result = 0;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err == ESP_OK) {
        err = nvs_get_u32(nvs_handle, IRINGER_STORAGE_KEY_RECONNECT_CNT, &result);
        if (err != ESP_OK) {
            result = 0;
        }
        nvs_close(nvs_handle);
    }
    return result;
}

void storage_inc_reconnect_count(void)
{
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(IRINGER_STORAGE_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err == ESP_OK) {
        uint32_t cnt = 0;
        nvs_get_u32(nvs_handle, IRINGER_STORAGE_KEY_RECONNECT_CNT, &cnt);
        cnt++;
        err = nvs_set_u32(nvs_handle, IRINGER_STORAGE_KEY_RECONNECT_CNT, cnt);
        if (err == ESP_OK) {
            nvs_commit(nvs_handle);
        }
        nvs_close(nvs_handle);
    }
}

