/*
 * TFT Display - UI/Renderer 영역
 * - 텍스트 렌더링, 아이콘/레이아웃, display_main/print_data
 * - SPI/패널 제어는 panel 모듈에 위임
 */
#include "iringer_tft.h"
#include "iringer_tft_internal.h"

#include "esp_log.h"
#include "esp_timer.h"

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include <inttypes.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

// 한글 폰트 include (Display 컴포넌트 private include)
#include "Korean_TuYeo12pt7b.h"
#include "iringer_tft_ui_layout.h"

static const char *TAG = "TFT";

#ifndef TFT_UI_VERBOSE
#define TFT_UI_VERBOSE 0
#endif


// #include "iringer_ir_end_device_2.1.h"

// static ir_downlink_payload_t g_downlink_info;

// void downlink_info (uint16_t gtt){
//     g_downlink_info.
// }

typedef struct {
    uint16_t max_ml;
    float rest_ml;
    uint16_t mlph;
    int gtt;
    float injected_ml;
    uint32_t bat_percent;
    int bat_step_old;
    int connection_status_old;
    uint8_t signal_strength_old;
    // 텍스트 엔진 상태
    uint16_t text_color;
    float text_size;
    int16_t cursor_x;
    int16_t cursor_y;
    bool text_wrap;
    const GFXfont *current_gfx_font;
    char time_rest[8];
    char time_progress[8];
} tft_ui_state_t;

// 디스플레이 상태 변수(렌더링 캐시)
static tft_ui_state_t ui_state = {
    .max_ml = 0,
    .rest_ml = 0.0f,
    .mlph = 0,
    .gtt = 0,
    .injected_ml = 0.0f,
    .bat_percent = 0,
    .bat_step_old = -1,
    .connection_status_old = -1,
    .signal_strength_old = 255,
    .text_color = ST7735_WHITE,
    .text_size = 1.0f,
    .cursor_x = 0,
    .cursor_y = 0,
    .text_wrap = false,
    .current_gfx_font = NULL,
    .time_rest = "00:00",
    .time_progress = "00:00",
};

// 연결 상태/신호
typedef struct {
    int connection_status;
    uint8_t signal_strength;
    tft_display_data_t display_data;
    bool display_data_valid;
} tft_ui_input_t;

// UI 입력 상태(외부에서 주입되는 값)
static tft_ui_input_t ui_input = {
    .connection_status = 0,
    .signal_strength = 0,
    .display_data_valid = false,
};

// ===== UI 태스크/동기화 =====

// 렌더링은 단일 태스크에서만 수행하여, 렌더 중 입력 변경(데이터 레이스)을 제거한다.
static SemaphoreHandle_t ui_input_mutex = NULL;
static TaskHandle_t tft_ui_task_handle = NULL;
static QueueHandle_t ui_cmd_queue = NULL;

#define TFT_UI_QUEUE_LEN 16
#define TFT_UI_QUEUE_ITEM uint8_t

/** @return true: lock 획득 성공, false: mutex 없음 또는 타임아웃 (호출부는 unlock 호출 금지) */
static inline bool tft_ui_input_lock(void)
{
    if (ui_input_mutex == NULL) {
        return false;
    }
    if (xSemaphoreTake(ui_input_mutex, pdMS_TO_TICKS(500)) != pdTRUE) {
        ESP_LOGW(TAG, "tft_ui_input_lock: mutex timeout");
        return false;
    }
    return true;
}

static inline void tft_ui_input_unlock(void)
{
    if (ui_input_mutex != NULL) {
        (void)xSemaphoreGive(ui_input_mutex);
    }
}

static inline void tft_ui_enqueue(uint8_t msg)
{
    if (ui_cmd_queue != NULL) {
        UBaseType_t before = uxQueueMessagesWaiting(ui_cmd_queue);
        BaseType_t ret = xQueueSend(ui_cmd_queue, &msg, pdMS_TO_TICKS(100));
        if (ret != pdTRUE) {
            ESP_LOGW(TAG, "UI큐 SEND 실패: msg=0x%02x (큐 포화, before=%u)", msg, (unsigned)before);
        } else if (before >= (TFT_UI_QUEUE_LEN - 4)) {
            /* 큐 포화 임박 시에만 로그 (스팸 방지) */
            ESP_LOGW(TAG, "UI큐 SEND OK: msg=0x%02x (queue %u/%d)", msg, (unsigned)(before + 1), TFT_UI_QUEUE_LEN);
        }
    }
}

static inline void tft_ui_enqueue_front(uint8_t msg)
{
    if (ui_cmd_queue != NULL) {
        BaseType_t ret = xQueueSendToFront(ui_cmd_queue, &msg, pdMS_TO_TICKS(100));
        if (ret != pdTRUE) {
            ESP_LOGW(TAG, "UI큐 FRONT 실패: msg=0x%02x (큐 포화)", msg);
        }
    }
}

void tft_ui_enqueue_power_cmd(uint8_t cmd)
{
    tft_ui_enqueue(cmd);
}

/* Power 명령을 큐 맨 앞에 넣어 RENDER 등보다 우선 처리 (LCD OFF/슬립 지연 방지) */
void tft_ui_enqueue_power_cmd_front(uint8_t cmd)
{
    tft_ui_enqueue_front(cmd);
}

// ===== 내부 UI 헬퍼 =====

// 전방 선언: 아래쪽에 정의된 내부 아이콘 렌더러
static void tft_draw_signal_icon(uint8_t strength, bool is_connected, bool animating);
static void tft_draw_battery_icon(int batStep);

typedef struct {
    // raw/derived
    uint32_t bat_percent;
    uint16_t mlph;
    int gtt;
    float injected_ml;

    float ordered_cchh; // 처방 속도(0612)

    // time strings (background only)
    char time_progress[8];
    char time_rest[8];

    // flags
    bool animating;
    bool was_force_refresh;
    bool need_redraw_icon;
    bool has_changes;
} tft_frame_t;

static void tft_frame_calc_time_strings(tft_frame_t *f, const tft_display_data_t *data)
{
    int64_t now_us = esp_timer_get_time();
    uint32_t now_sec = (uint32_t)(now_us / 1000000);
    uint16_t now_min = now_sec / 60;
    uint16_t now_hour = now_min / 60;
    now_min = now_min % 60;
    snprintf(f->time_progress, sizeof(f->time_progress), "%02d:%02d", now_hour, now_min);

    uint16_t rest_hour = data->rest_min / 60;
    if (rest_hour > 100) snprintf(f->time_rest, sizeof(f->time_rest), "--:--");
    else snprintf(f->time_rest, sizeof(f->time_rest), "%02d:%02d", rest_hour, data->rest_min % 60);
}

