package kr.roopre.iringer_app.data.remote.dto

data class NurseRoomAssignment(
    val id: Int,
    val user_id: Int,
    val room_id: Int,
    val is_active: Boolean = true,
    val assigned_at: String?,
    val released_at: String?,
    val created_at: String?,
    val updated_at: String?
)

data class NurseRoomAssignmentListResponse(
    val data: List<NurseRoomAssignment>,
    val pagination: Pagination
)
