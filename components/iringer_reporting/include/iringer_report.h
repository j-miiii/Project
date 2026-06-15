/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 리포트 페이로드 빌드 모듈 (Zigbee 전송용 바이너리 생성)
 */
#ifndef IRINGER_REPORT_H
#define IRINGER_REPORT_H

#include "iringer_ir_end_device_2.1.h"

#ifdef __cplusplus
extern "C" {
#endif

// 디바이스 데이터로부터 페이로드·OCTET 버퍼 생성 (time 필드는 별도 report_set_timestamp로 설정)
void report_build_from_device_data(const iringer_device_data_t *data,
                                   ir_payload_t *payload,
                                   zboctet_t *octet);

// 페이로드·OCTET에 타임스탬프 설정 (전송 직전 호출)
void report_set_timestamp(ir_payload_t *payload, zboctet_t *octet, uint32_t timestamp_sec);

#ifdef __cplusplus
}
#endif

#endif // IRINGER_REPORT_H