static void tft_render_signal_icon(const tft_frame_t *f, const tft_ui_input_t *in)
{
    if (!(f->need_redraw_icon || f->has_changes)) {
        return;
    }

    tft_setTextColor(ST7735_WHITE);
    tft_draw_signal_icon(in->signal_strength, in->connection_status > 0, f->animating);
    ui_state.connection_status_old = in->connection_status;
    ui_state.signal_strength_old = in->signal_strength;
}

static void tft_update_background_time_strings(const tft_frame_t *f)
{
    snprintf(ui_state.time_progress, sizeof(ui_state.time_progress), "%s", f->time_progress);
    snprintf(ui_state.time_rest, sizeof(ui_state.time_rest), "%s", f->time_rest);
}

static void tft_render_battery_icon(const tft_frame_t *f, bool first_call)
{
    int bat_step = (int)f->bat_percent / 5;
    if (bat_step > 20) bat_step = 20;
    if (bat_step < 0) bat_step = 0;

    if (ui_state.bat_step_old != bat_step || first_call || f->was_force_refresh) {
        tft_draw_battery_icon(bat_step);
        ui_state.bat_step_old = bat_step;
        ui_state.bat_percent = f->bat_percent;
    }
}

static void tft_render_injected_amount(const tft_frame_t *f, bool first_call)
{
    if (ui_state.injected_ml == f->injected_ml && !first_call && !f->was_force_refresh) {
        return;
    }

    // tft_fill_rect_fast(INJ_VALUE_X, INJ_VALUE_Y, 50, 16, ST7735_BLACK);
    // tft_setCursor(INJ_VALUE_X, INJ_VALUE_Y);
    // tft_setTextSizeFloat(1.5f);
    // uint16_t injected_int = (uint16_t)(f->injected_ml + 0.5f);
    // tft_setTextColor(injected_int >= 1000 ? ST7735_BLUE : ST7735_CYAN);
    // if (injected_int >= 1000) print_num4(injected_int);
    // else print_num3_2_cyan(injected_int);
    // ui_state.injected_ml = f->injected_ml;
}
/*0427 gtt 삭제*/
// static void tft_render_gtt(const tft_frame_t *f, bool first_call)
// {
//     /* GTT 색상 명시적 설정 (주소 표시 CYAN 등 다른 경로에서 바뀌어도 항상 GREEN 유지) */
//     tft_setTextColor(ST7735_GREEN);

//     if (ui_state.gtt == f->gtt && !first_call && !f->was_force_refresh) {
//         return;
//     }

//     tft_fill_rect_fast(GTT_VALUE_X, GTT_VALUE_Y, 45, 13, ST7735_BLACK);
//     ui_state.gtt = f->gtt;
//     tft_setCursor(GTT_VALUE_X, GTT_VALUE_Y);
//     tft_setTextSizeFloat(1.5f);
//     tft_setTextColor(ST7735_GREEN);
//     if (ui_state.gtt < 0) {
//         print_num5x_2(0);
//     } else {
//         print_num5x_2((uint16_t)ui_state.gtt);
//     }
// }

//  ---------------------cchr  추가 부분 0612 ----------------------------
// static void tft_render_ordered_cchh(const tft_frame_t *f, bool first_call)
// {
//     // 이전 값과 동일하면 화면을 다시 그리지 않음 (깜빡임 방지)
//     // float의 정수 부분만 비교하거나, 필요시 float 캐시 변수를 만들어도 됩니다.
//     if (ui_state.gtt == (int)f->ordered_cchh && !first_call && !f->was_force_refresh) {
//         return;
//     }

//     // 기존 숫자가 있던 자리를 검은색 네모로 덮어서 지움 (잔상 방지)
//     tft_fill_rect_fast(INJ_VALUE_X, INJ_VALUE_Y, 50, 16, ST7735_BLACK);
//     tft_setCursor(INJ_VALUE_X, INJ_VALUE_Y);
//     // UI 캐시 업데이트
//     ui_state.gtt = (int)f->ordered_cchh;

//     // 초록색으로 1.5배 크기 텍스트 출력
//     tft_setCursor(INJ_VALUE_X, INJ_VALUE_Y);
//     tft_setTextSizeFloat(1.5f);
//     tft_setTextColor(ST7735_CYAN);
    
//     // 21.00 처럼 소수점 1자리까지 문자열로 만들어서 출력 (21.0)
//     char buf[16];
//     //print_num3_2_cyan((uint16_t)f->ordered_cchh);
//     // snprintf(buf, sizeof(buf), "%d", (int)f->ordered_cchh);
//     // tft_print(buf);
// }
 static void tft_render_ordered_cchh(const tft_frame_t *f, bool first_call) {
if (ui_state.gtt == (int)f->ordered_cchh && !first_call && !f->was_force_refresh) {
        return;
    }

    // 🚨 기존의 좁은 영역 대신, 가로 전체를 시원하게 까맣게 지웁니다! (찌꺼기 완벽 제거)
    tft_fill_rect_fast(0, 45, 128, 25, ST7735_BLACK); 
    ui_state.gtt = (int)f->ordered_cchh;

    tft_setCursor(25, 55); // 가운데 정렬을 위해 X 좌표를 25로 넉넉히 줌
    tft_setTextSizeFloat(1.5f);
    tft_setTextColor(ST7735_WHITE);
    
    char buf[20];
    snprintf(buf, sizeof(buf), "%d cc/hr", (int)f->ordered_cchh);
    tft_print(buf);
}






// static void tft_render_mlph(const tft_frame_t *f, bool first_call)
// {
//     /* cc/hr 색상 명시적 설정 (주입량 BLUE/CYAN 등 다른 경로에서 바뀌어도 항상 YELLOW 유지) */
//     tft_setTextColor(ST7735_YELLOW);

//     if (ui_state.mlph == f->mlph && !first_call && !f->was_force_refresh) {
//         return;
//     }

//     tft_fill_rect_fast(CC_VALUE_X, CC_VALUE_Y, 45, 15, ST7735_BLACK);
//     ui_state.mlph = f->mlph;
//     tft_setCursor(CC_VALUE_X, CC_VALUE_Y);
//     tft_setTextSizeFloat(1.5f);
//     tft_setTextColor(ST7735_CYAN);
//     print_num3_2(f->mlph);
// }

