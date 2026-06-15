/*
 * TFT Display - Power/Policy 영역
 * - 백라이트 GPIO 제어, LCD sleep/wakeup 시퀀스, 활동 시간/타이머
 */
#include <stdint.h>
#include "iringer_tft.h"
#include "iringer_tft_internal.h"

#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "driver/gpio.h"

#include "esp_rom_gpio.h"
#include "soc/spi_periph.h"

#include "iringer_lcd_sleep.h"
#include "iringer_diag.h"          /* TFT_USE_WARM_REINIT */
#include "iringer_alive_marker.h"

#if LCD_SLEEP_WAKE_STRESS_TEST
#include "esp_system.h"   /* esp_reset_reason, esp_restart */
#include "esp_attr.h"     /* RTC_NOINIT_ATTR */
#endif

static const char *TAG = "TFT";

// 백라이트 상세 디버그(printf) 출력
// - 기본값 0: ESP_LOG*만 사용 (권장)
// - 1로 바꾸면 GPIO 레벨/흐름을 printf로도 출력
#ifndef TFT_BACKLIGHT_VERBOSE
#define TFT_BACKLIGHT_VERBOSE 0
#endif

// 자동 백라이트 제어 (저전력 최적화)
#if LCD_SLEEP_WAKE_STRESS_TEST
#define BACKLIGHT_ON_DURATION_MS 10000  // 스트레스 테스트: 10초
#else
#define BACKLIGHT_ON_DURATION_MS 300000 // Phase 2: 5분
#endif

// wake 후 백라이트 ON 전 대기 (ms) — 화면 재구성 완료 보장용, 0이면 즉시 ON
#define WAKE_BACKLIGHT_DELAY_MS  100

/* uint64_t: esp_timer_get_time()/1000 ms는 49일 후 uint32_t overflow */
static uint64_t last_activity_time = 0;
static uint64_t backlight_on_time_us = 0;
bool backlight_condition_on = false;
static bool backlight_auto_control_enabled = true;

// 슬립 상태(다른 파일에서 참조)
bool tft_is_sleeping = false;
bool force_refresh_after_sleep = false;

// Phase 2: LCD 5분 타이머
static esp_timer_handle_t lcd_sleep_timer_handle = NULL;

// LCD OFF 완료 알림 (메인에서 tft_lcd_off_and_wait 시 대기용)
static SemaphoreHandle_t lcd_off_done_sem = NULL;

void tft_update_activity_time(void)
{
    last_activity_time = esp_timer_get_time() / 1000;  /* ms, uint64_t (49일 overflow 방지) */
}

uint32_t tft_get_inactive_time(void)
{
    uint64_t current_time_ms = esp_timer_get_time() / 1000;
    if (current_time_ms >= last_activity_time) {
        uint64_t diff = current_time_ms - last_activity_time;
        return (diff > UINT32_MAX) ? UINT32_MAX : (uint32_t)diff;
    }
    return 0;
}

/* ── 스트레스 테스트 전용: LCD OFF 후 2초 뒤 자동 LCD ON ── */
#if LCD_SLEEP_WAKE_STRESS_TEST
#define STRESS_TEST_WAKE_DELAY_MS  2000
#define STRESS_TEST_REBOOT_EVERY   0    /* N사이클마다 리부팅 (힙 파편화 방지) */

/* 누적 카운터 — 소프트 리부팅에도 유지, 전원 OFF 시에만 리셋 */
static RTC_NOINIT_ATTR uint32_t s_stress_total_cycles;
static int s_stress_session_cycles = 0;

static void stress_test_init_counter(void)
{
    if (esp_reset_reason() == ESP_RST_POWERON) {
        s_stress_total_cycles = 0;
    }
    ESP_LOGW(TAG, "STRESS TEST 시작: 누적 %lu 사이클, 매 %d 사이클마다 자동 리부팅",
             (unsigned long)s_stress_total_cycles, STRESS_TEST_REBOOT_EVERY);
}

static esp_timer_handle_t stress_wake_timer = NULL;

