package kr.roopre.iringer_app.data.remote.dto

data class DeviceResponse(
    val id: Int,
    val device_name: String,
    val serial_number: String,
    val network_status: String,
    val battery_percent: Int,
    val last_udpate_at: String,
    val firmware_version: String,
    val bed_id: Int?,
    val created_at: String,
    val updated_at: String
)

data class DeviceListResponse(
    val data: List<DeviceResponse>,
    val pagination: Pagination
)

data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int
)