// ========================================================
// 2. 아래: 현재 속도 (파란색 큰 글씨, "0")
// ========================================================
static void tft_render_mlph(const tft_frame_t *f, bool first_call)
{
if (ui_state.mlph == f->mlph && !first_call && !f->was_force_refresh) {
        return;
    }

    // 🚨 좁은 지우개 버리고, 화면 아래쪽 전체를 시원하게 지웁니다!
    tft_fill_rect_fast(0, 75, 128, 40, ST7735_BLACK);
    ui_state.mlph = f->mlph;

    // 1. 출력할 숫자 먼저 생성
    char buf[10];
    snprintf(buf, sizeof(buf), "%d", (int)f->mlph);

    // 2. 가운데 정렬 X 좌표 계산 (크기 3.0일 때 글자 절반 크기인 9를 곱함)
    int start_x = 64 - (strlen(buf) * 9);

    // 3. 계산된 좌표에 출력
    tft_setCursor(start_x, 80); 
    tft_setTextSizeFloat(3.0f);
    tft_setTextColor(ST7735_CYAN);
    tft_print(buf);
}





static void tft_render_labels_after_wakeup(const tft_frame_t *f)
{
    if (!f->was_force_refresh) {
        return;
    }

    // tft_setTextSizeFloat(1.5f);
    // tft_setTextColor(ST7735_YELLOW);
    // tft_setCursor(INJ_LABEL_X, INJ_LABEL_Y);
    // //tft_print("ml");
    // tft_print("cc/hr");
    // tft_setCursor(CC_LABEL_X, CC_LABEL_Y);
    // tft_print("cc/hr");
    // tft_setCursor(GTT_LABEL_X, GTT_LABEL_Y);
    // tft_print("Gtt");
}

static void tft_draw_signal_icon(uint8_t strength, bool is_connected, bool animating)
{
    int16_t area_x = SIGNAL_ICON_CX - (SIGNAL_ICON_W / 2);
    int16_t area_y = SIGNAL_ICON_CY - (SIGNAL_ICON_H / 2);
    tft_fill_rect_fast(area_x, area_y, SIGNAL_ICON_W, SIGNAL_ICON_H, ST7735_BLACK);

    uint16_t color =
        animating ? ST7735_YELLOW : (is_connected ? ST7735_GREEN : ST7735_RED);
    uint8_t stage;
    if (animating) {
        uint64_t t = esp_timer_get_time(); 
        stage = (uint8_t)((t / 200000ULL) % 4) + 1; // 1~4
        if (TFT_UI_VERBOSE) {
            ESP_LOGD(TAG, "애니메이션 stage 계산: t=%llu, stage=%d, animating=true", t, stage);
        }
    } else {
        stage = strength;
        if (stage == 0) stage = 1;
    }

    tft_fill_rect_fast(SIGNAL_ICON_CX - 1, SIGNAL_ICON_CY, 3, 3, color);

    if (stage >= 2) {
        tft_draw_fast_hline(SIGNAL_ICON_CX - 3, SIGNAL_ICON_CY - 3, 7, color);
        tft_draw_fast_hline(SIGNAL_ICON_CX - 2, SIGNAL_ICON_CY - 4, 5, color);
    }
    if (stage >= 3) {
        tft_draw_fast_hline(SIGNAL_ICON_CX - 5, SIGNAL_ICON_CY - 6, 11, color);
        tft_draw_fast_hline(SIGNAL_ICON_CX - 4, SIGNAL_ICON_CY - 7, 9, color);
    }
    if (stage >= 4) {
        tft_draw_fast_hline(SIGNAL_ICON_CX - 7, SIGNAL_ICON_CY - 9, 15, color);
        tft_draw_fast_hline(SIGNAL_ICON_CX - 6, SIGNAL_ICON_CY - 10, 13, color);
    }
}

static void tft_draw_battery_icon(int batStep)
{
    int16_t bat_x = BAT_ICON_X;
    int16_t bat_y = BAT_ICON_Y;
    int16_t bat_width = 20;
    int16_t bat_height = 10;
    int16_t bat_radius = 2;
    int16_t plus_w = 3;
    int16_t plus_h = 5;
    int16_t plus_x = bat_x + bat_width + 1;
    int16_t plus_y = bat_y + 2;

    int16_t clear_w = bat_width + plus_w + 4;
    int16_t clear_h = bat_height + 4;
    tft_fill_rect_fast(bat_x - 2, bat_y - 2, clear_w, clear_h, ST7735_BLACK);

    if (batStep > 0) {
        if (batStep > bat_width) batStep = bat_width;
        tft_fill_round_rect(bat_x, bat_y, batStep, bat_height, bat_radius, ST7735_GREEN);
    }

    tft_draw_rect(bat_x - 2, bat_y - 2, bat_width + 4, bat_height + 4, ST7735_WHITE);
    tft_fill_round_rect(plus_x, plus_y, plus_w, plus_h, 1, ST7735_WHITE);
}

// ===== Public API: Text =====

void tft_setTextWrap(bool wrap) { ui_state.text_wrap = wrap; }
void tft_setTextSize(uint8_t size) { ui_state.text_size = (float)size; }
void tft_setTextSizeFloat(float size) { ui_state.text_size = size; }
void tft_setTextColor(uint16_t color) { ui_state.text_color = color; }

void tft_setCursor(int16_t x, int16_t y)
{
    ui_state.cursor_x = x;
    ui_state.cursor_y = y;
}

