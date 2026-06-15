/*
 * SPDX-FileCopyrightText: 2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 *
 * LP Core 메인 루프 헤더 (LP Core에서 실행)
 */
#ifndef LP_CORE_MAIN_LP_H
#define LP_CORE_MAIN_LP_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// LP Core 메인 루프 (LP Core에서 실행)
// 주의: LP Core 스타트업 코드가 main() 심볼을 호출하므로 엔트리 이름을 main으로 사용.
void main(void);

#ifdef __cplusplus
}
#endif

#endif // LP_CORE_MAIN_LP_H
