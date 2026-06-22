package kr.roopre.iringer_app.data.remote.dto

data class NotificationResponse(
    val id: Int,
    val user_id: Int?,
    val type: String?,
    val alert_category: String?,
    val title: String?,
    val message: String?,
    val is_read: Int = 0,
    val created_at: String?,
    val updated_at: String?
)

data class NotificationListResponse(
    val data: List<NotificationResponse>,
    val pagination: Pagination
)
