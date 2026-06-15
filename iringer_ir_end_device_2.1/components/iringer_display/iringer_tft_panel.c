/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * TFT Display - Panel/Driver 영역 (ST7735)
 * - SPI 전송, ST7735 초기화 시퀀스, 저수준 도형/픽셀 처리
 * - UI 로직/백라이트/슬립 정책은 다른 모듈로 분리
 */
#include "iringer_tft.h"
#include "iringer_tft_internal.h"

#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "esp_log.h"
#include "esp_heap_caps.h"      /* heap_caps_get_minimum_free_size */
#include "esp_rom_gpio.h"
#include "esp_rom_sys.h"        /* [비트뱅] esp_rom_delay_us */
#include "soc/spi_periph.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include "iringer_lcd_sleep.h"  /* LCD_SLEEP_WAKE_STRESS_TEST */
#include "iringer_diag.h"       /* TFT_USE_WARM_REINIT */
#include "iringer_alive_marker.h"

static const char *TAG = "TFT";

/* [안전망1] SPI 에러 카운터 — tft_init() 시작 시 0으로 리셋,
 * tft_spi_transmit_with_timeout 실패 시 ++.
 * tft_display_on_impl()에서 print_data 후 0이 아니면 자동 재시도. */
static uint32_t s_tft_spi_error_count = 0;

// 패널 파라미터
#define TFT_WIDTH_PIX 128
#define TFT_HEIGHT_PIX 160
#define TFT_X_OFFSET 2          // 배경용 오프셋
#define TFT_X_OFFSET_ELEMENTS 9 // 모든 요소용 오프셋 (배경 + 8픽셀)
#define TFT_Y_OFFSET 0

// SPI 핸들
static spi_device_handle_t spi_handle = NULL;

// SPI 동시 접근 보호를 위한 뮤텍스
static SemaphoreHandle_t spi_mutex = NULL;

// 픽셀 전송용 정적 버퍼 (DMA 미사용: SPI FIFO 64바이트 = 32픽셀이 한계)
#define MAX_PIXEL_BUF_SIZE 32 // 32 픽셀 = 64 바이트 (SPI FIFO 크기)
static uint8_t pixel_buf_static[MAX_PIXEL_BUF_SIZE * 2];

// 회전 (0~3)
static uint8_t rotation = 2; // 기본 회전 (180도)

/* SPI 전송 타임아웃: 장기운영 시 배선/접촉 불량으로 무한 블로킹 방지 (Driver hang 방어) */
#define TFT_SPI_TRANSACTION_TIMEOUT_MS 500

/** spi_device_transmit 대신 queue+get_result로 타임아웃 적용. 실패 시 ESP_ERR_TIMEOUT 반환.
 * [안전망1] 실패 시 s_tft_spi_error_count++ + WARN 로그. */
static esp_err_t tft_spi_transmit_with_timeout(spi_transaction_t *t)
{
    esp_err_t ret = spi_device_queue_trans(spi_handle, t, pdMS_TO_TICKS(100));
    if (ret != ESP_OK) {
        s_tft_spi_error_count++;
        ESP_LOGW(TAG, "[안전망1] SPI queue 실패: %s (누적 %lu)",
                 esp_err_to_name(ret), (unsigned long)s_tft_spi_error_count);
        return ret;
    }
    spi_transaction_t *r = NULL;
    ret = spi_device_get_trans_result(spi_handle, &r, pdMS_TO_TICKS(TFT_SPI_TRANSACTION_TIMEOUT_MS));
    if (ret != ESP_OK) {
        s_tft_spi_error_count++;
        ESP_LOGW(TAG, "[안전망1] SPI get_result 실패: %s (누적 %lu)",
                 esp_err_to_name(ret), (unsigned long)s_tft_spi_error_count);
    }
    return ret;
}

// ST7735 추가 명령어(헤더에 없는 것만)
#define ST7735_NOP 0x00
#define ST7735_SWRESET 0x01
#define ST7735_RDDID 0x04
#define ST7735_RDDST 0x09
#define ST7735_PTLON 0x12
#define ST7735_INVOFF 0x20
#define ST7735_INVON 0x21

static void tft_dc_set(bool is_data)
{
    gpio_set_level(TFT_DC_PIN, is_data ? 1 : 0);
}

static void tft_cs_set(bool select)
{
    gpio_set_level(TFT_CS_PIN, select ? 0 : 1); // CS는 active low
}

/* TFT 접근 실패 로그 (Defensive #11) - 1초 throttle */
#define TFT_ACCESS_FAIL_LOG_THROTTLE_MS 1000
static uint32_t s_tft_access_fail_count = 0;
static int64_t s_last_tft_access_fail_log_us = 0;

static inline bool tft_panel_can_access(void)
{
    if (tft_is_sleeping) {
        goto access_fail;
    }
    if (spi_handle == NULL || spi_mutex == NULL) {
        goto access_fail;
    }
    return true;
access_fail:
    s_tft_access_fail_count++;
    int64_t now_us = esp_timer_get_time();
    if (now_us - s_last_tft_access_fail_log_us > TFT_ACCESS_FAIL_LOG_THROTTLE_MS * 1000) {
        ESP_LOGW(TAG, "TFT 접근 불가 (sleep=%d spi_null=%d mutex_null=%d) fail_count=%lu",
                 tft_is_sleeping ? 1 : 0,
                 spi_handle == NULL ? 1 : 0,
                 spi_mutex == NULL ? 1 : 0,
                 (unsigned long)s_tft_access_fail_count);
        s_last_tft_access_fail_log_us = now_us;
    }
    return false;
}

