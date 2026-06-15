/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * TFT Display Module Header (ST7735)
 * 포팅: Arduino Adafruit_ST7735 → ESP-IDF
 */
#ifndef IRINGER_TFT_H
#define IRINGER_TFT_H

#include <stdbool.h>
#include <stdint.h>
#include "driver/gpio.h"
#include "driver/ledc.h"
#include "driver/spi_master.h"
#include "esp_log.h"
#include "iringer_fonts.h" // GFXfont 타입 정의를 위해 필요

// TFT 핀 정의 (IR_IRINGER_2.0_PINMAP.md 기준)
#define TFT_CS_PIN GPIO_NUM_23        // IO23: LCD_CS
#define TFT_DC_PIN GPIO_NUM_19        // IO19: LCD_DC
#define TFT_MOSI_PIN GPIO_NUM_21      // IO21: LCD_SDA
#define TFT_SCLK_PIN GPIO_NUM_22      // IO22: LCD_SCL
#define TFT_RST_PIN GPIO_NUM_20       // IO20: LCD_RES
#define TFT_BACKLIGHT_PIN GPIO_NUM_18 // IO18: LCD_BACKLIGHT

// ST7735 색상 정의
#define ST7735_BLACK 0x0000
#define ST7735_WHITE 0xFFFF
#define ST7735_RED 0xF800
#define ST7735_GREEN 0x07E0
#define ST7735_BLUE 0x001F
#define ST7735_CYAN 0x07FF
#define ST7735_MAGENTA 0xF81F
#define ST7735_YELLOW 0xFFE0

// ST7735 명령어 정의
#define ST7735_SLPIN 0x10
#define ST7735_SLPOUT 0x11
#define ST7735_NORON 0x13
#define ST7735_DSPOFF 0x28
#define ST7735_DSPON 0x29
#define ST7735_CASET 0x2A
#define ST7735_RASET 0x2B
#define ST7735_RAMWR 0x2C
#define ST7735_RAMRD 0x2E
#define ST7735_PTLAR 0x30
#define ST7735_COLMOD 0x3A
#define ST7735_MADCTL 0x36
#define ST7735_FRMCTR1 0xB1
#define ST7735_FRMCTR2 0xB2
#define ST7735_FRMCTR3 0xB3
#define ST7735_INVCTR 0xB4
#define ST7735_DISSET5 0xB6
#define ST7735_PWCTR1 0xC0
#define ST7735_PWCTR2 0xC1
#define ST7735_PWCTR3 0xC2
#define ST7735_PWCTR4 0xC3
#define ST7735_PWCTR5 0xC4
#define ST7735_VMCTR1 0xC5
#define ST7735_RDID1 0xDA
#define ST7735_RDID2 0xDB
#define ST7735_RDID3 0xDC
#define ST7735_RDID4 0xDD
#define ST7735_PWCTR6 0xFC
#define ST7735_GMCTRP1 0xE0
#define ST7735_GMCTRN1 0xE1

// ST7735 초기화 옵션
#define INITR_144GREENTAB 0x01

// 화면 좌표 정의
#define FIRST_X 4
#define FIRST_Y 2

// LCD Short Address 표시: 1이면 My/P 주소 표시, 0이면 미표시 (#if
// SHOW_SHORT_ADDRESS 로 제어)
#define SHOW_SHORT_ADDRESS 0

// 백라이트 PWM 설정
#define TFT_BACKLIGHT_TIMER LEDC_TIMER_0
#define TFT_BACKLIGHT_CHANNEL LEDC_CHANNEL_0
#define TFT_BACKLIGHT_FREQ_HZ 5000
#define TFT_BACKLIGHT_DUTY_DEFAULT 50 // 기본 밝기 50%
#define TFT_BACKLIGHT_DUTY_DIM 20     // 감소 밝기 20%
#define TFT_BACKLIGHT_DUTY_OFF 0      // 꺼짐 0%

// 자동 백라이트 제어 설정
#define BACKLIGHT_DIM_TIMEOUT_MS 10000 // 10초 후 20% 밝기
#define BACKLIGHT_OFF_TIMEOUT_MS                                               \
  15000 // 15초 후 OFF (10초 후 20% 밝기, 그 후 5초 후 꺼짐)

// ============================================
// 초기 부팅 후 LCD OFF 및 슬립 진입 시간 설정
// ============================================
// 테스트 엔지니어가 초기 부팅 후 LCD OFF 및 슬립 진입 시간을 변경할 수
// 있습니다. 기본값: 6초 ⚠️ 중요: 리포트 전송 주기와 독립적으로 동작합니다.
// - LCD OFF 시간이 리포트 주기보다 길면: LCD ON 상태에서 리포트 전송
// - LCD OFF 시간이 리포트 주기보다 짧으면: LCD OFF 후 Wake-up하여 리포트 전송
// 변경 예시:
//   - 1분 후 LCD OFF: LCD_SLEEP_DELAY_SEC = 60
//   - 10분 후 LCD OFF: LCD_SLEEP_DELAY_SEC = 600
//   - 30분 후 LCD OFF: LCD_SLEEP_DELAY_SEC = 1800

// 첫 다운링크 수신 후 LCD OFF 및 슬립 진입 대기 시간 (초 단위)
// 리포트 전송 주기와 독립적으로 설정 가능
#define LCD_SLEEP_DELAY_SEC 600 // 부팅 후 LCD OFF 대기 시간 (초 단위)

