package kr.roopre.iringer_app.data.remote.dto

data class PatientBedAssignment(
    val id: Int,
    val bed_id: Int,
    val device_id: Int?,
    val patient_id: Int?,
    val alert_type: String?,
    val alert_category: String?,
    val status: String = "pending",
    val is_active: Boolean = true,
    val infusion_type: String?,
    val infusion_total_volume: Int?,
    val infusion_gtt: Double?,
    val infusion_cchr: Double?,
    val assigned_at: String?,
    val released_at: String?,
    val started_at: String?,
    val stopped_at: String?,
    val created_at: String?,
    val updated_at: String?,
    // Joined fields
    val bed_number: String? = null,
    val room_number: String? = null,
    val room_name: String? = null,
    val ward_name: String? = null,
    val hospital_name: String? = null,
    val device_name: String? = null,
    val serial_number: String? = null,
    val battery_percent: Int? = null,
    val chart_number: String? = null,
    val patient_name: String? = null,
    val sex: String? = null,
    val age: Int? = null
)

data class PatientBedAssignmentListResponse(
    val data: List<PatientBedAssignment>,
    val pagination: Pagination
)