static void tft_write_cmd_nolock(uint8_t cmd)
{
    if (spi_handle == NULL) {
        ESP_LOGE(TAG, "SPI handle is NULL!");
        return;
    }

    tft_dc_set(false); // 명령 모드
    tft_cs_set(true);

    spi_transaction_t t = {
        .length = 8,
        .tx_buffer = &cmd,
    };
    esp_err_t ret = tft_spi_transmit_with_timeout(&t);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI cmd 전송 실패 (cmd=0x%02x): %s", cmd, esp_err_to_name(ret));
    }

    tft_cs_set(false);
}

static void tft_write_data_nolock(uint8_t data)
{
    if (spi_handle == NULL) {
        ESP_LOGE(TAG, "SPI handle is NULL!");
        return;
    }

    tft_dc_set(true); // 데이터 모드
    tft_cs_set(true);

    spi_transaction_t t = {
        .length = 8,
        .tx_buffer = &data,
    };
    esp_err_t ret = tft_spi_transmit_with_timeout(&t);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI data 전송 실패: %s", esp_err_to_name(ret));
    }

    tft_cs_set(false);
}

static void tft_write_data16_nolock(uint16_t data)
{
    if (spi_handle == NULL) {
        ESP_LOGE(TAG, "SPI handle is NULL!");
        return;
    }

    tft_dc_set(true);
    tft_cs_set(true);

    uint8_t buf[2] = {(data >> 8) & 0xFF, data & 0xFF};
    spi_transaction_t t = {
        .length = 16,
        .tx_buffer = buf,
    };
    esp_err_t ret = tft_spi_transmit_with_timeout(&t);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI data16 전송 실패: %s", esp_err_to_name(ret));
    }

    tft_cs_set(false);
}

void tft_write_cmd(uint8_t cmd)
{
    if (!tft_panel_can_access()) {
        return;
    }
    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to take SPI mutex!");
        return;
    }
    tft_write_cmd_nolock(cmd);
    xSemaphoreGive(spi_mutex);
}

/** fillScreen+print_data 완료 후 호출. 그려진 상태에서 디스플레이 ON (깜빡임 방지) */
void tft_display_output_on(void)
{
    tft_write_cmd(ST7735_DSPON);
    vTaskDelay(pdMS_TO_TICKS(100));
}

void tft_write_data(uint8_t data)
{
    if (!tft_panel_can_access()) {
        return;
    }
    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to take SPI mutex!");
        return;
    }
    tft_write_data_nolock(data);
    xSemaphoreGive(spi_mutex);
}

void tft_write_data16(uint16_t data)
{
    if (!tft_panel_can_access()) {
        return;
    }
    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to take SPI mutex!");
        return;
    }
    tft_write_data16_nolock(data);
    xSemaphoreGive(spi_mutex);
}

static void tft_write_cmd_data(uint8_t cmd, uint8_t *data, size_t len)
{
    tft_write_cmd_nolock(cmd);
    for (size_t i = 0; i < len; i++) {
        tft_write_data_nolock(data[i]);
    }
}

/* 초기화 시퀀스 nolock 버전 — 호출자가 spi_mutex 보유 + tft_is_sleeping 처리 책임.
 * tft_init_warm()과 tft_init_sequence()가 공유. */
static void tft_init_sequence_nolock(void)
{
    // 소프트웨어 리셋
    tft_write_cmd_nolock(ST7735_SWRESET);
    vTaskDelay(pdMS_TO_TICKS(150));

    tft_write_cmd_nolock(ST7735_SLPOUT);
    vTaskDelay(pdMS_TO_TICKS(120));

    // 프레임 레이트 설정
    uint8_t seq1[] = {0x01, 0x2C, 0x2D};
    tft_write_cmd_data(ST7735_FRMCTR1, seq1, 3);

    uint8_t seq2[] = {0x01, 0x2C, 0x2D};
    tft_write_cmd_data(ST7735_FRMCTR2, seq2, 3);

    uint8_t seq3[] = {0x01, 0x2C, 0x2D, 0x01, 0x2C, 0x2D};
    tft_write_cmd_data(ST7735_FRMCTR3, seq3, 6);

    // 디스플레이 인버전 제어
    tft_write_cmd_nolock(ST7735_INVCTR);
    tft_write_data_nolock(0x07);

    // 전원 설정
    uint8_t seq4[] = {0xA2, 0x02, 0x84};
    tft_write_cmd_data(ST7735_PWCTR1, seq4, 3);

    uint8_t seq5[] = {0xC5, 0x8A, 0xEE};
    tft_write_cmd_data(ST7735_PWCTR2, seq5, 3);

    uint8_t seq6[] = {0x0A, 0x00};
    tft_write_cmd_data(ST7735_PWCTR3, seq6, 2);

    uint8_t seq7[] = {0x8A, 0x2A};
    tft_write_cmd_data(ST7735_PWCTR4, seq7, 2);

    uint8_t seq8[] = {0x8A, 0xEE};
    tft_write_cmd_data(ST7735_PWCTR5, seq8, 2);

    tft_write_cmd_nolock(ST7735_VMCTR1);
    tft_write_data_nolock(0x0E);

    // 메모리 접근 제어
    tft_write_cmd_nolock(ST7735_MADCTL);
    tft_write_data_nolock(0xC8); // 회전 설정

    // 컬러 모드 (16비트)
    tft_write_cmd_nolock(ST7735_COLMOD);
    tft_write_data_nolock(0x05);

    // 감마 설정
    uint8_t gamma_pos[] = {0x02, 0x1c, 0x07, 0x12, 0x37, 0x32, 0x29, 0x2d,
                           0x29, 0x25, 0x2B, 0x39, 0x00, 0x01, 0x03, 0x10};
    tft_write_cmd_data(ST7735_GMCTRP1, gamma_pos, 16);

    uint8_t gamma_neg[] = {0x03, 0x1d, 0x07, 0x06, 0x2E, 0x2C, 0x29, 0x2D,
                           0x2E, 0x2E, 0x37, 0x3F, 0x00, 0x00, 0x02, 0x10};
    tft_write_cmd_data(ST7735_GMCTRN1, gamma_neg, 16);

    // 노멀 디스플레이 모드
    tft_write_cmd_nolock(ST7735_NORON);
    vTaskDelay(pdMS_TO_TICKS(10));

    // DSPON은 fillScreen+print_data 완료 후 별도 호출 (그려진 상태에서 예쁘게 ON)

    // 오프셋 설정 (화면 오른쪽 깨짐 방지)
    tft_write_cmd_nolock(ST7735_CASET);
    tft_write_data16_nolock(TFT_X_OFFSET);
    tft_write_data16_nolock(TFT_X_OFFSET + TFT_WIDTH_PIX - 1);

    tft_write_cmd_nolock(ST7735_RASET);
    tft_write_data16_nolock(TFT_Y_OFFSET);
    tft_write_data16_nolock(TFT_Y_OFFSET + TFT_HEIGHT_PIX - 1);
}

