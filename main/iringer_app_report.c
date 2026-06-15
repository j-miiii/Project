/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * IRINGER App Report 모듈
 * 리포트 페이로드 빌드 및 Zigbee Report Attribute 전송
 */
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_zigbee_core.h"
#include "aps/esp_zigbee_aps.h"
#include "zcl/esp_zigbee_zcl_common.h"
#include "iringer_report.h"
#include "iringer_app_common.h"
#include "iringer_app_report.h"
#include "iringer_device_data.h"
#include "iringer_tft.h"
#include "iringer_ir_end_device_2.1.h"
#include "iringer_battery.h"

static const char *TAG = "IRINGER_REPORT";

#define REPORT_TX_DELAY_MS  1100   // Zigbee 스택 TX 처리 대기 (딜레이 기반)

static zboctet_t report_octet;
static ir_payload_t payload_binary;

zboctet_t *report_get_octet_ptr(void)
{
    return &report_octet;
}

static void update_report_data(void)
{
    report_build_from_device_data(device_data_get(), &payload_binary, &report_octet);
}

static void update_timestamp_only(void)
{
    static uint32_t last_report_timestamp = 0;
    uint32_t timestamp_sec = 0;

    bool synced = false;
    uint32_t server_base = 0;
    int64_t boot_us = 0;
    if (app_globals_lock()) {
        synced = g_server_time_synced && g_server_time_base > 0;
        server_base = g_server_time_base;
        boot_us = g_boot_time_us;
        app_globals_unlock();
    }
    if (synced && server_base > 0) {
        int64_t current_boot_time_us = esp_timer_get_time();
        int64_t elapsed_sec = (current_boot_time_us - boot_us) / 1000000;
        timestamp_sec = server_base + (uint32_t)elapsed_sec;
        ESP_LOGD(TAG, "실시간 절대 시간 생성: server_time_base=%lu, elapsed=%lld, timestamp=%lu (KST)",
                 (unsigned long)server_base, (long long)elapsed_sec, timestamp_sec);
    } else {
        int64_t timestamp_us = esp_timer_get_time();
        uint32_t timestamp_ms = (uint32_t)(timestamp_us / 1000);
        timestamp_sec = (timestamp_ms / 1000 > 65535) ? 65535 : (uint32_t)(timestamp_ms / 1000);
        ESP_LOGW(TAG, "실시간 상대 시간 생성: timestamp=%lu (서버 시간 동기화 미완료)", timestamp_sec);
    }

    if (timestamp_sec <= last_report_timestamp) {
        timestamp_sec = last_report_timestamp + 1;
        ESP_LOGW(TAG, "타임스탬프 보정: 이전 값(%lu)보다 작거나 같아 +1초 보정됨 -> %lu", last_report_timestamp, timestamp_sec);
    }
    last_report_timestamp = timestamp_sec;

    report_set_timestamp(&payload_binary, &report_octet, timestamp_sec);
}

void iringer_update_tft_display_data(void)
{
    /* 슬립 중에도 버퍼는 항상 최신값으로 유지해야 웨이크 시 print_data()가 현재 값(GTT=0 등) 표시 */
    const iringer_device_data_t *d = device_data_get();
    tft_display_data_t tft_data = {
        .battery_level = d->battery_level,
        .gtt = d->gtt,
        .ml_per_hour = d->ml_per_hour,
        .rest_min = d->rest_min,
        .injected_amount = d->injected_amount,
        .r_volume_max = d->r_volume_max,
        .r_volume_now = d->r_volume_now,
        .ordered_cchr = d->ordered_gtt,  //   tft_display_data_t에  float ordered_cchr 추가 박스에 담는곳
    };
    tft_set_display_data(&tft_data);
}

