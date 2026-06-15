/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * IRINGER App 헬퍼 함수
 * main 파일에서 분리된 순수 로직/유틸리티 함수
 */
#include <math.h>
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_timer.h"
#include "iringer_app_common.h"
#include "iringer_device_data.h"
#include "iringer_domain_alarm.h"
#include "iringer_domain_gtt.h"
#include "iringer_capacitor_sensor.h"
#include "iringer_alarm_config.h"
#include "lp_core/lp_core_algorithm_config.h"
#include "lp_core/lp_core.h"
#include "lp_core/lp_core_shared_memory.h"
#include "esp_zigbee_core.h"
#include "nwk/esp_zigbee_nwk.h"

static const char *TAG = "IRINGER_APP";

/* GTT 범위 비율 (check_need_to_update: prev_gtt 대비 변화 감지) */
#define GTT_RANGE_MIN_RATIO 0.5f
#define GTT_RANGE_MAX_RATIO 1.5f

static const char base64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

void create_serial_number(char serial_number[4])
{
    uint8_t mac[8];
    esp_read_mac(mac, ESP_MAC_IEEE802154);

    int num = ((int)mac[5] << 16) | ((int)mac[6] << 8) | (int)mac[7];

    serial_number[0] = base64[(num >> 18) & 0x3F];
    serial_number[1] = base64[(num >> 12) & 0x3F];
    serial_number[2] = base64[(num >> 6) & 0x3F];
    serial_number[3] = base64[num & 0x3F];
}

uint16_t iringer_ed_pick_parent_short_addr_under_zb_lock(uint8_t *out_selected_lqi)
{
    uint8_t parent_count = 0;
    uint16_t best_any_addr = 0xFFFF;
    uint8_t best_any_lqi = 0;
    uint16_t best_lqi_pos_addr = 0xFFFF;
    uint8_t best_lqi_pos = 0;

    esp_zb_nwk_info_iterator_t iterator = ESP_ZB_NWK_INFO_ITERATOR_INIT;
    esp_zb_nwk_neighbor_info_t neighbor;

    while (esp_zb_nwk_get_next_neighbor(&iterator, &neighbor) == ESP_OK) {
        if (neighbor.relationship != ESP_ZB_NWK_RELATIONSHIP_PARENT) {
            continue;
        }
        parent_count++;
        if (best_any_addr == 0xFFFF || neighbor.lqi > best_any_lqi) {
            best_any_addr = neighbor.short_addr;
            best_any_lqi = neighbor.lqi;
        }
        if (neighbor.lqi > 0 &&
            (best_lqi_pos_addr == 0xFFFF || neighbor.lqi > best_lqi_pos)) {
            best_lqi_pos_addr = neighbor.short_addr;
            best_lqi_pos = neighbor.lqi;
        }
    }

    uint16_t chosen;
    uint8_t lqi_out;
    if (parent_count == 0) {
        chosen = 0xFFFF;
        lqi_out = 0;
    } else if (parent_count >= 2 && best_lqi_pos_addr != 0xFFFF) {
        chosen = best_lqi_pos_addr;
        lqi_out = best_lqi_pos;
    } else {
        chosen = best_any_addr;
        lqi_out = best_any_lqi;
    }

    if (out_selected_lqi != NULL) {
        *out_selected_lqi = lqi_out;
    }
    return chosen;
}