// 간단한 5x7 비트맵 폰트 데이터 (ASCII 0x20-0x7E)
static const uint8_t font_5x7[][5] = {
    {0x00, 0x00, 0x00, 0x00, 0x00}, {0x00, 0x00, 0x5F, 0x00, 0x00},
    {0x00, 0x07, 0x00, 0x07, 0x00}, {0x14, 0x7F, 0x14, 0x7F, 0x14},
    {0x24, 0x2A, 0x7F, 0x2A, 0x12}, {0x23, 0x13, 0x08, 0x64, 0x62},
    {0x36, 0x49, 0x55, 0x22, 0x50}, {0x00, 0x05, 0x03, 0x00, 0x00},
    {0x00, 0x1C, 0x22, 0x41, 0x00}, {0x00, 0x41, 0x22, 0x1C, 0x00},
    {0x14, 0x08, 0x3E, 0x08, 0x14}, {0x08, 0x08, 0x3E, 0x08, 0x08},
    {0x00, 0x00, 0xA0, 0x60, 0x00}, {0x08, 0x08, 0x08, 0x08, 0x08},
    {0x00, 0x60, 0x60, 0x00, 0x00}, {0x20, 0x10, 0x08, 0x04, 0x02},
    {0x3E, 0x51, 0x49, 0x45, 0x3E}, {0x00, 0x42, 0x7F, 0x40, 0x00},
    {0x42, 0x61, 0x51, 0x49, 0x46}, {0x21, 0x41, 0x45, 0x4B, 0x31},
    {0x18, 0x14, 0x12, 0x7F, 0x10}, {0x27, 0x45, 0x45, 0x45, 0x39},
    {0x3C, 0x4A, 0x49, 0x49, 0x30}, {0x01, 0x71, 0x09, 0x05, 0x03},
    {0x36, 0x49, 0x49, 0x49, 0x36}, {0x06, 0x49, 0x49, 0x29, 0x1E},
    {0x00, 0x36, 0x36, 0x00, 0x00}, {0x00, 0x56, 0x36, 0x00, 0x00},
    {0x08, 0x14, 0x22, 0x41, 0x00}, {0x14, 0x14, 0x14, 0x14, 0x14},
    {0x00, 0x41, 0x22, 0x14, 0x08}, {0x02, 0x01, 0x51, 0x09, 0x06},
    {0x32, 0x49, 0x59, 0x51, 0x3E}, {0x7C, 0x12, 0x11, 0x12, 0x7C},
    {0x7F, 0x49, 0x49, 0x49, 0x36}, {0x3E, 0x41, 0x41, 0x41, 0x22},
    {0x7F, 0x41, 0x41, 0x22, 0x1C}, {0x7F, 0x49, 0x49, 0x49, 0x41},
    {0x7F, 0x09, 0x09, 0x09, 0x01}, {0x3E, 0x41, 0x49, 0x49, 0x7A},
    {0x7F, 0x08, 0x08, 0x08, 0x7F}, {0x00, 0x41, 0x7F, 0x41, 0x00},
    {0x20, 0x40, 0x41, 0x3F, 0x01}, {0x7F, 0x08, 0x14, 0x22, 0x41},
    {0x7F, 0x40, 0x40, 0x40, 0x40}, {0x7F, 0x02, 0x0C, 0x02, 0x7F},
    {0x7F, 0x04, 0x08, 0x10, 0x7F}, {0x3E, 0x41, 0x41, 0x41, 0x3E},
    {0x7F, 0x09, 0x09, 0x09, 0x06}, {0x3E, 0x41, 0x51, 0x21, 0x5E},
    {0x7F, 0x09, 0x19, 0x29, 0x46}, {0x46, 0x49, 0x49, 0x49, 0x31},
    {0x01, 0x01, 0x7F, 0x01, 0x01}, {0x3F, 0x40, 0x40, 0x40, 0x3F},
    {0x1F, 0x20, 0x40, 0x20, 0x1F}, {0x3F, 0x40, 0x38, 0x40, 0x3F},
    {0x63, 0x14, 0x08, 0x14, 0x63}, {0x07, 0x08, 0x70, 0x08, 0x07},
    {0x61, 0x51, 0x49, 0x45, 0x43}, {0x00, 0x7F, 0x41, 0x41, 0x00},
    {0x02, 0x04, 0x08, 0x10, 0x20}, {0x00, 0x41, 0x41, 0x7F, 0x00},
    {0x04, 0x02, 0x01, 0x02, 0x04}, {0x40, 0x40, 0x40, 0x40, 0x40},
    {0x00, 0x01, 0x02, 0x04, 0x00}, {0x20, 0x54, 0x54, 0x54, 0x78},
    {0x7F, 0x48, 0x44, 0x44, 0x38}, {0x38, 0x44, 0x44, 0x44, 0x20},
    {0x38, 0x44, 0x44, 0x48, 0x7F}, {0x38, 0x54, 0x54, 0x54, 0x18},
    {0x08, 0x7E, 0x09, 0x01, 0x02}, {0x18, 0xA4, 0xA4, 0xA4, 0x7C},
    {0x7F, 0x08, 0x04, 0x04, 0x78}, {0x00, 0x44, 0x7D, 0x40, 0x00},
    {0x40, 0x80, 0x84, 0x7D, 0x00}, {0x7F, 0x10, 0x28, 0x44, 0x00},
    {0x00, 0x41, 0x7F, 0x40, 0x00}, {0x7C, 0x04, 0x18, 0x04, 0x78},
    {0x7C, 0x08, 0x04, 0x04, 0x78}, {0x38, 0x44, 0x44, 0x44, 0x38},
    {0xFC, 0x24, 0x24, 0x24, 0x18}, {0x18, 0x24, 0x24, 0x18, 0xFC},
    {0x7C, 0x08, 0x04, 0x04, 0x08}, {0x48, 0x54, 0x54, 0x54, 0x20},
    {0x04, 0x3F, 0x44, 0x40, 0x20}, {0x3C, 0x40, 0x40, 0x20, 0x7C},
    {0x1C, 0x20, 0x40, 0x20, 0x1C}, {0x3C, 0x40, 0x30, 0x40, 0x3C},
    {0x44, 0x28, 0x10, 0x28, 0x44}, {0x1C, 0xA0, 0xA0, 0xA0, 0x7C},
    {0x44, 0x64, 0x54, 0x4C, 0x44}, {0x00, 0x08, 0x36, 0x41, 0x00},
    {0x00, 0x00, 0x7F, 0x00, 0x00}, {0x00, 0x41, 0x36, 0x08, 0x00},
    {0x10, 0x08, 0x08, 0x10, 0x08},
};

static void tft_draw_char(int16_t x, int16_t y, char c, uint16_t color, float size)
{
    if (c < 0x20 || c > 0x7E) c = 0x20;
    const uint8_t *font_data = font_5x7[c - 0x20];

    int size_int = (int)size;
    float size_frac = size - size_int;

    for (uint8_t col = 0; col < 5; col++) {
        uint8_t col_data = font_data[col];
        for (uint8_t row = 0; row < 7; row++) {
            if (col_data & (1 << row)) {
                int base_x = x + (int)(col * size);
                int base_y = y + (int)(row * size);

                for (int sy = 0; sy < size_int; sy++) {
                    for (int sx = 0; sx < size_int; sx++) {
                        tft_draw_pixel(base_x + sx, base_y + sy, color);
                    }
                }

                if (size_frac >= 0.5f) {
                    for (int sx = 0; sx < size_int; sx++) {
                        tft_draw_pixel(base_x + sx, base_y + size_int, color);
                    }
                    for (int sy = 0; sy < size_int; sy++) {
                        tft_draw_pixel(base_x + size_int, base_y + sy, color);
                    }
                    tft_draw_pixel(base_x + size_int, base_y + size_int, color);
                }
            }
        }
    }
}