/* 초기화 시퀀스 (INITR_144GREENTAB) — 기존 cold path가 호출하는 wrapper.
 * 동작은 기존과 100% 동일: access check + mutex grab + body + mutex release. */
static void tft_init_sequence(void)
{
    if (!tft_panel_can_access()) {
        ESP_LOGE(TAG, "패널 초기화 실패: SPI 미초기화 또는 sleep 상태");
        return;
    }
    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to take SPI mutex!");
        return;
    }

    tft_init_sequence_nolock();

    xSemaphoreGive(spi_mutex);
}

void tft_fill_rect_fast(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color)
{
    if (!tft_panel_can_access()) {
        return;
    }

    // 화면 범위 체크
    if (x < 0) {
        w += x;
        x = 0;
    }
    if (y < 0) {
        h += y;
        y = 0;
    }
    if (x + w > TFT_WIDTH_PIX) w = TFT_WIDTH_PIX - x;
    if (y + h > TFT_HEIGHT_PIX) h = TFT_HEIGHT_PIX - y;
    if (w <= 0 || h <= 0) return;

    int16_t x1 = x + TFT_X_OFFSET_ELEMENTS;
    int16_t y1 = y + TFT_Y_OFFSET;
    int16_t x2 = x1 + w - 1;
    int16_t y2 = y1 + h - 1;

    // 뮤텍스로 SPI 접근 보호
    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to take SPI mutex!");
        return;
    }

    // 화면 영역 설정
    tft_write_cmd_nolock(ST7735_CASET);
    tft_write_data16_nolock(x1);
    tft_write_data16_nolock(x2);

    tft_write_cmd_nolock(ST7735_RASET);
    tft_write_data16_nolock(y1);
    tft_write_data16_nolock(y2);

    // RAM 쓰기 시작
    tft_write_cmd_nolock(ST7735_RAMWR);

    // 연속 데이터 전송 모드 (CS 유지)
    tft_dc_set(true);
    tft_cs_set(true);

    uint16_t pixel_count = w * h;
    uint8_t color_high = (color >> 8) & 0xFF;
    uint8_t color_low = color & 0xFF;

    uint16_t pixels_to_fill =
        (pixel_count > MAX_PIXEL_BUF_SIZE) ? MAX_PIXEL_BUF_SIZE : pixel_count;
    for (uint16_t i = 0; i < pixels_to_fill; i++) {
        pixel_buf_static[i * 2] = color_high;
        pixel_buf_static[i * 2 + 1] = color_low;
    }

    uint16_t remaining = pixel_count;
    while (remaining > 0) {
        uint16_t to_send =
            (remaining > MAX_PIXEL_BUF_SIZE) ? MAX_PIXEL_BUF_SIZE : remaining;

        spi_transaction_t t = {
            .length = to_send * 16,
            .tx_buffer = pixel_buf_static,
        };
        esp_err_t ret = tft_spi_transmit_with_timeout(&t);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "SPI transmit failed: %s (timeout=%dms)", esp_err_to_name(ret), TFT_SPI_TRANSACTION_TIMEOUT_MS);
            break;
        }

        remaining -= to_send;
    }

    tft_cs_set(false);
    xSemaphoreGive(spi_mutex);
}

void tft_draw_fast_hline(int16_t x, int16_t y, int16_t w, uint16_t color)
{
    tft_fill_rect_fast(x, y, w, 1, color);
}

void tft_draw_fast_vline(int16_t x, int16_t y, int16_t h, uint16_t color)
{
    tft_fill_rect_fast(x, y, 1, h, color);
}

void tft_draw_rect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color)
{
    tft_draw_fast_hline(x, y, w, color);
    tft_draw_fast_hline(x, y + h - 1, w, color);
    tft_draw_fast_vline(x, y, h, color);
    tft_draw_fast_vline(x + w - 1, y, h, color);
}

void tft_fill_round_rect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t radius, uint16_t color)
{
    if (radius <= 1) {
        tft_fill_rect_fast(x, y, w, h, color);
        return;
    }

    tft_fill_rect_fast(x + radius, y, w - 2 * radius, h, color);
    tft_fill_rect_fast(x, y + radius, w, h - 2 * radius, color);

    if (radius <= 3) {
        for (int16_t i = 0; i < radius; i++) {
            for (int16_t j = 0; j < radius; j++) {
                int16_t dx = i - radius;
                int16_t dy = j - radius;
                if (dx * dx + dy * dy <= radius * radius) {
                    tft_draw_pixel(x + radius - i, y + radius - j, color);
                    tft_draw_pixel(x + w - radius + i - 1, y + radius - j, color);
                    tft_draw_pixel(x + radius - i, y + h - radius + j - 1, color);
                    tft_draw_pixel(x + w - radius + i - 1, y + h - radius + j - 1, color);
                }
            }
        }
    }
}

