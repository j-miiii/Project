/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * IRINGER App Report 모듈 (리포트 전송)
 */
#ifndef IRINGER_APP_REPORT_H
#define IRINGER_APP_REPORT_H

#include <stdbool.h>
#include "iringer_ir_end_device_2.1.h"

#ifdef __cplusplus
extern "C" {
#endif

// 리포트 전송 (Zigbee Report Attribute)
void esp_app_iringer_data_handler(bool force_report);

// 리포트 초기화 (Zigbee 클러스터 속성 초기화)
void esp_app_iringer_data_init(void);

// report_octet 포인터 (zigbee_iringer_ep_create용)
zboctet_t *report_get_octet_ptr(void);

// TFT 표시 데이터 갱신 (main의 iringer_data_update_task에서 호출)
void iringer_update_tft_display_data(void);

#ifdef __cplusplus
}
#endif

#endif // IRINGER_APP_REPORT_H