static void stress_wake_timer_callback(void *arg)
{
    (void)arg;

    s_stress_total_cycles++;
    s_stress_session_cycles++;

    /* 힙 파편화 방지: N사이클마다 소프트 리부팅 (0이면 비활성화) */
    if (STRESS_TEST_REBOOT_EVERY > 0 && (s_stress_session_cycles >= STRESS_TEST_REBOOT_EVERY)) {
        ESP_LOGW(TAG, "STRESS TEST: 세션 %lu 사이클 도달 (누적 %lu) → 힙 정리 리부팅",
                 (unsigned long)s_stress_session_cycles,
                 (unsigned long)s_stress_total_cycles);
        esp_restart();
        return;  /* 도달 안 하지만 방어적 */
    }

    ESP_LOGW(TAG, "STRESS TEST: LCD ON 시작 [세션 %lu / 누적 %lu] (힙 free=%lu, tft_is_sleeping=%d)",
             (unsigned long)s_stress_session_cycles,
             (unsigned long)s_stress_total_cycles,
             (unsigned long)esp_get_free_heap_size(),
             tft_is_sleeping ? 1 : 0);

    /* TFT UI 태스크가 suspend 상태일 수 있으므로 먼저 resume */
    TaskHandle_t ui = tft_ui_get_task_handle();
    if (ui) {
        eTaskState st = eTaskGetState(ui);
        ESP_LOGW(TAG, "stress wake: ui_task state before resume = %d (0=run,1=ready,2=block,3=susp,4=del)", (int)st);
        vTaskResume(ui);
    } else {
        ESP_LOGW(TAG, "stress wake: ui_task handle == NULL!");
    }

    ESP_LOGW(TAG, "stress wake: tft_lcd_on() 호출 직전");
    tft_lcd_on();
    ESP_LOGW(TAG, "stress wake: tft_lcd_on() 호출 직후 (esp_timer task에서 리턴)");
}

static void stress_test_schedule_wake(void)
{
    if (stress_wake_timer == NULL) {
        const esp_timer_create_args_t args = {
            .callback = &stress_wake_timer_callback,
            .name = "stress_wake",
        };
        esp_timer_create(&args, &stress_wake_timer);
    }
    esp_timer_stop(stress_wake_timer);
    esp_timer_start_once(stress_wake_timer, (uint64_t)STRESS_TEST_WAKE_DELAY_MS * 1000ULL);
}
#endif /* LCD_SLEEP_WAKE_STRESS_TEST */

static void lcd_sleep_timer_callback(void *arg)
{
    (void)arg;

    uint64_t boot_elapsed_ms = esp_timer_get_time() / 1000;

#if LCD_SLEEP_WAKE_STRESS_TEST
    ESP_LOGW(TAG, "STRESS TEST: LCD OFF 강제 진입 (부팅 후 %llu ms, tft_is_sleeping=%d)",
             (unsigned long long)boot_elapsed_ms,
             tft_is_sleeping ? 1 : 0);
    ESP_LOGW(TAG, "lcd_sleep_timer_cb: tft_lcd_off() 호출 직전");
    tft_lcd_off();
    ESP_LOGW(TAG, "lcd_sleep_timer_cb: tft_lcd_off() 호출 직후 → %d ms 후 자동 LCD ON 예약",
             STRESS_TEST_WAKE_DELAY_MS);
    stress_test_schedule_wake();
    return;  /* 스트레스 테스트에서는 아래 일반 로직 실행 안 함 */
#endif

    /* 알람/대기 활성 중이면 LCD OFF 생략 (방어적 체크 — do_activate에서 타이머 중지하지만 레이스 방어) */
    if (iringer_is_alarm_active()) {
        ESP_LOGI(TAG, "Phase 2: 알람/대기 활성 — LCD OFF 생략 (부팅 후 %llu ms)",
                 (unsigned long long)boot_elapsed_ms);
        return;
    }

    bool in_delay_period = iringer_is_lcd_sleep_delay_period();
    if (in_delay_period) {
        ESP_LOGW(TAG,
                 "Phase 2: LCD_SLEEP_DELAY 구간 - LCD OFF 생략 (부팅 후 %llu ms, 5분 타이머는 무시)",
                 (unsigned long long)boot_elapsed_ms);
        return;
    }
    ESP_LOGI(TAG, "Phase 2: 5분 경과 - LCD Sleep 진입 (부팅 후 %llu ms)",
             (unsigned long long)boot_elapsed_ms);
    tft_lcd_off();
    ESP_LOGI(TAG, "Phase 2: LCD Sleep 완료 (5분 경과)");
}

