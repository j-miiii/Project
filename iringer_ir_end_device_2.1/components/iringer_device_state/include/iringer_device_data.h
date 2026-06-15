/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 디바이스 데이터 캡슐화 (단일 소스, 읽기/쓰기 API)
 */
#ifndef IRINGER_DEVICE_DATA_H
#define IRINGER_DEVICE_DATA_H

#include <stdbool.h>

#include "iringer_ir_end_device_2.1.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * device_data 접근 규칙:
 * - device_data_get() / device_data_get_mutable() 호출 전 반드시 device_data_lock() 획득
 * - device_data_lock() 실패 시 false 반환, 호출부에서 device_data 접근 금지
 * - 접근 완료 후 device_data_unlock() 호출 (짧은 구간만 유지, 데드락 방지)
 * - 데드락 방지: 다른 락(esp_zb_lock 등)과 함께 사용 시, device_data_lock을 항상 먼저 획득
 * - device_data_get_mutable() 반환 포인터로의 수정은 lock/unlock 사이에서만 수행
 */
void device_data_init(void);
bool device_data_lock(void);  /* 성공 true, 타임아웃 시 false (호출부 예외처리 필수) */
void device_data_unlock(void);

// 읽기 전용 접근 (리포트·TFT 등 다른 모듈용). lock/unlock 사이에서 호출
const iringer_device_data_t *device_data_get(void);

// 읽기/쓰기 접근 (메인 앱 전용, 디바이스 데이터 갱신). lock/unlock 사이에서만 호출·수정
iringer_device_data_t *device_data_get_mutable(void);

#ifdef __cplusplus
}
#endif

#endif // IRINGER_DEVICE_DATA_H

