# Distributed under the OSI-approved BSD 3-Clause License.  See accompanying
# file Copyright.txt or https://cmake.org/licensing for details.

cmake_minimum_required(VERSION 3.5)

# If CMAKE_DISABLE_SOURCE_CHANGES is set to true and the source directory is an
# existing directory in our source tree, calling file(MAKE_DIRECTORY) on it
# would cause a fatal error, even though it would be a no-op.
if(NOT EXISTS "C:/Espressif/frameworks/esp-idf-v5.4.2/components/ulp/cmake")
  file(MAKE_DIRECTORY "C:/Espressif/frameworks/esp-idf-v5.4.2/components/ulp/cmake")
endif()
file(MAKE_DIRECTORY
  "C:/githubrepo/iringer_song_final/iringer/iringer_ir_end_device_2.1/build/esp-idf/iringer_lp_core/lp_core_main"
  "C:/githubrepo/iringer_song_final/iringer/iringer_ir_end_device_2.1/build/esp-idf/iringer_lp_core/lp_core_main-prefix"
  "C:/githubrepo/iringer_song_final/iringer/iringer_ir_end_device_2.1/build/esp-idf/iringer_lp_core/lp_core_main-prefix/tmp"
  "C:/githubrepo/iringer_song_final/iringer/iringer_ir_end_device_2.1/build/esp-idf/iringer_lp_core/lp_core_main-prefix/src/lp_core_main-stamp"
  "C:/githubrepo/iringer_song_final/iringer/iringer_ir_end_device_2.1/build/esp-idf/iringer_lp_core/lp_core_main-prefix/src"
  "C:/githubrepo/iringer_song_final/iringer/iringer_ir_end_device_2.1/build/esp-idf/iringer_lp_core/lp_core_main-prefix/src/lp_core_main-stamp"
)

set(configSubDirs )
foreach(subDir IN LISTS configSubDirs)
    file(MAKE_DIRECTORY "C:/githubrepo/iringer_song_final/iringer/iringer_ir_end_device_2.1/build/esp-idf/iringer_lp_core/lp_core_main-prefix/src/lp_core_main-stamp/${subDir}")
endforeach()
if(cfgdir)
  file(MAKE_DIRECTORY "C:/githubrepo/iringer_song_final/iringer/iringer_ir_end_device_2.1/build/esp-idf/iringer_lp_core/lp_core_main-prefix/src/lp_core_main-stamp${cfgdir}") # cfgdir has leading slash
endif()