/* fillScreen nolock 버전 — 호출자가 spi_mutex 보유 책임. */
static void tft_fillScreen_nolock(uint16_t color)
{
    tft_write_cmd_nolock(ST7735_CASET);
    tft_write_data16_nolock(TFT_X_OFFSET);
    tft_write_data16_nolock(TFT_X_OFFSET + TFT_WIDTH_PIX - 1);

    tft_write_cmd_nolock(ST7735_RASET);
    tft_write_data16_nolock(TFT_Y_OFFSET);
    tft_write_data16_nolock(TFT_Y_OFFSET + TFT_HEIGHT_PIX - 1);

    tft_write_cmd_nolock(ST7735_RAMWR);

    tft_dc_set(true);
    tft_cs_set(true);

    uint16_t pixel_count = 128 * 160;
    uint8_t color_high = (color >> 8) & 0xFF;
    uint8_t color_low = color & 0xFF;

    uint16_t pixels_to_fill =
        (pixel_count > MAX_PIXEL_BUF_SIZE) ? MAX_PIXEL_BUF_SIZE : pixel_count;
    for (uint16_t i = 0; i < pixels_to_fill; i++) {
        pixel_buf_static[i * 2] = color_high;
        pixel_buf_static[i * 2 + 1] = color_low;
    }

    uint16_t remaining = pixel_count;
    while (remaining > 0) {
        uint16_t to_send =
            (remaining > MAX_PIXEL_BUF_SIZE) ? MAX_PIXEL_BUF_SIZE : remaining;

        spi_transaction_t t = {
            .length = to_send * 16,
            .tx_buffer = pixel_buf_static,
        };
        esp_err_t ret = tft_spi_transmit_with_timeout(&t);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "SPI transmit failed: %s (timeout=%dms)", esp_err_to_name(ret), TFT_SPI_TRANSACTION_TIMEOUT_MS);
            break;
        }

        remaining -= to_send;
    }

    tft_cs_set(false);
}

void tft_fillScreen(uint16_t color)
{
    if (!tft_panel_can_access()) {
        return;
    }

    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to take SPI mutex!");
        return;
    }

    tft_fillScreen_nolock(color);

    xSemaphoreGive(spi_mutex);
}

void tft_setRotation(uint8_t rot)
{
    if (!tft_panel_can_access()) {
        rotation = rot & 3;
        return;
    }

    rotation = rot & 3;
    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to take SPI mutex!");
        return;
    }

    tft_write_cmd_nolock(ST7735_MADCTL);

    switch (rotation) {
    case 0:
        tft_write_data_nolock(0xC8);
        break;
    case 1:
        tft_write_data_nolock(0xD8);
        break;
    case 2:
        tft_write_data_nolock(0x08);
        break;
    case 3:
        tft_write_data_nolock(0x68);
        break;
    }

    xSemaphoreGive(spi_mutex);
}

void tft_draw_pixel(int16_t x, int16_t y, uint16_t color)
{
    if (!tft_panel_can_access()) {
        return;
    }

    int16_t draw_x = x + TFT_X_OFFSET_ELEMENTS;
    int16_t draw_y = y + TFT_Y_OFFSET;
    if (draw_x < 0 || draw_x >= TFT_WIDTH_PIX || draw_y < 0 || draw_y >= TFT_HEIGHT_PIX) {
        return;
    }

    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "Failed to take SPI mutex!");
        return;
    }

    tft_write_cmd_nolock(ST7735_CASET);
    tft_write_data16_nolock(draw_x);
    tft_write_data16_nolock(draw_x);

    tft_write_cmd_nolock(ST7735_RASET);
    tft_write_data16_nolock(draw_y);
    tft_write_data16_nolock(draw_y);

    tft_write_cmd_nolock(ST7735_RAMWR);
    tft_write_data16_nolock(color);

    xSemaphoreGive(spi_mutex);
}

bool tft_is_spi_ready(void)
{
    return (spi_handle != NULL);
}

/* [안전망1] SPI 에러 카운터 getter — power 모듈에서 검증 시 사용 */
uint32_t tft_get_spi_error_count(void)
{
    return s_tft_spi_error_count;
}

/* [안전망1] SPI 에러 카운터 명시 리셋 — 재시도 직전 등 */
void tft_reset_spi_error_count(void)
{
    s_tft_spi_error_count = 0;
}

