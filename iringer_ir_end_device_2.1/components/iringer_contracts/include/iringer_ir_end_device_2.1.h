/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * IRINGER IR Sensor End Device Header (v2.1)
 *
 * 역할(Contracts):
 * - End Device 2.1에서 공통으로 사용하는 Zigbee 설정/타입/페이로드/상수의 소유권을 고정한다.
 * - 다른 컴포넌트가 main 컴포넌트를 의존하지 않도록, 공용 선언은 이 헤더(contracts 컴포넌트)로 이동한다.
 */
#ifndef IRINGER_IR_END_DEVICE_2_1_H
#define IRINGER_IR_END_DEVICE_2_1_H

#include "esp_zigbee_core.h"
#include "zcl/esp_zigbee_zcl_common.h"

/* Basic manufacturer and model info */
#define MANUFACTURER_NAME               "\x11""SINSUNGTECH"
#define MODEL_IDENTIFIER                "\x14""IRINGER_IR_2.1"

#define WIFI_SAFE_CHANNELS              (1<<25)   // ((1<<15) | (1<<20) | (1<<25) | (1<<26))  // 채널 15, 20, 25, 26
#define ESP_ZB_PRIMARY_CHANNEL_MASK     ESP_ZB_TRANSCEIVER_ALL_CHANNELS_MASK

/* Zigbee configuration */
#define INSTALLCODE_POLICY_ENABLE       false       /* enable the install code policy for security */
#define IRINGER_ENDPOINT          10           /* iringer device endpoint */
#define IRINGER_COORDINATOR_ENDPOINT    1            /* coordinator endpoint */
// IRINGER cluster ID 정의 (0xFC00-0xFFFF 범위 사용)
#define ESP_ZB_ZCL_CLUSTER_ID_IRINGER_DATA           0xFC00
// IRINGER attribute IDs 정의
#define ESP_ZB_ZCL_ATTR_IRINGER_DATA_BUNDLE_ID       0x0001

/* Default End Device config */
// ============================================
// 리포트 전송 간격 설정 (테스트/프로덕션 공용)
// ============================================
// 테스트 엔지니어가 배터리 사용시간 테스트를 위해 리포트 전송 간격을 변경할 수 있습니다.
// 변경 예시:
//   - 1분 테스트: REPORT_INTERVAL_SEC = 60
//   - 5분 전송: REPORT_INTERVAL_SEC = 300
//   - 10분 테스트: REPORT_INTERVAL_SEC = 600
//   - 30분 테스트: REPORT_INTERVAL_SEC = 1800
//
// 주의:
// - 현재 값은 테스트 목적(짧은 주기)일 수 있으므로, 주석은 "값"과 일치하도록 유지한다.

// 리포트 전송 간격 (초 단위) - 이 값을 변경하면 됩니다
#define REPORT_INTERVAL_SEC           30

// 리포트 전송 간격 (밀리초 단위) - Zigbee keep_alive 및 Sleep 대기 시간용
#define REPORT_INTERVAL_MS            (REPORT_INTERVAL_SEC * 1000)

// 리포트 전송 간격 (마이크로초 단위) - RTC 타이머 Wake-up용
#define REPORT_INTERVAL_US             (REPORT_INTERVAL_MS * 1000ULL)

// 초기 부팅 후 LCD OFF 및 슬립 진입 시간은 iringer_tft.h에서 관리됨 (LCD_SLEEP_DELAY_SEC, LCD_SLEEP_DELAY_MS)
// 수액 종료 알람 소리 크기는 iringer_buzzer.h에서 관리됨 (FLUID_END_ALARM_VOLUME_PERCENT)
// GTT 안정화 알고리즘은 LP Core에서 구현 (LP core shared memory 참조)

#include <stdbool.h>
#include "iringer_lcd_sleep.h"

// ============================================
// Zigbee End Device 설정
// ============================================
// 엔지니어가 Zigbee End Device의 타임아웃 및 Keep-Alive 설정을 조절할 수 있습니다.