void tft_print(const char *str)
{
    if (str == NULL) return;

    int16_t x = ui_state.cursor_x;
    int16_t y = ui_state.cursor_y;

    while (*str) {
        if (*str == '\n') {
            y += (int)(8 * ui_state.text_size);
            x = ui_state.cursor_x;
        } else if (*str == '\r') {
            x = ui_state.cursor_x;
        } else {
            tft_draw_char(x, y, *str, ui_state.text_color, ui_state.text_size);
            x += (int)(6 * ui_state.text_size);

            if (ui_state.text_wrap && (x + (int)(6 * ui_state.text_size)) > 128) {
                x = ui_state.cursor_x;
                y += (int)(8 * ui_state.text_size);
            }
        }
        str++;
    }

    ui_state.cursor_x = x;
    ui_state.cursor_y = y;
}

void tft_print_num(uint16_t n)
{
    char buf[16];
    snprintf(buf, sizeof(buf), "%d", n);
    tft_print(buf);
}

void tft_setFont(const GFXfont *font) { ui_state.current_gfx_font = font; }
const GFXfont *tft_getFont(void) { return ui_state.current_gfx_font; }

static uint16_t utf8_to_unicode(const char **utf8)
{
    if (utf8 == NULL || *utf8 == NULL || **utf8 == '\0') return 0;

    uint8_t c = (uint8_t)**utf8;
    if (c < 0x80) {
        (*utf8)++;
        return c;
    }

    if ((c & 0xE0) == 0xE0) {
        if ((*utf8)[1] == '\0' || (*utf8)[2] == '\0') return 0;
        uint16_t unicode = ((c & 0x0F) << 12) |
                           (((uint8_t)(*utf8)[1] & 0x3F) << 6) |
                           ((uint8_t)(*utf8)[2] & 0x3F);
        *utf8 += 3;
        return unicode;
    }

    if ((c & 0xC0) == 0xC0) {
        if ((*utf8)[1] == '\0') return 0;
        uint16_t unicode = ((c & 0x1F) << 6) | ((uint8_t)(*utf8)[1] & 0x3F);
        *utf8 += 2;
        return unicode;
    }

    (*utf8)++;
    return 0;
}

static void tft_draw_char_gfx(int16_t x, int16_t y, uint16_t unicode, uint16_t color)
{
    if (ui_state.current_gfx_font == NULL) {
        ESP_LOGW(TAG, "한글 폰트 렌더링 실패: current_gfx_font이 NULL");
        return;
    }

    const GFXfont *font = ui_state.current_gfx_font;
    if (unicode < font->first || unicode > font->last) {
        ESP_LOGW(TAG,
                 "한글 폰트 렌더링 실패: 유니코드 범위 밖 (unicode=0x%04X, first=0x%04X, last=0x%04X)",
                 unicode, font->first, font->last);
        return;
    }

    uint16_t glyph_index = 0;
    bool found = false;
    if (unicode == 0xC5EC) { glyph_index = 0; found = true; }
    else if (unicode == 0xD22C) { glyph_index = 1; found = true; }

    if (!found) {
        ESP_LOGW(TAG,
                 "한글 폰트 렌더링 실패: 글리프를 찾을 수 없음 (unicode=0x%04X, first=0x%04X, last=0x%04X)",
                 unicode, font->first, font->last);
        return;
    }

    const GFXglyph *glyph = &font->glyph[glyph_index];
    const uint8_t *bitmap = &font->bitmap[glyph->bitmapOffset];

    uint32_t total_pixels = (uint32_t)glyph->width * (uint32_t)glyph->height;
    uint32_t max_offset = glyph->bitmapOffset + total_pixels;
    const uint32_t MAX_BITMAP_SIZE = 400;
    if (max_offset > MAX_BITMAP_SIZE || glyph->bitmapOffset >= MAX_BITMAP_SIZE) {
        ESP_LOGE(TAG, "한글 폰트 렌더링 실패: 비트맵 범위 초과");
        return;
    }

    int16_t py = y + glyph->yOffset;
    if (py < 0 || py >= 160) {
        ESP_LOGE(TAG, "한글 폰트 렌더링 실패: Y 좌표 범위 초과 (y=%d, py=%d)", y, py);
        return;
    }

    uint32_t pixel_index = 0;
    for (uint8_t gy = 0; gy < glyph->height; gy++) {
        int16_t px = x + glyph->xOffset;
        if (px < -10 || px >= 138) {
            pixel_index += glyph->width;
            py++;
            continue;
        }

        for (uint8_t gx = 0; gx < glyph->width; gx++) {
            if (pixel_index >= total_pixels) {
                ESP_LOGE(TAG, "한글 폰트 렌더링 실패: 픽셀 인덱스 범위 초과");
                return;
            }
            uint8_t pixel_value = bitmap[pixel_index];
            if (pixel_value != 0x00) {
                if (px >= 0 && px < 128 && py >= 0 && py < 160) {
                    tft_draw_pixel(px, py, color);
                }
            }
            pixel_index++;
            px++;
        }
        py++;
    }

    ui_state.cursor_x = x + glyph->xAdvance;
}

void tft_print_utf8(const char *str)
{
    if (str == NULL) {
        ESP_LOGW(TAG, "tft_print_utf8: str이 NULL");
        return;
    }
    if (ui_state.current_gfx_font == NULL) {
        ESP_LOGW(TAG, "tft_print_utf8: current_gfx_font이 NULL");
        return;
    }

    int16_t x = ui_state.cursor_x;
    int16_t y = ui_state.cursor_y;

    const char *p = str;
    while (*p) {
        uint16_t unicode = utf8_to_unicode(&p);
        if (unicode == 0) continue;

        if (ui_state.current_gfx_font != NULL) {
            tft_draw_char_gfx(x, y, unicode, ui_state.text_color);
            x = ui_state.cursor_x;
        } else {
            if (unicode < 0x80) {
                tft_draw_char(x, y, (char)unicode, ui_state.text_color, ui_state.text_size);
                x += (int)(6 * ui_state.text_size);
            }
        }
    }

    ui_state.cursor_x = x;
    ui_state.cursor_y = y;
}

