idf_component_register(
    SRCS
        "iringer_zigbee.c"
    INCLUDE_DIRS
        "include"
    REQUIRES
        iringer_contracts
        espressif__esp-zigbee-lib
)

