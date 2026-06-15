/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * Zigbee 클러스터/엔드포인트 생성 및 TX Power, Power Save 구현
 */
#include "iringer_zigbee.h"
#include "esp_log.h"
#include "esp_zigbee_core.h"
#include "zcl/esp_zigbee_zcl_common.h"
#ifdef CONFIG_PM_ENABLE
#include "esp_pm.h"
#endif

static const char *TAG = "IRINGER_ZB";

/* 다운링크 전용 속성 저장소 (코디네이터 Write 수신 시 스택이 여기에 기록)
 * 업링크(report_octet)와 분리하여 다운링크로 인한 report_octet 덮어쓰기 방지 */
static zboctet_t s_attr_bundle_octet;

static esp_zb_attribute_list_t *iringer_data_cluster_create(void)
{
    esp_zb_attribute_list_t *iringer_cluster =
        esp_zb_zcl_attr_list_create(ESP_ZB_ZCL_CLUSTER_ID_IRINGER_DATA);
    esp_zb_custom_cluster_add_custom_attr(iringer_cluster,
                                          ESP_ZB_ZCL_ATTR_IRINGER_DATA_BUNDLE_ID,
                                          ESP_ZB_ZCL_ATTR_TYPE_OCTET_STRING,
                                          ESP_ZB_ZCL_ATTR_ACCESS_READ_WRITE | ESP_ZB_ZCL_ATTR_ACCESS_REPORTING,
                                          &s_attr_bundle_octet);
    return iringer_cluster;
}

static esp_zb_cluster_list_t *iringer_device_clusters_create(esp_zb_iringer_device_cfg_t *device_cfg)
{
    esp_zb_cluster_list_t *cluster_list = esp_zb_zcl_cluster_list_create();

    esp_zb_attribute_list_t *basic_cluster = esp_zb_basic_cluster_create(&(device_cfg->basic_cfg));
    ESP_ERROR_CHECK(esp_zb_basic_cluster_add_attr(basic_cluster, ESP_ZB_ZCL_ATTR_BASIC_MANUFACTURER_NAME_ID, MANUFACTURER_NAME));
    ESP_ERROR_CHECK(esp_zb_basic_cluster_add_attr(basic_cluster, ESP_ZB_ZCL_ATTR_BASIC_MODEL_IDENTIFIER_ID, MODEL_IDENTIFIER));
    ESP_ERROR_CHECK(esp_zb_cluster_list_add_basic_cluster(cluster_list, basic_cluster, ESP_ZB_ZCL_CLUSTER_SERVER_ROLE));

    ESP_ERROR_CHECK(esp_zb_cluster_list_add_identify_cluster(cluster_list, esp_zb_identify_cluster_create(&(device_cfg->identify_cfg)), ESP_ZB_ZCL_CLUSTER_SERVER_ROLE));
    ESP_ERROR_CHECK(esp_zb_cluster_list_add_identify_cluster(cluster_list, esp_zb_zcl_attr_list_create(ESP_ZB_ZCL_CLUSTER_ID_IDENTIFY), ESP_ZB_ZCL_CLUSTER_CLIENT_ROLE));

    esp_zb_cluster_list_add_custom_cluster(cluster_list, iringer_data_cluster_create(), ESP_ZB_ZCL_CLUSTER_SERVER_ROLE);

    return cluster_list;
}

esp_zb_ep_list_t *zigbee_iringer_ep_create(uint8_t endpoint_id,
                                           esp_zb_iringer_device_cfg_t *device_cfg)
{
    esp_zb_ep_list_t *ep_list = esp_zb_ep_list_create();
    esp_zb_endpoint_config_t endpoint_config = {
        .endpoint = endpoint_id,
        .app_profile_id = ESP_ZB_AF_HA_PROFILE_ID,
        .app_device_id = ESP_ZB_HA_TEST_DEVICE_ID,
        .app_device_version = 0
    };
    esp_zb_ep_list_add_ep(ep_list, iringer_device_clusters_create(device_cfg), endpoint_config);
    return ep_list;
}

void zigbee_setup_tx_power(void)
{
    int8_t tx_power = (int8_t)ZIGBEE_TX_POWER_DBM_ED;
    esp_zb_set_tx_power(tx_power);
    ESP_LOGI(TAG, "Zigbee TX Power 설정 완료: %d dBm (배터리 절약)", tx_power);
}

esp_err_t zigbee_power_save_init(void)
{
    esp_err_t rc = ESP_OK;
#ifdef CONFIG_PM_ENABLE
    int cur_cpu_freq_mhz = CONFIG_ESP_DEFAULT_CPU_FREQ_MHZ;
    esp_pm_config_t pm_config = {
        .max_freq_mhz = cur_cpu_freq_mhz,
        .min_freq_mhz = cur_cpu_freq_mhz,
#ifdef CONFIG_FREERTOS_USE_TICKLESS_IDLE
#if LCD_SLEEP_WAKE_STRESS_TEST
        .light_sleep_enable = false  // 스트레스 테스트: 슬립 비활성화 (LCD ON/OFF만 테스트)
#else
        .light_sleep_enable = true
#endif
#endif
    };
    rc = esp_pm_configure(&pm_config);
    if (rc == ESP_OK) {
        ESP_LOGI(TAG, "ESP Power Management 초기화 완료 (Light Sleep 활성화)");
    } else {
        ESP_LOGW(TAG, "ESP Power Management 초기화 실패: %s", esp_err_to_name(rc));
    }
#else
    (void)rc;
    ESP_LOGW(TAG, "CONFIG_PM_ENABLE 비활성화 - Light Sleep 사용 불가");
#endif
    return rc;
}