void tft_print_float(float n, uint8_t decimals)
{
    char buf[32];
    snprintf(buf, sizeof(buf), "%.*f", decimals, n);
    tft_print(buf);
}

// ===== Custom print helpers =====
void space(uint8_t n) {
    tft_setTextColor(ST7735_BLACK);
    for (uint8_t i = 0; i < n; i++) tft_print("0");
}
void spacex(uint8_t n) { for (uint8_t i = 0; i < n; i++) tft_print("0"); }
void space2(uint8_t n) {
    tft_setTextColor(ST7735_BLACK);
    for (uint8_t i = 0; i < n; i++) tft_print("0");
    tft_setTextColor(ST7735_YELLOW);
}
void space5(uint8_t n) {
    tft_setTextColor(ST7735_BLACK);
    for (uint8_t i = 0; i < n; i++) tft_print("0");
    tft_setTextColor(ST7735_GREEN);
}

void print_num4(uint16_t n) {
    if (n < 1000) space(1);
    if (n < 100) space(1);
    if (n < 10) space(1);
    tft_setTextColor(ST7735_BLUE);
    tft_print_num(n);
}
void print_fnum4(float n) {
    if (n < 1000) space(1);
    if (n < 100) space(1);
    if (n < 10) space(1);
    tft_setTextColor(ST7735_RED);
    char strdisp[6] = {0};
    snprintf(strdisp, sizeof(strdisp), "%.1f", n);
    tft_print(strdisp);
}
void print_num3(uint16_t n) {
    if (n < 1000) space(1);
    if (n < 100) space(1);
    if (n < 10) space(1);
    tft_setTextColor(ST7735_WHITE);
    tft_print_num(n);
}
void print_num3_2(uint16_t n) {
    if (n < 1000) space2(1);
    if (n < 100) space2(1);
    if (n < 10) space2(1);
    tft_print_num(n);
}
void print_num3_2_cyan(uint16_t n) {
    if (n < 1000) { tft_setTextColor(ST7735_BLACK); tft_print("0"); }
    if (n < 100)  { tft_setTextColor(ST7735_BLACK); tft_print("0"); }
    if (n < 10)   { tft_setTextColor(ST7735_BLACK); tft_print("0"); }
    tft_setTextColor(ST7735_CYAN);
    tft_print_num(n);
}
void print_num4x(uint16_t n) { if (n < 1000) spacex(1); if (n < 100) spacex(1); if (n < 10) spacex(1); tft_print_num(n); }
void print_fnum4x(float n) { if (n < 1000) spacex(1); if (n < 100) spacex(1); if (n < 10) spacex(1); tft_print_num((uint16_t)n); }
void print_num5x_2(uint16_t n) { if (n < 1000) space5(1); if (n < 100) space5(1); if (n < 10) space5(1); tft_print_num(n); }
void print_num5x(uint16_t n) { if (n < 1000) spacex(1); if (n < 100) spacex(1); if (n < 10) spacex(1); tft_print_num(n); }
void print_num3x(uint16_t n) { if (n < 1000) spacex(1); if (n < 100) spacex(1); if (n < 10) spacex(1); tft_print_num(n); }
void print_fnum3x(float n) { if (n < 100) spacex(1); if (n < 10) spacex(1); tft_print_float(n, 1); }

// ===== Public API: Data/Status =====

void tft_set_connection_status(int status)
{
    if (!tft_ui_input_lock()) {
        return;
    }
    int prev_status = ui_input.connection_status;
    ui_input.connection_status = status;
    if (status <= 0) {
        ui_input.signal_strength = 0;
    } else {
        ui_input.signal_strength = 4;
    }
    bool changed = (prev_status != status);
    tft_ui_input_unlock();
    /* 스티어링 반복 시 RENDER 폭주 방지: 값이 바뀐 경우에만 큐 적재 */
    if (changed) {
        tft_ui_enqueue(TFT_UI_MSG_RENDER);
    }
}

void tft_set_signal_strength(uint8_t level)
{
    if (level > 4) level = 4;
    if (!tft_ui_input_lock()) {
        return;
    }
    ui_input.signal_strength = level;
    tft_ui_input_unlock();
    tft_ui_enqueue(TFT_UI_MSG_RENDER);
}

#if SHOW_SHORT_ADDRESS
void tft_set_short_address_ed(uint16_t my_addr, uint16_t parent_addr, uint16_t pan_id)
{
    char buf[16];
    /* 주소는 폰트 1로 표시 (메인 UI 1.5와 구분) */
    tft_setTextSize(1);
    tft_setTextColor(ST7735_CYAN);

    tft_fill_rect_fast(ADDR_SHORT_X, ADDR_P_Y, ADDR_LINE_W, ADDR_LINE_H, ST7735_BLACK);
    snprintf(buf, sizeof(buf), "%04X %04X", pan_id, parent_addr);
    tft_setCursor(ADDR_SHORT_X, ADDR_P_Y);
    tft_setTextSize(1);
    tft_print(buf);

    tft_fill_rect_fast(ADDR_SHORT_X, ADDR_MY_Y, ADDR_LINE_W, ADDR_LINE_H, ST7735_BLACK);
    snprintf(buf, sizeof(buf), "My: %04X", my_addr);
    tft_setCursor(ADDR_SHORT_X, ADDR_MY_Y);
    tft_setTextSize(1);
    tft_print(buf);

    /* 기본 텍스트 사이즈 복원 (메인 UI용) */
    tft_setTextSizeFloat(1.5f);
}
#endif

void tft_set_display_data(const tft_display_data_t *data)
{
    if (!tft_ui_input_lock()) {
        return;
    }
    if (data != NULL) {
        ui_input.display_data = *data;
        ui_input.display_data_valid = true;
    } else {
        ui_input.display_data_valid = false;
    }
    tft_ui_input_unlock();
    tft_ui_enqueue(TFT_UI_MSG_RENDER);
}

// ===== 화면 구성 =====