// ED Aging Timeout 설정
// Coordinator가 이 시간 동안 End Device로부터 메시지를 받지 못하면 Child를 Aging 처리합니다.
// ESP Zigbee API에서 제공하는 옵션 (enum esp_zb_aging_timeout_t):
//   - ESP_ZB_ED_AGING_TIMEOUT_10SEC:    10초
//   - ESP_ZB_ED_AGING_TIMEOUT_2MIN:     2분 (120초)
//   - ESP_ZB_ED_AGING_TIMEOUT_4MIN:     4분 (240초)
//   - ESP_ZB_ED_AGING_TIMEOUT_8MIN:     8분 (480초) - 기본값
//   - ESP_ZB_ED_AGING_TIMEOUT_16MIN:   16분 (960초)
//   - ESP_ZB_ED_AGING_TIMEOUT_32MIN:   32분 (1920초)
//   - ESP_ZB_ED_AGING_TIMEOUT_64MIN:   64분 (3840초, 약 1시간 4분)
//   - ESP_ZB_ED_AGING_TIMEOUT_128MIN:  128분 (7680초, 약 2시간 8분)
//   - ESP_ZB_ED_AGING_TIMEOUT_256MIN:  256분 (15360초, 약 4시간 16분)
//   - ESP_ZB_ED_AGING_TIMEOUT_512MIN:  512분 (30720초, 약 8시간 32분)
//   - ESP_ZB_ED_AGING_TIMEOUT_1024MIN: 1024분 (61440초, 약 17시간 4분)
//   - ESP_ZB_ED_AGING_TIMEOUT_2048MIN: 2048분 (122880초, 약 34시간 8분)
//   - ESP_ZB_ED_AGING_TIMEOUT_4096MIN: 4096분 (245760초, 약 68시간 16분)
//   - ESP_ZB_ED_AGING_TIMEOUT_8192MIN: 8192분 (491520초, 약 136시간 32분)
//   - ESP_ZB_ED_AGING_TIMEOUT_16384MIN: 16384분 (983040초, 약 273시간 4분)
// 주의: keep_alive는 ed_timeout보다 작아야 합니다.
#define ED_AGING_TIMEOUT              ESP_ZB_ED_AGING_TIMEOUT_64MIN

// ED Keep-Alive 설정
// Long Poll Interval 설정 (GitHub 이슈 #215 참조)
// Parent Poll 최대 간격 = 리포트 전송 주기
// 주의: ed_timeout보다 작아야 합니다.
#define ED_KEEP_ALIVE                  REPORT_INTERVAL_MS

#define ESP_ZB_ZED_CONFIG()                                         \
    {                                                               \
        .esp_zb_role = ESP_ZB_DEVICE_TYPE_ED,                       \
        .install_code_policy = INSTALLCODE_POLICY_ENABLE,           \
        .nwk_cfg.zed_cfg = {                                        \
            .ed_timeout = ED_AGING_TIMEOUT,                         \
            .keep_alive = ED_KEEP_ALIVE,  /* Parent Poll 최대 간격 = 리포트 전송 주기 */ \
        },                                                          \
    }

#define ESP_ZB_DEFAULT_RADIO_CONFIG()                           \
    {                                                           \
        .radio_mode = ZB_RADIO_MODE_NATIVE,                     \
    }

#define ESP_ZB_DEFAULT_HOST_CONFIG()                            \
    {                                                           \
        .host_connection_mode = ZB_HOST_CONNECTION_MODE_NONE,   \
    }

/* Default iringer device config */
#define ESP_ZB_DEFAULT_IRINGER_DEVICE_CONFIG()                       \
    {                                                               \
        .basic_cfg = {                                              \
            .zcl_version = ESP_ZB_ZCL_BASIC_ZCL_VERSION_DEFAULT_VALUE,      \
            .power_source = ESP_ZB_ZCL_BASIC_POWER_SOURCE_DEFAULT_VALUE,    \
        },                                                          \
        .identify_cfg = {                                           \
            .identify_time = ESP_ZB_ZCL_IDENTIFY_IDENTIFY_TIME_DEFAULT_VALUE, \
        },                                                          \
    }

// 데이터 값 정의
#define DEVICE_TYPE          1    // 디바이스 타입 (IR 센서)
#define DUMMY_BATTERY_LEVEL  0      // 배터리 레벨 (%) - 초기값 (미측정 상태)
#define DUMMY_FLUID_WEIGHT   0.0f    // 유체 무게 (gram) - IR 센서는 무게 측정 안함
#define REPORT_MAX_LENGTH 64  // 정상 동작 조합과 동일하게 설정

// 페이로드 길이 테스트용 설정
#define PAYLOAD_AUTO_TEST_ENABLED 0  // 1: 자동 테스트, 0: 수동 테스트
#define PAYLOAD_FIXED_LENGTH 36       // 고정 패킷 길이 (36바이트)

// Zigbee TX Power 설정 (저전력 최적화)
// End Device는 낮은 TX Power 사용 (배터리 절약)
#define ZIGBEE_TX_POWER_DBM_ED  5   // +5dBm (배터리 절약, 5~10m 커버)

