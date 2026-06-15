/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * IRINGER App Sleep 모듈
 * ESP Light Sleep 진입 및 다운링크 수신 대기
 */
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "esp_log.h"
#include "esp_sleep.h"
#include "esp_timer.h"
#include "iringer_app_common.h"
#include "iringer_ir_end_device_2.1.h"
#include "iringer_battery.h"
#include "iringer_tft.h"
#include "lp_core/lp_core_shared_memory.h"

static const char *TAG = "IRINGER_SLEEP";

bool app_wait_for_downlink(uint32_t timeout_ms)
{
    if (sleep_wait_event_group == NULL) {
        ESP_LOGW(TAG, "이벤트 그룹이 초기화되지 않음 - 다운링크 수신 대기 불가");
        return false;
    }

    /* 레이스 컨디션 방지: 리포트 전송 후 app_wait_for_downlink 호출 전에 다운링크가 이미 도착했을 수 있음.
     * 비트가 이미 설정되어 있으면 즉시 성공 반환.
     * TOCTOU 방지: GetBits와 WaitBits 사이에 ClearBits를 호출하지 않음.
     * (Clear 시점에 zb_set_attr_value_handler가 비트를 설정한 경우 신호 손실 방지) */
    EventBits_t current = xEventGroupGetBits(sleep_wait_event_group);
    if (current & EVENT_BIT_DOWNLINK_RECEIVED) {
        xEventGroupClearBits(sleep_wait_event_group, EVENT_BIT_DOWNLINK_RECEIVED);
        ESP_LOGI(TAG, "다운링크 수신 완료 (대기 전 이미 수신됨)");
        return true;
    }

    EventBits_t bits = xEventGroupWaitBits(
        sleep_wait_event_group,
        EVENT_BIT_DOWNLINK_RECEIVED,
        pdTRUE,
        pdFALSE,
        pdMS_TO_TICKS(timeout_ms)
    );

    bool received = (bits & EVENT_BIT_DOWNLINK_RECEIVED) != 0;
    if (received) {
        ESP_LOGI(TAG, "다운링크 수신 완료");
    } else {
        ESP_LOGW(TAG, "다운링크 수신 타임아웃 (%lu ms)", timeout_ms);
    }

    return received;
}