static void lcd_sleep_timer_init(void)
{
    if (lcd_sleep_timer_handle != NULL) {
        return;
    }

    const esp_timer_create_args_t timer_args = {
        .callback = &lcd_sleep_timer_callback,
        .name = "lcd_sleep_timer",
    };

    esp_err_t ret;
    int retry = 0;
    do {
        ret = esp_timer_create(&timer_args, &lcd_sleep_timer_handle);
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "LCD 5분 타이머 생성 실패 (재시도 %d): %s", retry + 1, esp_err_to_name(ret));
            vTaskDelay(pdMS_TO_TICKS(200));
            retry++;
        }
    } while (ret != ESP_OK);

    ESP_LOGI(TAG, "Phase 2: LCD 5분 타이머 초기화 완료");
}

// 백라이트 GPIO 초기화 (PWM 사용 안 함)
esp_err_t tft_backlight_init(void)
{
    gpio_config_t backlight_conf = {
        .intr_type = GPIO_INTR_DISABLE,
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = (1ULL << TFT_BACKLIGHT_PIN),
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
    };
    esp_err_t ret = gpio_config(&backlight_conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "%s %s", "백라이트 GPIO 설정 실패:", esp_err_to_name(ret));
        return ret;
    }

    gpio_set_level(TFT_BACKLIGHT_PIN, 1);
    ESP_LOGI(TAG, "%s", "백라이트 GPIO 초기화 완료 (PWM 사용 안 함)");
    return ESP_OK;
}

void tft_set_backlight_duty(uint8_t duty)
{
    if (TFT_BACKLIGHT_VERBOSE) {
        printf("[TFT] tft_set_backlight_duty 진입: duty=%d\n", duty);
        fflush(stdout);
    }
    ESP_LOGI(TAG, "tft_set_backlight_duty 호출: duty=%d", duty);

    if (duty == 0) {
        if (TFT_BACKLIGHT_VERBOSE) {
            printf("[TFT] 백라이트 끄기 시작\n");
            fflush(stdout);
        }
        ESP_LOGI(TAG, "백라이트 끄기 시작");

        /* gpio_reset_pin 제거: 플로팅 구간에서 백라이트 순간 점등 방지 */
        gpio_set_direction(TFT_BACKLIGHT_PIN, GPIO_MODE_OUTPUT);
        gpio_set_pull_mode(TFT_BACKLIGHT_PIN, GPIO_PULLDOWN_ONLY);
        gpio_set_level(TFT_BACKLIGHT_PIN, 0);

        int gpio_level = gpio_get_level(TFT_BACKLIGHT_PIN);
        if (TFT_BACKLIGHT_VERBOSE) {
            printf("[TFT] GPIO 레벨 확인: %d\n", gpio_level);
            fflush(stdout);
        }
        ESP_LOGI(TAG, "백라이트 완전히 끄기 완료 (GPIO18 LOW 설정, 확인 레벨=%d)",
                 gpio_level);

        if (gpio_level != 0) {
            if (TFT_BACKLIGHT_VERBOSE) {
                printf("[TFT] 경고: GPIO18이 LOW가 아닙니다! 레벨=%d\n", gpio_level);
                fflush(stdout);
            }
            ESP_LOGW(TAG, "경고: GPIO18이 LOW가 아닙니다! 레벨=%d", gpio_level);
        }

        gpio_hold_en(TFT_BACKLIGHT_PIN);
        ESP_LOGI(TAG, "GPIO18 Hold 활성화 (Sleep 상태 유지)");
    } else {
        ESP_LOGI(TAG, "백라이트 켜기 시작");

        /* reset_pin 제거: 웨이크 시 플로팅으로 잠깐 켜지며 흰 화면 번쩍임 유발 가능 */
        gpio_hold_dis(TFT_BACKLIGHT_PIN);
        gpio_set_direction(TFT_BACKLIGHT_PIN, GPIO_MODE_OUTPUT);
        gpio_set_pull_mode(TFT_BACKLIGHT_PIN, GPIO_FLOATING);
        gpio_set_level(TFT_BACKLIGHT_PIN, 1);

        int gpio_level = gpio_get_level(TFT_BACKLIGHT_PIN);
        ESP_LOGI(TAG, "백라이트 켜기 완료 (GPIO18 HIGH 설정, 확인 레벨=%d)",
                 gpio_level);

#if LCD_SLEEP_WAKE_STRESS_TEST
        /* 스트레스 테스트: 백라이트가 켜질 때마다 10초 타이머 시작. */
        stress_test_init_counter();
        lcd_sleep_timer_init();
        if (lcd_sleep_timer_handle != NULL) {
            esp_timer_stop(lcd_sleep_timer_handle);
            esp_timer_start_once(lcd_sleep_timer_handle,
                                 (uint64_t)BACKLIGHT_ON_DURATION_MS * 1000ULL);
            ESP_LOGW(TAG, "STRESS TEST: 백라이트 ON → 슬립 타이머 %lu ms 시작",
                     (unsigned long)BACKLIGHT_ON_DURATION_MS);
        }
#endif
    }
}