esp_err_t tft_init(bool first_boot)
{
    static uint32_t s_tft_init_cycle = 0;
    s_tft_init_cycle++;
    ESP_LOGW(TAG, "[TFTINIT HB] #%lu 진입 (first_boot=%d, heap=%lu, min_heap=%lu)",
             (unsigned long)s_tft_init_cycle,
             first_boot ? 1 : 0,
             (unsigned long)esp_get_free_heap_size(),
             (unsigned long)heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL));

    if (!first_boot) {
        alive_marker_set_location(MARKER_LOC_TFTINIT_COLD_ENTER);
        alive_marker_inc_cold_count();
    }

    ESP_LOGI(TAG, "TFT 초기화 시작 (first_boot=%d)", first_boot ? 1 : 0);

    /* [안전망1] 이번 init 사이클 동안의 SPI 에러만 추적하기 위해 카운터 리셋.
     * 이전 사이클에 에러가 있었다면 WARN으로 한 번 출력. */
    {
        uint32_t prev_err = s_tft_spi_error_count;
        s_tft_spi_error_count = 0;
        if (prev_err > 0) {
            ESP_LOGW(TAG, "[안전망1] 이전 init 사이클의 SPI 에러 = %lu (리셋)",
                     (unsigned long)prev_err);
        }
    }

    /* ── 재초기화: 기존 SPI 정리 (mutex는 유지 — 레이스 방지) ── */
    if (!first_boot) {
        if (spi_handle != NULL) {
            spi_bus_remove_device(spi_handle);
            spi_handle = NULL;
        }
        spi_bus_free(SPI2_HOST);
    }

    // GPIO 설정
    gpio_config_t io_conf = {
        .intr_type = GPIO_INTR_DISABLE,
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = (1ULL << TFT_CS_PIN) | (1ULL << TFT_DC_PIN) | (1ULL << TFT_RST_PIN),
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
    };
    gpio_config(&io_conf);

    gpio_set_level(TFT_CS_PIN, 1);
    gpio_set_level(TFT_DC_PIN, 0);

    if (first_boot) {
        esp_err_t ret = tft_backlight_init();
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "%s", "백라이트 GPIO 초기화 실패");
        } else {
            tft_set_backlight_duty(TFT_BACKLIGHT_DUTY_OFF);
        }
    }

    // 리셋
    gpio_set_level(TFT_RST_PIN, 0);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(TFT_RST_PIN, 1);
    vTaskDelay(pdMS_TO_TICKS(10));

    // SPI 버스 설정 (ESP_ERROR_CHECK 제거 — 재초기화 시 abort 방지)
    spi_bus_config_t bus_cfg = {
        .mosi_io_num = TFT_MOSI_PIN,
        .miso_io_num = -1,
        .sclk_io_num = TFT_SCLK_PIN,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 64,
    };
    esp_err_t ret = spi_bus_initialize(SPI2_HOST, &bus_cfg, SPI_DMA_DISABLED);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI 버스 초기화 실패: %s", esp_err_to_name(ret));
        return ret;
    }

    spi_device_interface_config_t dev_cfg = {
        .clock_speed_hz = 26 * 1000 * 1000,
        .mode = 0,
        .spics_io_num = -1,
        .queue_size = 7,
        .flags = 0,
        .pre_cb = NULL,
    };
    ret = spi_bus_add_device(SPI2_HOST, &dev_cfg, &spi_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI 디바이스 추가 실패: %s", esp_err_to_name(ret));
        spi_bus_free(SPI2_HOST);
        return ret;
    }

    // mutex: 없을 때만 생성 (재초기화 시 기존 mutex 유지 — 레이스 방지)
    if (spi_mutex == NULL) {
        spi_mutex = xSemaphoreCreateMutex();
        if (spi_mutex == NULL) {
            ESP_LOGE(TAG, "SPI mutex creation failed!");
            return ESP_ERR_NO_MEM;
        }
    }

    /* SPI 준비 완료 — 외부 접근 허용 */
    if (!first_boot) {
        tft_is_sleeping = false;
    }

    // ST7735 초기화
    tft_init_sequence();

    // 기본 설정
    tft_setRotation(2);
    vTaskDelay(pdMS_TO_TICKS(50));

    // 오프셋 재설정
    tft_write_cmd(ST7735_CASET);
    tft_write_data16(TFT_X_OFFSET);
    tft_write_data16(TFT_X_OFFSET + TFT_WIDTH_PIX - 1);
    tft_write_cmd(ST7735_RASET);
    tft_write_data16(TFT_Y_OFFSET);
    tft_write_data16(TFT_Y_OFFSET + TFT_HEIGHT_PIX - 1);

    tft_fillScreen(ST7735_BLACK);
    tft_setTextWrap(false);
    tft_setTextSize(1);
    tft_setTextColor(ST7735_BLUE);

    tft_update_activity_time();

    if (first_boot) {
        tft_ui_task_start();
        tft_display_output_on();
        vTaskDelay(pdMS_TO_TICKS(150));
        tft_set_backlight_duty(TFT_BACKLIGHT_DUTY_DEFAULT);
    }

    ESP_LOGI(TAG, "TFT 초기화 완료");
    ESP_LOGW(TAG, "[TFTINIT HB] #%lu 완료 (heap=%lu)",
             (unsigned long)s_tft_init_cycle,
             (unsigned long)esp_get_free_heap_size());

    if (!first_boot) {
        alive_marker_set_location(MARKER_LOC_TFTINIT_COLD_EXIT);
    }
    return ESP_OK;
}

/* ====================================================================
 * tft_init_warm — wake-time soft re-init (SPI 버스 free/init 안 함)
 *
 * Cold tft_init(false)와의 차이:
 *   - spi_bus_free / spi_bus_initialize 호출 안 함 (PMU sleep retention link 보존)
 *   - spi_handle / spi_mutex는 boot 시 생성된 그대로 재사용
 *   - tft_is_sleeping을 mutex 잡힌 상태에서 false로 풀어 race window 제거
 *   - RST 핀 펄스 + ST7735 SWRESET 둘 다 수행 (라운드 1; 라운드 2에서 최적화 검토)
 *
 * 호출 전제:
 *   - spi_handle != NULL  (boot 시 생성됨)
 *   - spi_mutex != NULL   (boot 시 생성됨)
 *   - 호출자가 GPIO hold 해제 + direction 재설정 완료 (tft_display_on_impl이 함)
 *
 * 사전 조건 위반 시: ESP_LOGE + ESP_ERR_INVALID_STATE 리턴
 *   → 호출자가 cold tft_init(false)로 fallback (사망 risk 감수, 마지막 보루)
 *
 * 라운드 1 그룹 B 양산 후보 path.
 * ==================================================================== */
