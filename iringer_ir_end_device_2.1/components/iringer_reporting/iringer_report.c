/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 리포트 페이로드 빌드 모듈 구현
 */
#include "iringer_report.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "IRINGER_REPORT";

void report_build_from_device_data(const iringer_device_data_t *data,
                                   ir_payload_t *payload,
                                   zboctet_t *octet)
{
    if (data == NULL || payload == NULL || octet == NULL) {
        return;
    }

    memset(payload, 0, sizeof(ir_payload_t));

    payload->type = data->device_type;
    memcpy(payload->sn, data->serial_number, 4);
    payload->weight = (uint16_t)(data->fluid_weight * 100.0f);
    payload->bat = (uint8_t)data->battery_level;

    uint16_t gtt_int = (data->gtt > 65535.0f) ? 65535 : (uint16_t)(data->gtt + 0.5f);
    payload->gtt = gtt_int;

    uint16_t cchr_int = (data->ml_per_hour > 65535.0f) ? 65535 : (uint16_t)(data->ml_per_hour + 0.5f);
    payload->cchr = cchr_int;

    payload->rest = (data->rest_min > 255) ? 255 : (uint8_t)data->rest_min;
    payload->inj = (uint32_t)(data->injected_amount * 1000.0f);
    /* payload->time 는 report_set_timestamp()에서 설정 */

    memset(octet, 0, sizeof(zboctet_t));
    size_t payload_size = sizeof(ir_payload_t);
    octet->len = (uint8_t)payload_size;
    memcpy(octet->data, payload, payload_size);

    if (octet->len != 21) {
        ESP_LOGW(TAG, "리포트 데이터 크기 오류: len=%d, expected=21", octet->len);
    }
    ESP_LOGD(TAG, "Report generated: len=%d, r_vol=%.1f/%.1f, gtt=%u, cc/hr=%u",
             octet->len, data->r_volume_now, data->r_volume_max, gtt_int, cchr_int);
}

void report_set_timestamp(ir_payload_t *payload, zboctet_t *octet, uint32_t timestamp_sec)
{
    if (payload == NULL || octet == NULL) {
        return;
    }
    payload->time = timestamp_sec;
    if (octet->len >= sizeof(ir_payload_t)) {
        memcpy(&octet->data[sizeof(ir_payload_t) - sizeof(uint32_t)],
               &timestamp_sec, sizeof(uint32_t));
    }
}

