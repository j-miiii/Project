package kr.roopre.iringer_app.data.remote.dto

import com.google.gson.JsonObject

data class InfusionEventLog(
    val id: Int,
    val patient_bed_assignment_id: Int,
    val event_type: String,
    val before_value: JsonObject?,
    val after_value: JsonObject?,
    val performed_by: Int?,
    val created_at: String?,
    val updated_at: String?
)

data class InfusionEventLogListResponse(
    val data: List<InfusionEventLog>,
    val pagination: Pagination
)