esp_err_t tft_init_warm(void)
{
    static uint32_t s_tft_warm_cycle = 0;
    s_tft_warm_cycle++;

    int64_t start_us = esp_timer_get_time();

    ESP_LOGW(TAG, "[TFTINIT WARM] #%lu 진입 (heap=%lu, min_heap=%lu)",
             (unsigned long)s_tft_warm_cycle,
             (unsigned long)esp_get_free_heap_size(),
             (unsigned long)heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL));

    /* ── 사전 조건 검증 ── */
    if (spi_handle == NULL || spi_mutex == NULL) {
        ESP_LOGE(TAG, "[TFTINIT WARM] 사전 조건 실패: spi_handle=%p spi_mutex=%p — cold fallback 필요",
                 (void *)spi_handle, (void *)spi_mutex);
        return ESP_ERR_INVALID_STATE;
    }

    alive_marker_set_location(MARKER_LOC_TFTINIT_WARM_ENTER);
    alive_marker_inc_warm_count();

    /* ── 이전 사이클 SPI 에러 카운터 출력 + 리셋 ── */
    {
        uint32_t prev_err = s_tft_spi_error_count;
        s_tft_spi_error_count = 0;
        if (prev_err > 0) {
            ESP_LOGW(TAG, "[안전망1] 이전 warm 사이클의 SPI 에러 = %lu (리셋)",
                     (unsigned long)prev_err);
        }
    }

    /* ── mutex 잡기 (이 안에서 SPI/상태 작업 모두 직렬화) ── */
    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGE(TAG, "[TFTINIT WARM] mutex 획득 타임아웃");
        return ESP_ERR_TIMEOUT;
    }

    /* ── tft_is_sleeping=false 해제 ──
     * mutex가 우리 손에 있으므로 다른 태스크가 access check 통과해도
     * 즉시 mutex blocking에 걸려 아무것도 못 함. race 안전. */
    tft_is_sleeping = false;

    /* ── GPIO Matrix 라우팅 복구 ──
     * sleep 중 tft_display_off_impl()이 MOSI/SCLK을 GPIO_MODE_OUTPUT으로 전환하면서
     * SPI peripheral → pin 라우팅이 끊어짐. ESP-IDF 공식 README 권고대로
     * esp_rom_gpio_connect_out_signal()로 다시 연결. 이거 안 하면 하얀 화면 발생. */
    esp_rom_gpio_connect_out_signal(TFT_MOSI_PIN, spi_periph_signal[SPI2_HOST].spid_out, false, false);
    esp_rom_gpio_connect_out_signal(TFT_SCLK_PIN, spi_periph_signal[SPI2_HOST].spiclk_out, false, false);

    /* ── RST 핀 hardware reset 펄스 ──
     * 슬립 중 노이즈로 ST7735 내부 상태가 깨졌을 가능성 대비. */
    gpio_set_level(TFT_RST_PIN, 0);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(TFT_RST_PIN, 1);
    vTaskDelay(pdMS_TO_TICKS(10));

    /* ── ST7735 init sequence (SWRESET 포함) ── */
    tft_init_sequence_nolock();

    /* ── 회전 + 오프셋 (cold tft_init과 동일) ── */
    rotation = 2;
    tft_write_cmd_nolock(ST7735_MADCTL);
    tft_write_data_nolock(0x08);  /* rotation 2 */

    tft_write_cmd_nolock(ST7735_CASET);
    tft_write_data16_nolock(TFT_X_OFFSET);
    tft_write_data16_nolock(TFT_X_OFFSET + TFT_WIDTH_PIX - 1);
    tft_write_cmd_nolock(ST7735_RASET);
    tft_write_data16_nolock(TFT_Y_OFFSET);
    tft_write_data16_nolock(TFT_Y_OFFSET + TFT_HEIGHT_PIX - 1);

    /* ST7735 RAM 초기값(순백색) 클리어 — print_data는 섹션별 부분 렌더링이라
     * 배경을 전체적으로 덮지 않음. 이거 없으면 wake 시 하얀 화면 발생. */
    tft_fillScreen_nolock(ST7735_BLACK);

    xSemaphoreGive(spi_mutex);

    /* ── mutex 밖 안전 호출 (정적 변수만 변경, SPI 미사용) ── */
    tft_setTextWrap(false);
    tft_setTextSize(1);
    tft_setTextColor(ST7735_BLUE);

    tft_update_activity_time();

    int64_t elapsed_ms = (esp_timer_get_time() - start_us) / 1000;
    ESP_LOGW(TAG, "[TFTINIT WARM] #%lu 완료 (%lld ms, heap=%lu)",
             (unsigned long)s_tft_warm_cycle,
             (long long)elapsed_ms,
             (unsigned long)esp_get_free_heap_size());

    alive_marker_set_location(MARKER_LOC_TFTINIT_WARM_EXIT);

    return ESP_OK;
}

#if LCD_SLEEP_WAKE_STRESS_TEST
/* ====================================================================
 * 헬스체크 + 비트뱅 read 인프라 — STRESS TEST 빌드 전용
 *
 * 양산 빌드(LCD_SLEEP_WAKE_STRESS_TEST=0)에선 컴파일조차 안 됨.
 * 미래 디버깅 재개 시 매크로만 1로 바꾸면 활성화.
 *
 * 12시간 × 20대 검증 결과: 비트뱅 read 자체는 동작 OK. 단, 헬스체크 호출이
 * SPI를 잠깐 free하는 동안 다른 태스크의 tft_write_* 시도가 silently
 * dropped됨 (fail_count 증가). 양산엔 부작용이 있어 가드.
 * ==================================================================== */