uint16_t get_ed_parent_addr(void)
{
    uint16_t parent_addr = 0xFFFF;

    if (esp_zb_lock_acquire(pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGW(TAG, "get_ed_parent_addr: Zigbee lock timeout");
        return parent_addr;
    }

    parent_addr = iringer_ed_pick_parent_short_addr_under_zb_lock(NULL);

    esp_zb_lock_release();

    return parent_addr;
}

void iringer_update_gtt_settings(float ordered_gtt, float min_gtt, float max_gtt)
{
    if (!device_data_lock()) {
        ESP_LOGW(TAG, "iringer_update_gtt_settings: device_data_lock timeout, skip");
        return;
    }
    if (ordered_gtt > 0.0f) {
        device_data_get_mutable()->ordered_gtt = ordered_gtt;
    }
    if (min_gtt > 0.0f) {
        device_data_get_mutable()->min_gtt = min_gtt;
    }
    if (max_gtt > 0.0f) {
        device_data_get_mutable()->max_gtt = max_gtt;
    }
    ESP_LOGD(TAG, "GTT 설정값 업데이트: ordered=%.2f, min=%.2f, max=%.2f",
             device_data_get_mutable()->ordered_gtt,
             device_data_get_mutable()->min_gtt,
             device_data_get_mutable()->max_gtt);
    device_data_unlock();
}

bool check_gtt_change_threshold(float prev_gtt, float current_gtt, float threshold_percent)
{
    bool changed = iringer_is_gtt_changed_over_threshold(prev_gtt, current_gtt, threshold_percent);
    if (changed && prev_gtt > 0.0f && current_gtt > 0.0f) {
        float change_percent = fabsf(current_gtt - prev_gtt) / prev_gtt * 100.0f;
        ESP_LOGD(TAG, "GTT 변화율 감지: %.1f -> %.1f (%.1f%%, 임계값: %.1f%%)",
                 prev_gtt, current_gtt, change_percent, threshold_percent);
    }
    return changed;
}

bool check_gtt_out_of_range(float gtt)
{
    iringer_device_data_t *d = device_data_get_mutable();
    bool out = iringer_is_gtt_out_of_range(gtt, d->ordered_gtt, d->min_gtt, d->max_gtt);
    if (out) {
        if (d->min_gtt > 0.0f && d->max_gtt > 0.0f) {
            ESP_LOGW(TAG, "GTT 범위 이탈: %.2f (%.2f ~ %.2f)",
                     gtt, d->min_gtt, d->max_gtt);
        } else if (d->ordered_gtt > 0.0f) {
            float min_allowed = d->ordered_gtt * 0.5f;
            float max_allowed = d->ordered_gtt * 1.5f;
            ESP_LOGW(TAG, "GTT 기본 범위 이탈: %.2f (%.2f ~ %.2f)",
                     gtt, min_allowed, max_allowed);
        }
    }
    return out;
}

bool check_need_to_update(float drop_speed)
{
    float gtt = drop_speed * 60.0f;
    float prev_gtt = device_data_get_mutable()->drop_per_sec * 60.0f;

    if (gtt < prev_gtt * GTT_RANGE_MIN_RATIO || gtt > prev_gtt * GTT_RANGE_MAX_RATIO) {
        return true;
    }

    return check_gtt_out_of_range(gtt) != check_gtt_out_of_range(prev_gtt);
}

uint8_t calculate_injection_percent(float injected_amount, float r_volume_max)
{
    return iringer_calc_injection_percent(injected_amount, r_volume_max);
}

alarm_condition_t check_alarm_condition(void)
{
    uint64_t current_time_us = esp_timer_get_time();
    uint64_t elapsed_minutes = (current_time_us - device_boot_time_us) / (60 * 1000000);

    uint8_t injection_percent = calculate_injection_percent(
        device_data_get_mutable()->injected_amount,
        device_data_get_mutable()->r_volume_max
    );

    /* GTT 이동평균 비교 대신 LP Core의 drops_stopped 직접 사용
     * LP Core가 자기 시계로 "15초 이상 방울 없음"을 판단하므로 바운싱 없음 */
    lp_core_shared_data_t *shared_alarm_chk = lp_core_get_shared_memory();
    bool is_gtt_zero = (shared_alarm_chk != NULL) ? shared_alarm_chk->drops_stopped : false;
    bool is_capacitor_empty = capacitor_sensor_is_injection_complete();

    return iringer_eval_alarm_condition(
        elapsed_minutes,
        injection_percent,
        is_gtt_zero,
        is_capacitor_empty,
        (uint8_t)LP_ALGO_INJECTION_COMPLETE_THRESHOLD_PERCENT,
        (uint32_t)ALARM_WARMUP_TIME_MINUTES,
        (bool)ENABLE_ALARM_AT_INJECTION_COMPLETE
    );
}
