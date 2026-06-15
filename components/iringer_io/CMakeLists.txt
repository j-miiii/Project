idf_component_register(
    SRCS
        "iringer_battery.c"
        "iringer_buzzer.c"
        "iringer_led.c"
        "iringer_capacitor_sensor.c"
    INCLUDE_DIRS
        "include"
    REQUIRES
        esp_timer
        driver
        freertos
        esp_adc
        iringer_contracts
        iringer_lp_core
)