/* 특정 PAN ID에만 조인 (1: 스캔 후 목표 PAN 있을 때만 가입, 0: 스캔 없이 스티어링) */
#define IRINGER_ED_JOIN_SPECIFIC_PAN_ENABLE  1

#if IRINGER_ED_JOIN_SPECIFIC_PAN_ENABLE
#define IRINGER_ED_TARGET_PAN_ID             0x84ed
#define IRINGER_ED_SCAN_RETRY_DELAY_MS       5000
#endif

// OCTET_STRING 형식: 길이 필드 없이 직접 바이너리 데이터
// Zigbee OCTET_STRING은 첫 바이트가 길이, 그 다음이 데이터
typedef struct zbstring_s {
    uint8_t len;
    char data[REPORT_MAX_LENGTH];
} ESP_ZB_PACKED_STRUCT
zbstring_t;

// OCTET_STRING용 버퍼 (길이 필드 포함)
typedef struct zboctet_s {
    uint8_t len;
    uint8_t data[REPORT_MAX_LENGTH];
} ESP_ZB_PACKED_STRUCT
zboctet_t;

// 바이너리 압축 페이로드 구조체 (21바이트)
typedef struct __attribute__((packed)) {
    uint8_t type;      // TYPE: 0~255 (1바이트)
    char sn[4];        // SN: base64 문자열 (4바이트, 예: "//5V")
    uint16_t weight;   // WT: 0.01 단위 정수 (2바이트)
    uint8_t bat;       // BAT: 0~255 (1바이트)
    uint16_t gtt;      // GTT: 0~65535 (2바이트, gtt 값 255 이상 지원)
    uint16_t cchr;     // CC/HR: 0~65535 (2바이트, cc/hr 값 255 이상 지원)
    uint8_t rest;      // REST: 0~255 (1바이트)
    uint32_t inj;      // INJ: 0.001 단위 정수 (4바이트)
    uint32_t time;     // TIME: Unix epoch 초 단위 (KST) (4바이트)
} ir_payload_t;  // 총 21바이트

// 다운링크 바이너리 압축 페이로드 구조체 (14바이트)
typedef struct __attribute__((packed)) {
    uint16_t r_volume_max;    // r_volume_max: ml 단위 (2바이트, 0~65535)
    uint16_t ordered_gtt;     // ordered_gtt: 0.01 단위 정수 (2바이트, 예: 30.00 -> 3000)
    uint16_t min_gtt;         // min_gtt: 0.01 단위 정수 (2바이트)
    uint16_t max_gtt;         // max_gtt: 0.01 단위 정수 (2바이트)
    uint16_t rest_minute;     // rest_minute: 분 단위 (2바이트, 0~65535)
    uint32_t server_time;     // server_time: Unix epoch (초 단위, KST) (4바이트)
} ir_downlink_payload_t;  // 총 14바이트

/* iringer device configuration structure */
typedef struct esp_zb_iringer_device_cfg_s{
    esp_zb_basic_cluster_cfg_t basic_cfg;               /* Basic cluster configuration */
    esp_zb_identify_cluster_cfg_t identify_cfg;         /* Identify cluster configuration */
} esp_zb_iringer_device_cfg_t;

/* iringer device data structure - IR 센서 데이터 확장 */
typedef struct iringer_device_data_s{
    esp_zb_ieee_addr_t ieee_addr;
    uint8_t  endpoint;
    uint16_t short_addr;
    char device_type;
    char serial_number[4];
    float fluid_weight;           // IR 센서는 사용 안함 (0.0)
    char battery_level;
    uint32_t timestamp;
    char manufacturer[32];
    char model[32];
    // IR 센서 추가 필드
    float gtt;                    // 방울/분 (gtt)
    float ml_per_hour;            // ml/시간
    uint16_t rest_min;            // 남은 시간 (분)
    float injected_amount;        // 주입량 (ml)
    float drop_per_sec;          // 방울/초
    uint32_t drop_cnt;           // 총 방울 수
    float r_volume_max;          // 총 수액량 (ml)
    float r_volume_now;          // 현재 잔량 (ml)
    // 서버 설정값 (게이트웨이를 통해 수신 예정)
    float ordered_gtt;           // 처방 속도 (gtt)
    float min_gtt;               // 최소 허용 속도 (gtt)
    float max_gtt;               // 최대 허용 속도 (gtt)
} iringer_device_data_t;

#endif // IRINGER_IR_END_DEVICE_2_1_H