void tft_backlight_assert_off_after_wake(void)
{
    /* LCD가 켜져 있으면 백라이트 끄지 않음 (스트레스 테스트/알람 등) */
    if (!tft_is_sleeping) {
        return;
    }
    /* Light Sleep 웨이크 시 hold가 자동 해제되어 백라이트가 잠깐 켜질 수 있음.
     * OUTPUT+LOW+PULLDOWN+HOLD로 완전 고정. */
    gpio_set_direction(TFT_BACKLIGHT_PIN, GPIO_MODE_OUTPUT);
    gpio_set_pull_mode(TFT_BACKLIGHT_PIN, GPIO_PULLDOWN_ONLY);
    gpio_set_level(TFT_BACKLIGHT_PIN, 0);
    gpio_hold_en(TFT_BACKLIGHT_PIN);
}

static void tft_display_off_impl(void)
{
    alive_marker_set_location(MARKER_LOC_TFT_DISPLAY_OFF_ENTER);

    if (lcd_off_done_sem != NULL) {
        xSemaphoreTake(lcd_off_done_sem, 0); /* 이전 완료 시그널 제거 */
    }
    if (tft_is_sleeping) {
        if (lcd_off_done_sem != NULL) {
            xSemaphoreGive(lcd_off_done_sem);
        }
        alive_marker_set_location(MARKER_LOC_TFT_DISPLAY_OFF_EXIT);
        return;
    }

    ESP_LOGI(TAG, "Screen OFF Sequence Started");

    tft_set_backlight_duty(TFT_BACKLIGHT_DUTY_OFF);
    vTaskDelay(pdMS_TO_TICKS(50));

    tft_write_cmd(ST7735_DSPOFF);
    vTaskDelay(pdMS_TO_TICKS(10));

    tft_write_cmd(ST7735_SLPIN);
    vTaskDelay(pdMS_TO_TICKS(120));

    tft_is_sleeping = true;

    // GPIO 확정 상태 고정 (FLOATING 금지 — 노이즈로 ST7735 오동작 방지)
    // CS=HIGH(비활성), RST=HIGH(리셋 아님), DC/MOSI/SCLK=LOW
    gpio_set_direction(TFT_CS_PIN, GPIO_MODE_OUTPUT);
    gpio_set_level(TFT_CS_PIN, 1);       // CS HIGH = ST7735 비선택
    gpio_hold_en(TFT_CS_PIN);

    gpio_set_direction(TFT_DC_PIN, GPIO_MODE_OUTPUT);
    gpio_set_level(TFT_DC_PIN, 0);
    gpio_hold_en(TFT_DC_PIN);

    gpio_set_direction(TFT_RST_PIN, GPIO_MODE_OUTPUT);
    gpio_set_level(TFT_RST_PIN, 1);      // RST HIGH = 정상 (LOW면 리셋)
    gpio_hold_en(TFT_RST_PIN);

    gpio_set_direction(TFT_MOSI_PIN, GPIO_MODE_OUTPUT);
    gpio_set_level(TFT_MOSI_PIN, 0);
    gpio_hold_en(TFT_MOSI_PIN);

    gpio_set_direction(TFT_SCLK_PIN, GPIO_MODE_OUTPUT);
    gpio_set_level(TFT_SCLK_PIN, 0);
    gpio_hold_en(TFT_SCLK_PIN);

    ESP_LOGI(TAG, "Screen OFF Sequence Completed (SPI pins held)");
    alive_marker_set_lcd_sleeping(true);
    alive_marker_set_location(MARKER_LOC_TFT_DISPLAY_OFF_EXIT);
    if (lcd_off_done_sem != NULL) {
        xSemaphoreGive(lcd_off_done_sem);
    }
}

