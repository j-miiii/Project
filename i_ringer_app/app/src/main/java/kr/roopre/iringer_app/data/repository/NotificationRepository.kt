package kr.roopre.iringer_app.data.repository

import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.common.ApiResult
import kr.roopre.iringer_app.data.remote.api.UserApi
import kr.roopre.iringer_app.data.remote.dto.NotificationListResponse

class NotificationRepository(private val userApi: UserApi) {

    suspend fun getUnreadCount(userId: Int): ApiResult<Int> {
        return try {
            val response = userApi.getNotifications(
                page = 1,
                limit = 1,
                where = "user_id:$userId,is_read:0"
            )
            if (response.isSuccessful && response.body() != null) {
                val total = response.body()!!.pagination.total
                ApiResult.Success(total)
            } else {
                ApiResult.Error(
                    message = "알림 수를 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "알림 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun getNotifications(userId: Int, page: Int = 1): ApiResult<NotificationListResponse> {
        return try {
            val response = userApi.getNotifications(
                page = page,
                limit = 20,
                where = "user_id:$userId",
                order = "id:desc"
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "알림 목록을 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "알림 목록 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun markAsRead(notificationId: Int): ApiResult<Unit> {
        return try {
            val data = JsonObject().apply {
                addProperty("is_read", 1)
            }
            val response = userApi.updateData("notifications", notificationId, data)
            if (response.isSuccessful) {
                ApiResult.Success(Unit)
            } else {
                ApiResult.Error(
                    message = "알림 읽음 처리에 실패했습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "알림 읽음 처리 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun markAllAsRead(userId: Int): ApiResult<Unit> {
        return try {
            val data = JsonObject().apply {
                addProperty("user_id", userId)
            }
            val response = userApi.markAllNotificationsAsRead(data)
            if (response.isSuccessful) {
                ApiResult.Success(Unit)
            } else {
                ApiResult.Error(
                    message = "전체 읽음 처리에 실패했습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "전체 읽음 처리 중 오류가 발생했습니다: ${e.message}")
        }
    }
}
