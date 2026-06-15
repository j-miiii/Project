/*
 * 내부 헤더: iringer_display 컴포넌트 내부에서만 사용
 * - panel/ui/power 분리 파일 간 공유 심볼/프로토타입 정의
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

// UI 큐 메시지 타입 (렌더 + Power 명령)
#define TFT_UI_MSG_RENDER                0x01
#define TFT_UI_MSG_DISPLAY_MAIN          0x02
#define TFT_UI_MSG_POWER_LCD_ON          0x10
#define TFT_UI_MSG_POWER_LCD_OFF         0x11
#define TFT_UI_MSG_POWER_DISPLAY_ON      0x12
#define TFT_UI_MSG_POWER_DISPLAY_OFF     0x13
#define TFT_UI_MSG_POWER_ENTER_SLEEP     0x14
#define TFT_UI_MSG_POWER_BACKLIGHT_TURN_ON 0x15

// power 모듈이 소유하는 상태 (UI가 참조)
extern bool tft_is_sleeping;
extern bool force_refresh_after_sleep;

// power 모듈 내부 함수 (panel init에서 사용)
esp_err_t tft_backlight_init(void);

// panel 모듈이 제공하는 저수준 도형/전송 API (UI/Power에서 사용)
void tft_write_cmd(uint8_t cmd);
void tft_display_output_on(void);  /* fillScreen+print_data 후 DSPON (그려진 상태에서 예쁘게 ON) */
bool tft_is_spi_ready(void);       /* spi_handle != NULL 여부 (power 모듈용) */
void tft_write_data(uint8_t data);
void tft_write_data16(uint16_t data);

/* [안전망1] SPI 에러 카운터 — tft_init() 시작 시 0 리셋, transmit 실패 시 ++ */
uint32_t tft_get_spi_error_count(void);
void tft_reset_spi_error_count(void);

#include "iringer_lcd_sleep.h"  /* LCD_SLEEP_WAKE_STRESS_TEST */

#if LCD_SLEEP_WAKE_STRESS_TEST
/* ── 헬스체크 + 비트뱅 read 인프라 (STRESS TEST 빌드 전용) ── */

/* [안전망2/3] 패널 헬스 리포트 (RDDID + RDDST raw) */
typedef struct {
    uint8_t  id[3];        /* RDDID 응답 3바이트 */
    bool     rddid_ok;     /* RDDID transmit 성공 여부 */
    bool     id_invalid;   /* id가 all-0xFF or all-0x00이면 true */
    uint32_t status;       /* RDDST 응답 4바이트 (raw) */
    bool     rddst_ok;     /* RDDST transmit 성공 여부 */
} tft_health_report_t;

/* [안전망2] ST7735 레지스터 1개 읽기 — 비트뱅 fallback */
esp_err_t tft_read_register(uint8_t cmd, uint8_t *out_buf, size_t out_len);

/* [안전망3] 패널 헬스체크 — RDDID + RDDST 묶음 */
esp_err_t tft_check_panel_health(tft_health_report_t *report);
#endif /* LCD_SLEEP_WAKE_STRESS_TEST */

void tft_draw_pixel(int16_t x, int16_t y, uint16_t color);
void tft_fill_rect_fast(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
void tft_draw_fast_hline(int16_t x, int16_t y, int16_t w, uint16_t color);
void tft_draw_fast_vline(int16_t x, int16_t y, int16_t h, uint16_t color);
void tft_draw_rect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
void tft_fill_round_rect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t radius, uint16_t color);

// UI 렌더 (power 모듈에서 wake 직후 호출)
void print_data(void);

// UI 태스크 시작 (tft_init 이후 1회)
void tft_ui_task_start(void);

// Display Power 라우팅: Power 명령을 UI 태스크 큐에 enqueue
void tft_ui_enqueue_power_cmd(uint8_t cmd);
// Power 명령을 큐 맨 앞에 넣어 우선 처리 (LCD OFF 등)
void tft_ui_enqueue_power_cmd_front(uint8_t cmd);

// Display Power 실행 (UI 태스크에서만 호출, power 모듈 구현)
void tft_power_do_cmd(uint8_t cmd);