static void tft_display_main_render(const tft_ui_input_t *in)
{
    //tft_fillScreen(ST7735_RED);
    /* 텍스트 사이즈 명시적 설정 (다른 경로에서 1로 바뀌어도 항상 일정하게 유지) */
    tft_setTextSizeFloat(1.5f);

    // ui_state.max_ml = 1000;
    // if (ui_state.max_ml == 0) ui_state.max_ml = 1;

    // tft_setCursor(INJ_LABEL_X, INJ_LABEL_Y);
    // tft_setTextSizeFloat(1.5f);
    // tft_setTextColor(ST7735_YELLOW);
    // //tft_print("ml");
    // tft_print("cc/hr");

    // tft_setCursor(CC_LABEL_X, CC_LABEL_Y);
    // tft_setTextSizeFloat(1.5f);
    // tft_setTextColor(ST7735_YELLOW);
    // tft_print("cc/hr");




    /*0427 gtt 삭제*/
    // tft_setCursor(GTT_LABEL_X, GTT_LABEL_Y);
    // tft_setTextSizeFloat(1.5f);
    // tft_setTextColor(ST773Gtt5_YELLOW);
    // tft_print("Gtt");

    //ui_state.rest_ml = (float)ui_state.max_ml;


    if (in->display_data_valid) {
        const tft_display_data_t *data = &in->display_data;


        // 투여량 사용
        // float init_injected = data->injected_amount;
        // tft_setCursor(INJ_VALUE_X, INJ_VALUE_Y);
        // tft_setTextSizeFloat(1.5f);
        // uint16_t injected_int = (uint16_t)(init_injected + 0.5f);
        // if (injected_int >= 1000) print_num4(injected_int);
        // else print_num3_2_cyan(injected_int);
        // ui_state.injected_ml = init_injected;
        // //ui_state.injected_ml = data->gtt;

        // // 처방 cc/hr 표시 ----0612----
        // float init_ordered = data->ordered_cchr;
        // tft_setCursor(INJ_VALUE_X, INJ_VALUE_Y);
        // tft_setTextSizeFloat(1.5f);
        // tft_setTextColor(ST7735_CYAN);
        
        // char buf_main[16];
        // // snprintf(buf_main, sizeof(buf_main), "%d", (int)init_ordered);
        // // tft_print(buf_main);
        // print_num3_2_cyan((uint16_t)init_ordered);

        // ui_state 캐시에도 저장
        //ui_state.gtt = (int)init_ordered;

        /*0427 gtt 삭제*/
        // int init_gtt = (int)(data->gtt + 0.5f);
        // tft_setCursor(GTT_VALUE_X, GTT_VALUE_Y);
        // tft_setTextSizeFloat(1.5f);
        // tft_setTextColor(ST7735_GREEN);
        // print_num5x_2(init_gtt);
        // ui_state.gtt = init_gtt;

        // uint16_t init_mlph = (uint16_t)data->ml_per_hour;
        // tft_setCursor(CC_VALUE_X, CC_VALUE_Y);
        // tft_setTextSizeFloat(1.5f);
        // tft_setTextColor(ST7735_GREEN);

        // print_num3_2(init_mlph);
        // ui_state.mlph = init_mlph;


// =======================================================
         tft_fill_rect_fast(0, 30, 128, 100, ST7735_BLACK);

        // 1. 초기 화면 - 중간: 처방 속도 (흰색 1.5배, "60 cc/hr")
        float init_ordered = data->ordered_cchr;
        tft_setCursor(30, 50);
        tft_setTextSizeFloat(1.5f);
        tft_setTextColor(ST7735_WHITE);
        char buf_cchr[20];
        snprintf(buf_cchr, sizeof(buf_cchr), "%d cc/hr", (int)init_ordered);
        tft_print(buf_cchr);
        ui_state.gtt = (int)init_ordered; // 중복 렌더링 방지용 캐시

        // 2. 초기 화면 - 아래: 현재 속도 (파란색 3.0배, "63")
      uint16_t init_mlph = (uint16_t)data->ml_per_hour;
        
        char buf_mlph[10];
        snprintf(buf_mlph, sizeof(buf_mlph), "%d", (int)init_mlph);
        
        // 가운데 정렬 좌표 계산
        int start_x_mlph = 64 - (strlen(buf_mlph) * 9);
        
        tft_setCursor(start_x_mlph, 80);
        tft_setTextSizeFloat(3.0f);
        tft_setTextColor(ST7735_CYAN);
        tft_print(buf_mlph);
        
        ui_state.mlph = init_mlph; // 중복 렌더링 방지용 캐시

        // =======================================================

        if (data->r_volume_max > 0.0f) {
            ui_state.max_ml = (uint16_t)data->r_volume_max;
            ui_state.rest_ml = data->r_volume_now;
        } else {
            ui_state.max_ml = 0;
            ui_state.rest_ml = 0.0f;
        }
    }

    tft_draw_signal_icon(in->signal_strength,
                         in->connection_status > 0,
                         in->connection_status <= 0);
    ui_state.connection_status_old = in->connection_status;
    ui_state.signal_strength_old = in->signal_strength;

    if (in->display_data_valid) {
        const tft_display_data_t *data = &in->display_data;
        int bat_step = data->battery_level / 5;
        if (bat_step > 20) bat_step = 20;
        if (bat_step < 0) bat_step = 0;
        tft_draw_battery_icon(bat_step);
    }
}

void display_main(void)
{
    if (tft_ui_task_handle == NULL || xTaskGetCurrentTaskHandle() == tft_ui_task_handle) {
        tft_ui_input_t in;
        if (!tft_ui_input_lock()) {
            return;
        }
        in = ui_input;
        tft_ui_input_unlock();
        tft_display_main_render(&in);
        return;
    }

    tft_ui_enqueue(TFT_UI_MSG_DISPLAY_MAIN);
}

