/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * Zigbee 클러스터/엔드포인트 생성 및 TX Power, Power Save 초기화
 */
#ifndef IRINGER_ZIGBEE_H
#define IRINGER_ZIGBEE_H

#include "iringer_ir_end_device_2.1.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

// Zigbee TX Power 설정 (저전력)
void zigbee_setup_tx_power(void);

// Power Management 초기화 (Light Sleep 등)
esp_err_t zigbee_power_save_init(void);

// iringer 디바이스 엔드포인트 생성
// 업링크(report_octet)와 다운링크(속성 저장소)는 분리됨 - esp_app_iringer_data_handler에서
// set_attribute_val로 업링크 데이터를 속성에 복사 후 Report 전송
esp_zb_ep_list_t *zigbee_iringer_ep_create(uint8_t endpoint_id,
                                          esp_zb_iringer_device_cfg_t *device_cfg);

#ifdef __cplusplus
}
#endif

#endif // IRINGER_ZIGBEE_H

