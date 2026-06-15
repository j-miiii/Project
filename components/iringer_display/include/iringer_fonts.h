#pragma once

#include <stdint.h>

typedef struct {
    uint16_t bitmapOffset;
    uint8_t width;
    uint8_t height;
    uint8_t xAdvance;
    int8_t xOffset;
    int8_t yOffset;
} GFXglyph;

typedef struct {
    const uint8_t *bitmap;
    const GFXglyph *glyph;
    uint16_t first;  // 유니코드 범위를 위해 uint16_t로 변경
    uint16_t last;   // 유니코드 범위를 위해 uint16_t로 변경
    uint8_t yAdvance;
} GFXfont;

extern const GFXfont FreeSerifItalic9pt7b;
extern const GFXfont FreeSerifItalic12pt7b;

// 한글 "투여" 폰트 (12pt, 맑은 고딕 볼드체)
extern const GFXfont Korean_TuYeo12pt7b;

