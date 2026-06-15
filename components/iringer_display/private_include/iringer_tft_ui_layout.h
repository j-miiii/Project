/*
 * UI 레이아웃 상수 (Display 내부 전용)
 * - 좌표/아이콘 크기/정렬 기준을 한 곳에서 관리
 */
#pragma once

#include "iringer_tft.h"

// 패널 크기/오프셋 (ST7735 128x160, 오프셋은 기존 구현 유지)
#define TFT_WIDTH_PIX 128
#define TFT_HEIGHT_PIX 160
#define TFT_X_OFFSET 2
#define TFT_X_OFFSET_ELEMENTS 9
#define TFT_Y_OFFSET 0

// UI 배치 기준점
#define UI_CENTER_X (TFT_X_OFFSET + (TFT_WIDTH_PIX / 2))
#define UI_ROW1_Y (FIRST_Y + 55)
#define UI_ROW2_Y (UI_ROW1_Y + 26)
#define UI_ROW3_Y (UI_ROW2_Y + 18)

// 신호 아이콘 위치/크기
#define SIGNAL_ICON_CX (UI_CENTER_X - 26)
#define SIGNAL_ICON_CY (UI_ROW1_Y - 20)
#define SIGNAL_ICON_W 34
#define SIGNAL_ICON_H 24

// 배터리 아이콘 위치
#define BAT_ICON_X (UI_CENTER_X)
#define BAT_ICON_Y (UI_ROW1_Y - 26)

// 투여량 위치
#define INJ_LABEL_X (UI_CENTER_X - 3)
#define INJ_LABEL_Y (UI_ROW1_Y + 2)
#define INJ_VALUE_X (UI_CENTER_X - 57)
#define INJ_VALUE_Y (UI_ROW1_Y + 2)

// CC/HR 위치
#define CC_LABEL_X (UI_CENTER_X - 3)
#define CC_LABEL_Y (UI_ROW2_Y + 2)
#define CC_VALUE_X (UI_CENTER_X - 57)
#define CC_VALUE_Y (UI_ROW2_Y + 2)

// GTT 위치
#define GTT_LABEL_X (UI_CENTER_X - 3)
#define GTT_LABEL_Y (UI_ROW3_Y + 2)
#define GTT_VALUE_X (UI_CENTER_X - 57)
#define GTT_VALUE_Y (UI_ROW3_Y + 2)

#if SHOW_SHORT_ADDRESS
#define ADDR_LINE_CHARS 9
#define ADDR_CHAR_W 6
#define ADDR_LINE_W (ADDR_LINE_CHARS * ADDR_CHAR_W)
#define ADDR_SHORT_X (UI_CENTER_X - (ADDR_LINE_W / 2) - 5)
#define ADDR_P_Y (BAT_ICON_Y - 12)
#define ADDR_MY_Y (GTT_VALUE_Y + 14)
#define ADDR_LINE_H 10
#endif

