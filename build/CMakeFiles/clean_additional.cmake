# Additional clean files
cmake_minimum_required(VERSION 3.16)

if("${CONFIG}" STREQUAL "" OR "${CONFIG}" STREQUAL "")
  file(REMOVE_RECURSE
  "bootloader\\bootloader.bin"
  "bootloader\\bootloader.elf"
  "bootloader\\bootloader.map"
  "config\\sdkconfig.cmake"
  "config\\sdkconfig.h"
  "esp-idf\\esptool_py\\flasher_args.json.in"
  "esp-idf\\mbedtls\\x509_crt_bundle"
  "flash_app_args"
  "flash_bootloader_args"
  "flash_project_args"
  "flasher_args.json"
  "iringer_ir_end_device_2_1.bin"
  "iringer_ir_end_device_2_1.map"
  "ldgen_libraries"
  "ldgen_libraries.in"
  "lp_core_main.bin.S"
  "project_elf_src_esp32c6.c"
  "x509_crt_bundle.S"
  )
endif()