// 첫 다운링크 수신 후 LCD OFF 및 슬립 진입 대기 시간 (밀리초 단위)
#define LCD_SLEEP_DELAY_MS (LCD_SLEEP_DELAY_SEC * 1000) // 18000000ms (5시간, LCD_SLEEP_DELAY_SEC=18000 기준)

// 표시 전용 데이터 (TFT가 메인 앱 타입에 의존하지 않도록 사용)
typedef struct {
    char battery_level;
    float gtt;
    float ml_per_hour;
    uint16_t rest_min;
    float injected_amount;
    float r_volume_max;
    float r_volume_now;
      // -- 0612 표시 데이터 추가 
    float ordered_cchr;
} tft_display_data_t;

// 자동 백라이트 제어: 접근자 함수 (전역 extern 제거)
bool tft_get_backlight_auto_control_enabled(void);
void tft_set_backlight_auto_control_enabled(bool enable);

// TFT 초기화 (first_boot: true=최초 부팅 시 백라이트/UI태스크 포함, false=슬립 웨이크 시 SPI만 재초기화)
esp_err_t tft_init(bool first_boot);

/* TFT warm reinit — wake 시 SPI 버스 free/init 없이 ST7735만 재초기화.
 * 사전 조건: spi_handle/spi_mutex 둘 다 valid (boot 후 1회 이상 cold init 필요).
 * 사전 조건 위반 시 ESP_ERR_INVALID_STATE 리턴 → 호출자가 cold fallback. */
esp_err_t tft_init_warm(void);

// 기본 그래픽 함수
void tft_fillScreen(uint16_t color);
void tft_setRotation(uint8_t rotation);
void tft_setTextWrap(bool wrap);
void tft_setTextSize(uint8_t size);
void tft_setTextSizeFloat(float size); // 중간 사이즈 지원 (예: 1.5)
void tft_setTextColor(uint16_t color);
void tft_setCursor(int16_t x, int16_t y);
void tft_print(const char *str);
void tft_print_num(uint16_t n);
void tft_print_float(float n, uint8_t decimals);

// GFX 폰트 지원 함수
void tft_setFont(const GFXfont *font);
const GFXfont *tft_getFont(void);
void tft_print_utf8(const char *str);

// 커스텀 출력 함수 (Arduino 코드 포팅)
void print_num4(uint16_t n);
void print_fnum4(float n);
void print_num3(uint16_t n);
void print_num3_2(uint16_t n);
void print_num3_2_cyan(uint16_t n); // 투여량 전용 (청록색)
void print_num4x(uint16_t n);
void print_fnum4x(float n);
void print_num5x_2(uint16_t n);
void print_num5x(uint16_t n);
void print_num3x(uint16_t n);
void print_fnum3x(float n);
void space(uint8_t n);
void spacex(uint8_t n);
void space2(uint8_t n);
void space5(uint8_t n);

// 디스플레이 초기화 및 메인 화면 설정
void display_main(void);

// 데이터 표시 함수
void print_data(void);

// 표시 데이터 설정 (메인 앱에서 tft_display_data_t를 채워 전달)
void tft_set_display_data(const tft_display_data_t *data);

// 연결 상태 설정 (0: 연결 안됨, 1: 연결됨, 2: 서버 연결됨)
void tft_set_connection_status(int status);

// Phase 6: 신호 강도 설정 (LQI 기반, 0-4 단계)
void tft_set_signal_strength(
    uint8_t level); // 0: 연결 안됨, 1-4: 신호 강도 단계

#ifdef SHOW_SHORT_ADDRESS
// LCD Short Address 표시 (엔드디바이스: 첫 줄 74ED 부모주소 형식, 둘째 줄 My
// 4자리 16진수)
void tft_set_short_address_ed(uint16_t my_addr, uint16_t parent_addr,
                              uint16_t pan_id);
#endif

// 백라이트 제어 함수
void tft_set_backlight_duty(uint8_t duty);
void tft_enter_sleep(void);
void tft_exit_sleep(void);
void tft_update_activity_time(void);
uint32_t tft_get_inactive_time(void);
// Light Sleep 웨이크 직후 hold 자동 해제 시 백라이트 OFF 재고정 (깜빡임 방지)
void tft_backlight_assert_off_after_wake(void);

// Phase 5: LCD 백라이트 조건부 켜기
void tft_backlight_turn_on_condition(
    void); // 초기 부팅 또는 GTT 30% 변화 시 호출 (30초간)
void tft_backlight_check_condition_timer(
    void); // 30초 타이머 확인 (주기적으로 호출)

// 화면 전체 제어 (백라이트 + LCD 패널 + GPIO)
void tft_display_on(void);
void tft_display_off(void);

// LCD 슬립 상태 확인 (Wake 후 TFT 업데이트 시 LCD OFF면 생략용)
bool tft_is_lcd_sleeping(void);

// LCD 끄기/켜기 단일 진입점 (모듈화: 메인 루프·Phase 2 등 모든 경로에서 사용)
void tft_lcd_off(void);
// LCD OFF 요청 후 UI 태스크에서 실제로 OFF 완료할 때까지 대기 (timeout_ms 내 완료 시 true)
bool tft_lcd_off_and_wait(uint32_t timeout_ms);
void tft_lcd_on(void);
bool tft_lcd_on_and_wait(uint32_t timeout_ms);

// Phase 2 LCD 5분 타이머 중지 (알람/대기 활성 시 LCD OFF 방지)
void tft_lcd_sleep_timer_stop(void);

// Sleep 시 UI 태스크 suspend/resume용 핸들 접근 (전략4)
TaskHandle_t tft_ui_get_task_handle(void);

#endif // IRINGER_TFT_H