static void tft_print_data_render(const tft_ui_input_t *in)
{
    if (tft_is_sleeping) return;

    if (!in->display_data_valid) {
        /* 네트워크 스티어링 반복 등으로 RENDER만 쌓일 때 흰색 화면 방지: 검정으로 채운 뒤 return */
        tft_fillScreen(ST7735_BLACK);
        ESP_LOGW(TAG, "%s", "표시 데이터가 설정되지 않음");
        return;
    }

    /* 텍스트 사이즈 명시적 설정 (다른 경로에서 1로 바뀌어도 항상 일정하게 유지) */
    tft_setTextSizeFloat(1.5f);

    const tft_display_data_t *data = &in->display_data;

    // 1) 프레임 계산
    tft_frame_t f = {0};
    f.bat_percent = (uint32_t)data->battery_level;
    f.mlph = (uint16_t)data->ml_per_hour;
    f.gtt = (int)(data->gtt + 0.5f);
    f.injected_ml = data->injected_amount;
    f.animating = (in->connection_status <= 0);
    f.ordered_cchh = (float)data->ordered_cchr;  // ui 화면을 그리기 위해 박스에서 꺼내는 곳

    //ESP_LOGE("TFT_FRAME", "UI 렌더링 프레임 변수 확인 -> f.ordered_cchh = %.2f", f.ordered_cchh);

    f.was_force_refresh = force_refresh_after_sleep;
    if (force_refresh_after_sleep) {
        force_refresh_after_sleep = false;
    }

    tft_frame_calc_time_strings(&f, data);

    // 2) 변경 감지
    static bool first_call = true;
    f.need_redraw_icon = f.animating ||
                         (in->signal_strength != ui_state.signal_strength_old) ||
                         (in->connection_status != ui_state.connection_status_old);

    f.has_changes = f.was_force_refresh || first_call;
    if (ui_state.bat_percent != f.bat_percent ||
        ui_state.mlph != f.mlph ||
        ui_state.gtt != f.gtt ||
        ui_state.injected_ml != f.injected_ml) {
        f.has_changes = true;
    }

    if (!f.has_changes && !f.need_redraw_icon) {
        return;
    }

    // 3) 렌더 (섹션별)
    tft_render_signal_icon(&f, in);
    tft_update_background_time_strings(&f);
    tft_render_battery_icon(&f, first_call);
    // tft_render_injected_amount(&f, first_call);  투여속도 표시로 인해 주석처리
    //tft_render_gtt(&f, first_call);
    tft_render_mlph(&f, first_call);
    //tft_render_labels_after_wakeup(&f);

    // cchr 그리기 함수 호출 0612 추가
    tft_render_ordered_cchh(&f, first_call);

    ui_state.rest_ml = data->r_volume_now;
    if (first_call) first_call = false;
}

void print_data(void)
{
    if (tft_ui_task_handle == NULL || xTaskGetCurrentTaskHandle() == tft_ui_task_handle) {
        tft_ui_input_t in;
        if (!tft_ui_input_lock()) {
            return;
        }
        in = ui_input;
        tft_ui_input_unlock();
        tft_print_data_render(&in);
        return;
    }

    tft_ui_enqueue(TFT_UI_MSG_RENDER);
}

static void tft_ui_task(void *arg)
{
    (void)arg;

    /* 진단: UI 태스크 hearbeat (10초마다) — 태스크 자체가 살아있는지 확인용 */
    uint32_t hb_count = 0;
    int64_t last_hb_us = 0;

    for (;;) {
        uint8_t msg = 0;
        if (xQueueReceive(ui_cmd_queue, &msg, pdMS_TO_TICKS(100)) != pdTRUE) {
            int64_t now = esp_timer_get_time();
            if (now - last_hb_us >= 10 * 1000000LL) {
                ESP_LOGW(TAG, "ui_task heartbeat: idle wait #%lu (queue %u/%d, sleeping=%d)",
                         (unsigned long)++hb_count,
                         (unsigned)uxQueueMessagesWaiting(ui_cmd_queue),
                         TFT_UI_QUEUE_LEN,
                         tft_is_sleeping ? 1 : 0);
                last_hb_us = now;
            }
            continue;
        }

        /* 진단: 어떤 메시지를 처리하는지 항상 로그 (POWER 명령은 빈도 낮음, RENDER만 좀 시끄러울 수 있어 sleeping이면 출력) */
        if (msg >= 0x10 || tft_is_sleeping) {
            ESP_LOGW(TAG, "ui_task RX: msg=0x%02x (queue_after=%u, sleeping=%d)",
                     msg,
                     (unsigned)uxQueueMessagesWaiting(ui_cmd_queue),
                     tft_is_sleeping ? 1 : 0);
        }

        // 입력 스냅샷을 한 번 복사한 뒤, 렌더는 락 없이 수행
        tft_ui_input_t in;
        if (!tft_ui_input_lock()) {
            ESP_LOGW(TAG, "ui_task: input_lock 실패, msg=0x%02x 스킵", msg);
            continue;  /* 락 실패 시 이번 메시지는 스킵 (다음 주기에서 재시도) */
        }
        in = ui_input;
        tft_ui_input_unlock();

        switch (msg) {
        case TFT_UI_MSG_DISPLAY_MAIN:
            tft_display_main_render(&in);
            break;
        case TFT_UI_MSG_RENDER:
            tft_print_data_render(&in);
            break;
        case TFT_UI_MSG_POWER_LCD_ON:
        case TFT_UI_MSG_POWER_LCD_OFF:
        case TFT_UI_MSG_POWER_DISPLAY_ON:
        case TFT_UI_MSG_POWER_DISPLAY_OFF:
        case TFT_UI_MSG_POWER_ENTER_SLEEP:
        case TFT_UI_MSG_POWER_BACKLIGHT_TURN_ON:
            tft_power_do_cmd(msg);
            ESP_LOGW(TAG, "ui_task POWER cmd 0x%02x 처리 완료", msg);
            break;
        default:
            break;
        }
    }
}

TaskHandle_t tft_ui_get_task_handle(void)
{
    return tft_ui_task_handle;
}

void tft_ui_task_start(void)
{
    static bool started = false;
    if (started) {
        return;
    }
    
    if (ui_input_mutex == NULL) {
        ui_input_mutex = xSemaphoreCreateMutex();
        if (ui_input_mutex == NULL) {
            ESP_LOGE(TAG, "%s", "UI 입력 뮤텍스 생성 실패");
            return;
        }
    }

    if (ui_cmd_queue == NULL) {
        ui_cmd_queue = xQueueCreate(TFT_UI_QUEUE_LEN, sizeof(TFT_UI_QUEUE_ITEM));
        if (ui_cmd_queue == NULL) {
            ESP_LOGE(TAG, "%s", "UI 명령 큐 생성 실패");
            return;
        }
    }

    BaseType_t ok = xTaskCreate(tft_ui_task, "tft_ui", 4096, NULL, 3, &tft_ui_task_handle);
    if (ok != pdPASS) {
        ESP_LOGE(TAG, "%s", "TFT UI 태스크 생성 실패");
        tft_ui_task_handle = NULL;
        return;
    }

    started = true;
}