void tft_display_off(void)
{
    tft_ui_enqueue_power_cmd_front(TFT_UI_MSG_POWER_DISPLAY_OFF);
}

void tft_display_on(void)
{
    tft_ui_enqueue_power_cmd(TFT_UI_MSG_POWER_DISPLAY_ON);
}

void tft_enter_sleep(void)
{
    tft_ui_enqueue_power_cmd_front(TFT_UI_MSG_POWER_ENTER_SLEEP);
}

bool tft_is_lcd_sleeping(void)
{
    return tft_is_sleeping;
}

void tft_lcd_off(void)
{
    tft_ui_enqueue_power_cmd_front(TFT_UI_MSG_POWER_LCD_OFF);
}

bool tft_lcd_off_and_wait(uint32_t timeout_ms)
{
    if (lcd_off_done_sem == NULL) {
        lcd_off_done_sem = xSemaphoreCreateBinary();
        if (lcd_off_done_sem == NULL) {
            ESP_LOGE(TAG, "LCD OFF 완료 세마포어 생성 실패");
            tft_lcd_off();
            return false;
        }
    }
    xSemaphoreTake(lcd_off_done_sem, 0); /* 이전 시그널 제거 */
    tft_ui_enqueue_power_cmd_front(TFT_UI_MSG_POWER_LCD_OFF);
    BaseType_t ok = xSemaphoreTake(lcd_off_done_sem, pdMS_TO_TICKS(timeout_ms));
    if (ok != pdTRUE) {
        ESP_LOGW(TAG, "LCD OFF 완료 대기 타임아웃 (%lu ms)", (unsigned long)timeout_ms);
        return false;
    }
    return true;
}

void tft_lcd_on(void)
{
    tft_ui_enqueue_power_cmd(TFT_UI_MSG_POWER_LCD_ON);
}

/* ── 아래 함수를 새로 추가 ── */
static SemaphoreHandle_t lcd_on_done_sem = NULL;

bool tft_lcd_on_and_wait(uint32_t timeout_ms)
{
    if (lcd_on_done_sem == NULL) {
        lcd_on_done_sem = xSemaphoreCreateBinary();
        if (lcd_on_done_sem == NULL) {
            ESP_LOGE(TAG, "LCD ON 완료 세마포어 생성 실패");
            tft_lcd_on();
            return false;
        }
    }
    xSemaphoreTake(lcd_on_done_sem, 0); /* 이전 시그널 제거 */
    tft_ui_enqueue_power_cmd(TFT_UI_MSG_POWER_LCD_ON);
    BaseType_t ok = xSemaphoreTake(lcd_on_done_sem, pdMS_TO_TICKS(timeout_ms));
    if (ok != pdTRUE) {
        ESP_LOGW(TAG, "LCD ON 완료 대기 타임아웃 (%lu ms)", (unsigned long)timeout_ms);
        return false;
    }
    return true;
}

void tft_lcd_sleep_timer_stop(void)
{
    if (lcd_sleep_timer_handle != NULL) {
        esp_timer_stop(lcd_sleep_timer_handle);
    }
}

// Legacy: tft_display_on에서 처리 (빈 구현 유지)
void tft_exit_sleep(void) { }