/* ===== [안전망2/3] HD 읽기 인프라 (대안 B) =====
 * SPI를 잠깐 teardown 하고 HD 3-wire 모드로 임시 재초기화 → 읽기 → 다시 FD 4-wire로 복귀.
 * 기존 쓰기 경로(spi_handle, dev_cfg)는 0줄 수정. */

#define ST7735_READ_CLOCK_HZ (6 * 1000 * 1000)

/* 원래 FD 4-wire 쓰기 디바이스 복귀.
 * 호출 전제: spi_handle == NULL, SPI2_HOST는 free 상태, mutex는 잡혀 있음. */
static esp_err_t tft_fd_write_bus_restore(void)
{
    spi_bus_config_t bus_cfg = {
        .mosi_io_num = TFT_MOSI_PIN,
        .miso_io_num = -1,
        .sclk_io_num = TFT_SCLK_PIN,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 64,
    };
    esp_err_t ret = spi_bus_initialize(SPI2_HOST, &bus_cfg, SPI_DMA_DISABLED);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "[안전망2] FD bus 복귀 실패: %s", esp_err_to_name(ret));
        return ret;
    }

    spi_device_interface_config_t dev_cfg = {
        .clock_speed_hz = 26 * 1000 * 1000,
        .mode = 0,
        .spics_io_num = -1,
        .queue_size = 7,
        .flags = 0,
        .pre_cb = NULL,
    };
    ret = spi_bus_add_device(SPI2_HOST, &dev_cfg, &spi_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "[안전망2] FD device 복귀 실패: %s", esp_err_to_name(ret));
        spi_bus_free(SPI2_HOST);
        return ret;
    }
    return ESP_OK;
}

/* ===== [비트뱅 read] 데이터시트 Fig 9.3.5 4-line read protocol 직접 구현 =====
 * ESP-IDF SPI HD 3-wire가 GPIO direction 전환을 안 하는 것으로 추정되어 비트뱅으로 우회.
 * Read는 wake당 1회뿐이라 속도(약 100kHz)는 무시 가능.
 *
 * 시퀀스:
 *   1. CS LOW
 *   2. DC LOW (cmd phase) + 8-bit cmd 전송
 *   3. SDA → tri-state (INPUT)
 *   4. DC HIGH (data phase)
 *   5. Dummy clock 1개
 *   6. N바이트 응답 read (rising edge sample)
 *   7. CS HIGH
 */

#define BB_HALF_CYCLE_US 5  /* 100kHz — 충분히 여유, ST7735 SCL min ~100ns */

static inline void bb_delay(void)
{
    esp_rom_delay_us(BB_HALF_CYCLE_US);
}

/* 호출 전제: SPI bus는 free 상태, mutex는 호출자가 잡음.
 * 함수 종료 시 GPIO는 호출자가 FD restore로 정리. */
static esp_err_t tft_bitbang_read_inner(uint8_t cmd, uint8_t *out, size_t out_len)
{
    if (out == NULL || out_len == 0 || out_len > 32) {
        return ESP_ERR_INVALID_ARG;
    }

    /* GPIO 셋업 (MOSI는 read 단계에서 INPUT으로 전환) */
    gpio_set_direction(TFT_CS_PIN, GPIO_MODE_OUTPUT);
    gpio_set_direction(TFT_DC_PIN, GPIO_MODE_OUTPUT);
    gpio_set_direction(TFT_SCLK_PIN, GPIO_MODE_OUTPUT);
    gpio_set_direction(TFT_MOSI_PIN, GPIO_MODE_OUTPUT);

    /* idle 상태: CS HIGH, SCL LOW (mode 0), DC LOW */
    gpio_set_level(TFT_CS_PIN, 1);
    gpio_set_level(TFT_SCLK_PIN, 0);
    gpio_set_level(TFT_DC_PIN, 0);
    gpio_set_level(TFT_MOSI_PIN, 0);
    bb_delay();

    /* 1. CS LOW (트랜잭션 시작) */
    gpio_set_level(TFT_CS_PIN, 0);
    bb_delay();

    /* 2. cmd phase: DC LOW + 8-bit cmd 전송 (MSB first)
     *    SCL LOW일 때 SDA 설정 → SCL HIGH로 올려 ST7735가 sample */
    gpio_set_level(TFT_DC_PIN, 0);
    for (int i = 7; i >= 0; i--) {
        gpio_set_level(TFT_SCLK_PIN, 0);
        gpio_set_level(TFT_MOSI_PIN, (cmd >> i) & 0x01);
        bb_delay();
        gpio_set_level(TFT_SCLK_PIN, 1);
        bb_delay();
    }
    gpio_set_level(TFT_SCLK_PIN, 0);

    /* 3. 명령 마지막 비트 직후 — SDA를 tri-state(INPUT)로
     *    데이터시트: "SDA must be set to tri-state no later than at the falling
     *    edge of SCL of the last bit"
     *    풀업/풀다운 disable: ST7735 응답이 정확히 뜨도록 */
    gpio_set_direction(TFT_MOSI_PIN, GPIO_MODE_INPUT);
    gpio_set_pull_mode(TFT_MOSI_PIN, GPIO_FLOATING);

    /* 4. data phase: DC HIGH */
    gpio_set_level(TFT_DC_PIN, 1);
    bb_delay();

    /* 5. Dummy clock 1개 (데이터시트 Fig 9.3.5 명시) */
    gpio_set_level(TFT_SCLK_PIN, 1);
    bb_delay();
    gpio_set_level(TFT_SCLK_PIN, 0);
    bb_delay();

    /* 6. 응답 N바이트 read.
     *    ST7735는 SCL falling edge에 D 출력, host는 rising edge에 sample */
    for (size_t byte = 0; byte < out_len; byte++) {
        uint8_t b = 0;
        for (int i = 7; i >= 0; i--) {
            gpio_set_level(TFT_SCLK_PIN, 1);
            bb_delay();
            /* rising edge 직후 sample */
            if (gpio_get_level(TFT_MOSI_PIN)) {
                b |= (1 << i);
            }
            gpio_set_level(TFT_SCLK_PIN, 0);
            bb_delay();
        }
        out[byte] = b;
    }

    /* 7. CS HIGH (트랜잭션 끝) */
    gpio_set_level(TFT_CS_PIN, 1);
    bb_delay();

    /* 8. MOSI를 다시 OUTPUT으로 (FD restore가 어차피 잡지만 명시) */
    gpio_set_direction(TFT_MOSI_PIN, GPIO_MODE_OUTPUT);
    gpio_set_level(TFT_MOSI_PIN, 0);

    ESP_LOGW(TAG, "[비트뱅] cmd=0x%02X 응답 %u바이트 (첫바이트=0x%02X)",
             cmd, (unsigned)out_len, out[0]);

    return ESP_OK;
}

