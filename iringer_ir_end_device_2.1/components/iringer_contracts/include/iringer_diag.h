/*
 * iringer_diag.h — Round 1 진단 빌드 매크로 토글
 *
 * 이 헤더는 라운드 1 진단/실험을 위한 컴파일 타임 스위치들을 모은다.
 * 양산 빌드 시 모든 매크로를 0으로 토글하면 원래 동작으로 복귀.
 *
 * 위치: components/iringer_contracts/include/iringer_diag.h
 * (다른 파일에서 #include "iringer_diag.h")
 */
#ifndef IRINGER_DIAG_H
#define IRINGER_DIAG_H

/* ====================================================================
 * TFT_USE_WARM_REINIT
 *   1: wake 시 tft_init_warm() 사용 (SPI 버스 free/init 안 함, retention link 보존)
 *   0: wake 시 tft_init(false) 사용 (기존 cold reinit, 사망 버그 있음)
 *
 * Round 1 그룹 분배:
 *   - 그룹 A (10대): 0  (cold path 유지 + sdkconfig PM_POWER_DOWN_PERIPHERAL=n)
 *   - 그룹 B (10대): 1  (warm path 사용 + sdkconfig 변경 없음)
 *
 * 양산 채택 시: 1로 고정
 * ==================================================================== */
#ifndef TFT_USE_WARM_REINIT
#define TFT_USE_WARM_REINIT 1
#endif

/* ====================================================================
 * IRINGER_ALIVE_MARKER_ENABLE
 *   1: RTC slow memory에 alive marker 기록 + boot 시 이전 사망 마커 출력
 *   0: 모든 alive_marker_* 함수가 no-op 인라인으로 컴파일됨 (오버헤드 0)
 *
 * 양산 권장: 1 유지 (오버헤드 미미, 미래 디버깅 자산)
 * ==================================================================== */
#ifndef IRINGER_ALIVE_MARKER_ENABLE
#define IRINGER_ALIVE_MARKER_ENABLE 1
#endif

/* ====================================================================
 * IRINGER_SLEEP_ROM_TRACE
 *   1: esp_zb_sleep_now() 직전/직후에 esp_rom_printf로 stdio 우회 마커 출력
 *      (stdio lock 시나리오 배제용)
 *   0: 비활성
 *
 * 양산 권장: 0 (라운드 1 검증 후 제거)
 * ==================================================================== */
#ifndef IRINGER_SLEEP_ROM_TRACE
#define IRINGER_SLEEP_ROM_TRACE 1
#endif

#endif /* IRINGER_DIAG_H */