static void tft_display_on_impl(void)
{
    bool was_sleeping = tft_is_sleeping;

    alive_marker_set_location(MARKER_LOC_TFT_DISPLAY_ON_ENTER);

    if (was_sleeping) {
        /* ── 매 wake: ST7735 풀 초기화 (소장님 방침) ──
         * 백라이트 OFF 상태에서 풀 초기화 + 화면 재구성을 완료한 뒤
         * 백라이트를 켜므로, 사용자 눈에는 "꺼짐 → 완성된 화면" 전환만 보임.
         * DMA 미사용이므로 SPI teardown+reinit 무한 반복 안전. */

        ESP_LOGI(TAG, "Screen ON Sequence Started (%s)",
#if TFT_USE_WARM_REINIT
                 "warm"
#else
                 "cold"
#endif
                );

        /* 1. 모든 TFT 핀의 direction/level을 hold 해제 전에 "레지스터 수준"으로 선점.
         *    hold 중 gpio_set_direction/set_level 호출은 레지스터만 업데이트되고
         *    실제 핀은 hold로 유지되지만, 곧바로 gpio_hold_dis 호출 시
         *    레지스터 값이 즉시 핀에 반영되므로 floating 구간이 제로가 된다.
         *    특히 RST는 외부 pull-up 저항이 없어 hold_dis 직후 floating되면
         *    글리치로 ST7735에 잘못된 리셋 신호가 입력될 수 있음 (소장님 지적). */
        gpio_set_direction(TFT_CS_PIN, GPIO_MODE_OUTPUT);
        gpio_set_pull_mode(TFT_CS_PIN, GPIO_PULLUP_ONLY);
        gpio_set_level(TFT_CS_PIN, 1);

        gpio_set_direction(TFT_DC_PIN, GPIO_MODE_OUTPUT);
        gpio_set_level(TFT_DC_PIN, 0);

        gpio_set_direction(TFT_DC_PIN, GPIO_MODE_OUTPUT);
        gpio_set_level(TFT_DC_PIN, 0);

        gpio_set_direction(TFT_RST_PIN, GPIO_MODE_OUTPUT);
        gpio_set_pull_mode(TFT_RST_PIN, GPIO_PULLUP_ONLY);  /* 외부 풀업 부재 보완 — hold_dis 직후 floating으로 글리치 방지 */
        gpio_set_level(TFT_RST_PIN, 1);  /* HIGH 선점 — 리셋 안 걸린 상태 확정 */

        gpio_set_direction(TFT_MOSI_PIN, GPIO_MODE_OUTPUT);
        gpio_set_level(TFT_MOSI_PIN, 0);

        /* 2. Hold 해제 — 이 순간 위에서 세팅한 direction/level이 핀에 즉시 반영.
         *    특히 RST가 HIGH로 확정된 상태에서 해제되므로 글리치 구간 제로.
         *    BACKLIGHT는 의도적으로 제외: init 전 구간 동안 hold로 LOW에 latch 유지하여
         *    "초기화 중 하얀 반짝" 방지 (소장님 지적). 하단 BL ON 직전에만 해제. */
        gpio_hold_dis(TFT_CS_PIN);
        gpio_hold_dis(TFT_DC_PIN);
        gpio_hold_dis(TFT_RST_PIN);
        gpio_hold_dis(TFT_MOSI_PIN);
        gpio_hold_dis(TFT_SCLK_PIN);

        /* 3. ST7735 재초기화 — TFT_USE_WARM_REINIT에 따라 분기.
         * warm: spi_bus_free 안 함, retention link 보존
         * cold: 기존 풀 reinit (사망 버그 있음) */
        esp_err_t err;
#if TFT_USE_WARM_REINIT
        err = tft_init_warm();
        if (err == ESP_ERR_INVALID_STATE) {
            ESP_LOGE(TAG, "warm reinit precondition fail — cold fallback (사망 risk 감수)");
            err = tft_init(false);
        } else if (err != ESP_OK) {
            ESP_LOGE(TAG, "tft_init_warm 실패: %s — warm 재시도", esp_err_to_name(err));
            err = tft_init_warm();
        }
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "tft_init_warm 2차 실패: %s — cold fallback", esp_err_to_name(err));
            err = tft_init(false);
        }
#else
        err = tft_init(false);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "tft_init 실패: %s — 재시도", esp_err_to_name(err));
            err = tft_init(false);
        }
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "tft_init 2차 실패: %s", esp_err_to_name(err));
        }
