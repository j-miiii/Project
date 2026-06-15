idf_component_register(
    SRCS
        "iringer_tft_panel.c"
        "iringer_tft_power.c"
        "iringer_tft_ui.c"
    INCLUDE_DIRS
        "include"
    PRIV_INCLUDE_DIRS
        "private_include"
    REQUIRES
        driver
        esp_timer
        freertos
        iringer_contracts
)

