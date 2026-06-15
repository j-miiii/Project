/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * 앱 설정 NVS 저장소 모듈 (total_ml, init_done)
 * iringer_ir_end_device_2.1 메인에서 NVS 로직 분리
 */
#ifndef IRINGER_STORAGE_H
#define IRINGER_STORAGE_H

#include <stdbool.h>
#include <stdint.h>

#define IRINGER_STORAGE_NAMESPACE  "app_settings"
#define IRINGER_STORAGE_KEY_ML    "total_ml"
#define IRINGER_STORAGE_KEY_INIT  "init_done"
#define IRINGER_STORAGE_KEY_REBOOT_CNT   "reboot_cnt"
#define IRINGER_STORAGE_KEY_RESET_REASON "reset_rsn"
#define IRINGER_STORAGE_KEY_RECONNECT_CNT "reconn_cnt"

// 총 수액량(ml) 저장 (NVS)
void storage_set_total_ml(int value);

// 총 수액량(ml) 로드, 실패/미설정 시 -1
int storage_get_total_ml(void);

// 초기 데이터 수신 여부
bool storage_is_initial_data_received(void);

// 초기 데이터 수신 플래그 저장
void storage_set_initial_data_received(void);

// 오류 로깅 및 통계 (30일 장기운영 진단용)
uint32_t storage_get_reboot_count(void);
void storage_inc_reboot_count(void);
void storage_set_last_reset_reason(uint32_t reason);
uint32_t storage_get_last_reset_reason(void);
uint32_t storage_get_reconnect_count(void);
void storage_inc_reconnect_count(void);

#endif // IRINGER_STORAGE_H