#endif

        /* 4. 백라이트 OFF 상태에서 화면 완성 후 DISPON */
        tft_ui_task_start();
        force_refresh_after_sleep = true;
        print_data();

        /* ── [안전망1] SPI 에러 카운터 검증 + 자동 재시도 ──
         * print_data() 까지 끝난 시점에서 카운터가 0이 아니면 init 또는
         * render 도중 명령 1개 이상이 silently 실패한 것. 자동으로
         * 재초기화 + print_data() 한 번 더 수행. */
        uint32_t err_after_render = tft_get_spi_error_count();
        if (err_after_render > 0) {
            ESP_LOGW(TAG, "[안전망1] wake init 후 SPI 에러 %lu 회 감지 → 자동 재시도",
                     (unsigned long)err_after_render);
            alive_marker_inc_safety_net_1_fires();

            esp_err_t retry_err;
#if TFT_USE_WARM_REINIT
            retry_err = tft_init_warm();
            if (retry_err == ESP_ERR_INVALID_STATE) {
                ESP_LOGE(TAG, "[안전망1] warm 재시도 precondition fail — cold fallback");
                retry_err = tft_init(false);
            }
#else
            retry_err = tft_init(false);
#endif
            if (retry_err != ESP_OK) {
                ESP_LOGE(TAG, "[안전망1] 재시도 init 실패: %s",
                         esp_err_to_name(retry_err));
            }
            force_refresh_after_sleep = true;
            print_data();

            uint32_t err_after_retry = tft_get_spi_error_count();
            if (err_after_retry > 0) {
                ESP_LOGE(TAG, "[안전망1] 재시도 후에도 SPI 에러 %lu 회 — 화면 손상 가능성",
                         (unsigned long)err_after_retry);
            } else {
                ESP_LOGW(TAG, "[안전망1] 재시도 후 SPI 에러 0 — 복구 성공");
            }
        } else {
            ESP_LOGW(TAG, "[안전망1] wake init OK (SPI 에러 0)");
        }

#if LCD_SLEEP_WAKE_STRESS_TEST
        /* ── [안전망3] 패널 헬스체크 + 자동 복구 (STRESS TEST 빌드 전용) ──
         * 12시간 × 20대 검증에서 헬스체크 호출이 SPI를 잠깐 free하는 동안
         * 다른 태스크의 tft_write_* 호출을 silently drop시키는 부작용 발견.
         * 양산엔 가드. 1단계 카운터(위)는 양산에도 유지됨. */
        tft_health_report_t hr;
        esp_err_t hc = tft_check_panel_health(&hr);
        ESP_LOGW(TAG,
                 "[안전망3] 헬스체크: %s | RDDID=%02X%02X%02X (ok=%d invalid=%d) | RDDST=0x%08lX (ok=%d)",
                 (hc == ESP_OK) ? "OK" : "FAIL",
                 hr.id[0], hr.id[1], hr.id[2],
                 hr.rddid_ok ? 1 : 0, hr.id_invalid ? 1 : 0,
                 (unsigned long)hr.status, hr.rddst_ok ? 1 : 0);

        if (hc != ESP_OK) {
            ESP_LOGW(TAG, "[안전망3] 헬스체크 FAIL → 풀초기화 1회 추가 시도");
            esp_err_t ri = tft_init(false);
            if (ri != ESP_OK) {
                ESP_LOGE(TAG, "[안전망3] 복구 init 실패: %s", esp_err_to_name(ri));
            } else {
                force_refresh_after_sleep = true;
                print_data();

                tft_health_report_t hr2;
                esp_err_t hc2 = tft_check_panel_health(&hr2);
                ESP_LOGW(TAG,
                         "[안전망3] 복구 후 헬스체크: %s | RDDID=%02X%02X%02X | RDDST=0x%08lX",
                         (hc2 == ESP_OK) ? "OK (복구성공)" : "여전히 FAIL",
                         hr2.id[0], hr2.id[1], hr2.id[2],
                         (unsigned long)hr2.status);
            }
        }
#endif /* LCD_SLEEP_WAKE_STRESS_TEST */

        tft_display_output_on();

        /* 5. 화면 재구성 완료 후 대기 — 백라이트 ON 전 안전 마진 */
        if (WAKE_BACKLIGHT_DELAY_MS > 0) {
            vTaskDelay(pdMS_TO_TICKS(WAKE_BACKLIGHT_DELAY_MS));
        }

        ESP_LOGW(TAG, "[wake완료] Screen ON Sequence Complete (힙=%lu, SPI에러누적=%lu)",
                 (unsigned long)esp_get_free_heap_size(),
                 (unsigned long)tft_get_spi_error_count());
    }

    /* BL hold 해제 — init 완료 후 화면 그려진 상태에서만 해제. 여기까지 LOW에 latch됨. */
    gpio_hold_dis(TFT_BACKLIGHT_PIN);

    /* 백라이트 ON */
    tft_set_backlight_duty(TFT_BACKLIGHT_DUTY_DEFAULT);

    backlight_on_time_us = esp_timer_get_time();
    backlight_condition_on = true;

    tft_update_activity_time();

    /* Phase 2: 5분 타이머 시작 */
