package kr.roopre.iringer_app.data.remote.dto

data class MonitoringDataResponse(
    val data: List<MonitoringWardData>
)

data class MonitoringWardData(
    val ward_id: Int,
    val ward_name: String,
    val rooms: List<MonitoringRoomData>
)

data class MonitoringRoomData(
    val room_id: Int,
    val room_number: String,
    val nurse: MonitoringNurseData?,
    val beds: List<MonitoringBedData>
)

data class MonitoringNurseData(
    val id: Int,
    val name: String?,
    val nickname: String?
)

data class MonitoringBedData(
    val bed_id: Int,
    val bed_number: String,
    val bed_status: String?,
    val patient_info: MonitoringPatientInfo?,
    val assignments: List<MonitoringAssignment>
)

data class MonitoringPatientInfo(
    val id: Int,
    val name: String,
    val chart_number: String?,
    val gender: String?,
    val age: Int?
)

data class MonitoringAssignment(
    val id: Int,
    val infusion_type: String?,
    val infusion_total_volume: Int?,
    val infusion_current_volume: Int?,
    val infusion_percentage: Double?,
    val infusion_gtt: Double?,
    val infusion_cchr: Double?,
    val measured_cchr: Double?,
    val alert_type: String?,
    val alert_category: String?,
    val status: String,
    val device_id: Int?,
    val device_name: String?,
    val battery_percent: Int?,
    val started_at: String?,
    val stopped_at: String?
)
