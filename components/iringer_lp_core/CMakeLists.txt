idf_component_register(
    SRCS
        "lp_core.c"
        "lp_core_shared_memory.c"
    INCLUDE_DIRS
        "include"
        "include/lp_core"
    REQUIRES
        ulp
        esp_common
        esp_timer
        driver
        iringer_contracts
    PRIV_REQUIRES
        main
)

# LP Core 빌드 시 외부 프로젝트가 호스트 clang을 잡지 않도록
# RISCV 툴체인을 명시적으로 환경변수로 지정
file(TO_CMAKE_PATH "$ENV{IDF_TOOLS_PATH}/riscv32-esp-elf/esp-14.2.0_20241119/riscv32-esp-elf/bin" RISCV_TOOLCHAIN_BIN)
if(EXISTS ${RISCV_TOOLCHAIN_BIN})
    set(ENV{PATH} "${RISCV_TOOLCHAIN_BIN};$ENV{PATH}")
endif()
set(ENV{CC} "riscv32-esp-elf-gcc")
set(ENV{CXX} "riscv32-esp-elf-g++")

# LP Core 전용 코드 빌드 및 임베드 (ESP-IDF 예제 방식)
set(ulp_app_name lp_core_main)
set(ulp_lp_core_sources "lp_core_main_lp.c")
# exp_dep_srcs: ULP 빌드 시 심볼 해석용 (main 앱의 공유 구조체 등)
# 컴포넌트 기준 상대 경로: ../../main/iringer_ir_end_device_2.1.c
set(ulp_exp_dep_srcs "${CMAKE_CURRENT_SOURCE_DIR}/../../main/iringer_ir_end_device_2.1.c")
ulp_embed_binary(${ulp_app_name} "${ulp_lp_core_sources}" "${ulp_exp_dep_srcs}")