#if LCD_SLEEP_WAKE_STRESS_TEST
    /* 스트레스 테스트: LCD_SLEEP_DELAY 무시, 항상 타이머 시작 */
    lcd_sleep_timer_init();
    if (lcd_sleep_timer_handle != NULL) {
        esp_timer_stop(lcd_sleep_timer_handle);
        esp_timer_start_once(lcd_sleep_timer_handle,
                             (uint64_t)BACKLIGHT_ON_DURATION_MS * 1000ULL);
        ESP_LOGW(TAG,
                 "STRESS TEST: LCD ON → 슬립 타이머 %lu ms 시작 (부팅 후 %llu ms)",
                 (unsigned long)BACKLIGHT_ON_DURATION_MS,
                 (unsigned long long)(esp_timer_get_time() / 1000));
    }
#else
    if (iringer_is_lcd_sleep_delay_period()) {
        ESP_LOGI(TAG,
                 "LCD_SLEEP_DELAY 구간 - Phase 2 5분 타이머 미시작 (부팅 후 %llu ms)",
                 (unsigned long long)(esp_timer_get_time() / 1000));
    } else {
        lcd_sleep_timer_init();
        if (lcd_sleep_timer_handle != NULL) {
            esp_timer_stop(lcd_sleep_timer_handle);
            esp_timer_start_once(lcd_sleep_timer_handle,
                                 BACKLIGHT_ON_DURATION_MS * 1000ULL);
            ESP_LOGI(TAG,
                     "Phase 2: LCD 5분 타이머 시작 (부팅 후 %llu ms, %lu ms 후 콜백)",
                     (unsigned long long)(esp_timer_get_time() / 1000),
                     (unsigned long)BACKLIGHT_ON_DURATION_MS);
        }
    }
#endif

    ESP_LOGI(TAG, "Screen ON Sequence Completed");

    alive_marker_set_lcd_sleeping(false);
    alive_marker_set_location(MARKER_LOC_TFT_DISPLAY_ON_EXIT);

    /* tft_lcd_on_and_wait() 완료 시그널 */
    if (lcd_on_done_sem != NULL) {
        xSemaphoreGive(lcd_on_done_sem);
    }
}

void tft_power_do_cmd(uint8_t cmd)
{
    switch (cmd) {
    case TFT_UI_MSG_POWER_LCD_ON:
    case TFT_UI_MSG_POWER_BACKLIGHT_TURN_ON:
        tft_display_on_impl();
        break;
    case TFT_UI_MSG_POWER_LCD_OFF:
        tft_display_off_impl();  /* 내부에서 이미 백라이트 OFF 수행 */
        break;
    case TFT_UI_MSG_POWER_DISPLAY_ON:
        tft_display_on_impl();
        break;
    case TFT_UI_MSG_POWER_DISPLAY_OFF:
        tft_display_off_impl();
        break;
    case TFT_UI_MSG_POWER_ENTER_SLEEP:
        tft_display_off_impl();
        break;
    default:
        break;
    }
}

void tft_backlight_turn_on_condition(void)
{
    tft_ui_enqueue_power_cmd(TFT_UI_MSG_POWER_BACKLIGHT_TURN_ON);
}

void tft_backlight_check_condition_timer(void)
{
    if (!backlight_condition_on) {
        return;
    }

    uint64_t now_us = esp_timer_get_time();
    uint64_t elapsed_ms = (now_us - backlight_on_time_us) / 1000;

    if (elapsed_ms >= BACKLIGHT_ON_DURATION_MS) {
        int gpio_level = gpio_get_level(TFT_BACKLIGHT_PIN);
        if (gpio_level == 0) {
            tft_set_backlight_duty(TFT_BACKLIGHT_DUTY_DEFAULT);
            ESP_LOGI(TAG, "백라이트 30초 경과: 백라이트 켜기 (GPIO 모드)");
        }
    }
}

bool tft_get_backlight_auto_control_enabled(void)
{
    return backlight_auto_control_enabled;
}

void tft_set_backlight_auto_control_enabled(bool enable)
{
    backlight_auto_control_enabled = enable;
}