void esp_app_iringer_data_handler(bool force_report)
{
    (void)force_report;

    if (!device_data_lock()) {
        ESP_LOGW(TAG, "esp_app_iringer_data_handler: device_data_lock timeout, skip report");
        return;
    }
    /* LCD sleeping이면 TFT 업데이트 스킵 (suspended UI 태스크에 보내봐야 실패만 함) */
    if (!tft_is_lcd_sleeping()) {
        iringer_update_tft_display_data();
    }
    update_report_data();
    update_timestamp_only();
    device_data_unlock();

    if (esp_zb_lock_acquire(pdMS_TO_TICKS(2000)) != pdTRUE) {
        ESP_LOGW(TAG, "esp_app_iringer_data_handler: Zigbee lock timeout, skip report");
        return;
    }

#if SHOW_SHORT_ADDRESS
    uint16_t my_addr = esp_zb_get_short_address();
    uint16_t pan_id = esp_zb_get_pan_id();
    uint16_t parent_addr = get_ed_parent_addr();
#endif

    ESP_LOGD(TAG, "리포트 전송 준비: report_octet.len=%d, sizeof(ir_payload_t)=%zu",
             report_octet.len, sizeof(ir_payload_t));
    if (report_octet.len != sizeof(ir_payload_t)) {
        ESP_LOGE(TAG, "리포트 데이터 크기 불일치: len=%d, expected=%zu",
                 report_octet.len, sizeof(ir_payload_t));
    }

    esp_zb_zcl_set_attribute_val(IRINGER_ENDPOINT,
                                 ESP_ZB_ZCL_CLUSTER_ID_IRINGER_DATA,
                                 ESP_ZB_ZCL_CLUSTER_SERVER_ROLE,
                                 ESP_ZB_ZCL_ATTR_IRINGER_DATA_BUNDLE_ID,
                                 &report_octet,
                                 false);

    esp_zb_zcl_report_attr_cmd_t report_attr_cmd = {0};
    report_attr_cmd.address_mode = ESP_ZB_APS_ADDR_MODE_16_ENDP_PRESENT;
    report_attr_cmd.zcl_basic_cmd.src_endpoint = IRINGER_ENDPOINT;
    report_attr_cmd.zcl_basic_cmd.dst_endpoint = IRINGER_COORDINATOR_ENDPOINT;
    report_attr_cmd.zcl_basic_cmd.dst_addr_u.addr_short = 0x0000;
    report_attr_cmd.direction = ESP_ZB_ZCL_CMD_DIRECTION_TO_CLI;
    report_attr_cmd.attributeID = ESP_ZB_ZCL_ATTR_IRINGER_DATA_BUNDLE_ID;
    report_attr_cmd.clusterID = ESP_ZB_ZCL_CLUSTER_ID_IRINGER_DATA;

    esp_err_t ret = esp_zb_zcl_report_attr_cmd_req(&report_attr_cmd);
    esp_zb_lock_release();

    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Report Attribute Command 전송 실패: err=%s (0x%x)", esp_err_to_name(ret), ret);
        return;
    }

#if SHOW_SHORT_ADDRESS
    if (!tft_is_lcd_sleeping()) {
        tft_set_short_address_ed(my_addr, parent_addr, pan_id);
    }
#endif

    vTaskDelay(pdMS_TO_TICKS(REPORT_TX_DELAY_MS));

    if (report_octet.len > 0) {
        bool time_synced = false;
        if (app_globals_lock()) {
            time_synced = (g_server_time_synced && g_server_time_base > 0);
            app_globals_unlock();
        }
        const char *time_type = time_synced ? "절대시간(KST)" : "상대시간";
        if (!device_data_lock()) {
            ESP_LOGW(TAG, "esp_app_iringer_data_handler: device_data_lock timeout (log), skip");
            return;
        }
        uint32_t time_value = payload_binary.time;

        ESP_LOGD(TAG, "ZCL Report (OCTET_STRING): len=%d, SN=iRinger-%.4s, GTT=%.1f, CC/HR=%.1f, REST=%u, INJ=%.3f, BAT=%d%%, TIME=%lu (%s)",
                 report_octet.len,
                 device_data_get_mutable()->serial_number,
                 device_data_get_mutable()->gtt,
                 device_data_get_mutable()->ml_per_hour,
                 device_data_get_mutable()->rest_min,
                 device_data_get_mutable()->injected_amount,
                 device_data_get_mutable()->battery_level,
                 time_value,
                 time_type);
        ESP_LOGD(TAG, "송신 데이터 (바이너리): len=%d, data=%.*s",
                 report_octet.len, report_octet.len, report_octet.data);
        device_data_unlock();
    }
}

void esp_app_iringer_data_init(void)
{
    if (!device_data_lock()) {
        ESP_LOGW(TAG, "esp_app_iringer_data_init: device_data_lock timeout, skip init");
        return;
    }
    update_report_data();
    device_data_unlock();
    if (esp_zb_lock_acquire(pdMS_TO_TICKS(2000)) == pdTRUE) {
        esp_zb_zcl_set_attribute_val(IRINGER_ENDPOINT,
            ESP_ZB_ZCL_CLUSTER_ID_IRINGER_DATA, ESP_ZB_ZCL_CLUSTER_SERVER_ROLE,
            ESP_ZB_ZCL_ATTR_IRINGER_DATA_BUNDLE_ID, &report_octet, false);
        esp_zb_lock_release();
    } else {
        ESP_LOGW(TAG, "esp_app_iringer_data_init: Zigbee lock timeout");
    }
    ESP_LOGD(TAG, "Initialize Report (OCTET_STRING): len=%d, data=%.*s",
             report_octet.len, report_octet.len, report_octet.data);
}