/* [안전망2] ST7735 레지스터 읽기 — 외부 API.
 * 절차: mutex 잡기 → FD teardown → HD setup → read → HD teardown → FD restore → mutex 해제. */
esp_err_t tft_read_register(uint8_t cmd, uint8_t *out_buf, size_t out_len)
{
    if (out_buf == NULL || out_len == 0 || out_len > 32) {
        return ESP_ERR_INVALID_ARG;
    }
    if (tft_is_sleeping || spi_mutex == NULL) {
        return ESP_ERR_INVALID_STATE;
    }
    if (xSemaphoreTake(spi_mutex, pdMS_TO_TICKS(1000)) != pdTRUE) {
        ESP_LOGW(TAG, "[비트뱅] mutex 획득 실패 (cmd=0x%02x)", cmd);
        return ESP_ERR_TIMEOUT;
    }

    /* out_buf 0으로 클리어 */
    for (size_t i = 0; i < out_len; i++) out_buf[i] = 0;

    esp_err_t result = ESP_OK;

    /* 1. 기존 FD 디바이스/버스 정리 */
    if (spi_handle != NULL) {
        spi_bus_remove_device(spi_handle);
        spi_handle = NULL;
    }
    spi_bus_free(SPI2_HOST);

    /* 2. 비트뱅 read 수행 (데이터시트 Fig 9.3.5 그대로) */
    result = tft_bitbang_read_inner(cmd, out_buf, out_len);

    /* 3. 원래 FD 4-wire 복귀 — 무조건 시도 */
    {
        esp_err_t restore_err = tft_fd_write_bus_restore();
        if (restore_err != ESP_OK) {
            ESP_LOGE(TAG, "[비트뱅] CRITICAL: FD 복귀 실패! 화면 영구 손상 가능: %s",
                     esp_err_to_name(restore_err));
            if (result == ESP_OK) {
                result = restore_err;
            }
        }
    }

    xSemaphoreGive(spi_mutex);
    return result;
}

/* [안전망3] 패널 헬스체크 — RDDID + RDDST 묶음.
 * RDDID 응답이 all-0xFF 또는 all-0x00이면 IC 응답 없음으로 판정 → ESP_FAIL.
 * RDDST는 raw 값만 로깅 (판정은 일단 안 함, 데이터 모이면 추후 strict 체크). */
esp_err_t tft_check_panel_health(tft_health_report_t *report)
{
    if (report == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    /* report 0으로 클리어 */
    report->id[0] = report->id[1] = report->id[2] = 0;
    report->rddid_ok = false;
    report->id_invalid = false;
    report->status = 0;
    report->rddst_ok = false;

    /* 1. RDDID (0x04) — 3바이트 */
    esp_err_t err = tft_read_register(ST7735_RDDID, report->id, 3);
    report->rddid_ok = (err == ESP_OK);
    if (!report->rddid_ok) {
        ESP_LOGW(TAG, "[안전망3] RDDID 통신 실패: %s", esp_err_to_name(err));
        return ESP_FAIL;
    }

    /* RDDID 판정 */
    bool id_all_ff = (report->id[0] == 0xFF && report->id[1] == 0xFF && report->id[2] == 0xFF);
    bool id_all_00 = (report->id[0] == 0x00 && report->id[1] == 0x00 && report->id[2] == 0x00);
    report->id_invalid = (id_all_ff || id_all_00);

    /* 2. RDDST (0x09) — 4바이트 */
    uint8_t st[4] = {0, 0, 0, 0};
    err = tft_read_register(ST7735_RDDST, st, 4);
    report->rddst_ok = (err == ESP_OK);
    if (report->rddst_ok) {
        report->status = ((uint32_t)st[0] << 24) | ((uint32_t)st[1] << 16)
                       | ((uint32_t)st[2] << 8)  | (uint32_t)st[3];
    } else {
        ESP_LOGW(TAG, "[안전망3] RDDST 통신 실패: %s", esp_err_to_name(err));
    }

    /* 최종 판정 */
    if (report->id_invalid) {
        return ESP_FAIL;
    }
    if (!report->rddst_ok) {
        return ESP_FAIL;
    }
    return ESP_OK;
}

#endif /* LCD_SLEEP_WAKE_STRESS_TEST */