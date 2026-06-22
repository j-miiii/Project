package kr.roopre.iringer_app.data.repository

import kr.roopre.iringer_app.data.common.ApiResult
import kr.roopre.iringer_app.data.remote.api.UserApi

class UserSettingsRepository(private val userApi: UserApi) {

    suspend fun getVolumeDisplayMode(userId: Int): ApiResult<String> {
        return try {
            val response = userApi.getList(
                tableName = "user_settings",
                page = 1,
                limit = 1,
                where = "user_id:$userId"
            )
            if (response.isSuccessful && response.body() != null) {
                val dataArray = response.body()!!.getAsJsonArray("data")
                if (dataArray != null && dataArray.size() > 0) {
                    val settings = dataArray[0].asJsonObject
                    val mode = settings.get("volume_display_mode")?.asString ?: "percentage"
                    ApiResult.Success(mode)
                } else {
                    ApiResult.Success("percentage")
                }
            } else {
                ApiResult.Error(
                    message = "사용자 설정을 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "사용자 설정 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun getInfusionOptions(): ApiResult<List<InfusionOptionDto>> {
        return try {
            val response = userApi.getList(
                tableName = "infusions",
                page = 1,
                limit = 100,
                where = "is_active:1",
                order = "display_order:asc"
            )
            if (response.isSuccessful && response.body() != null) {
                val dataArray = response.body()!!.getAsJsonArray("data")
                if (dataArray != null) {
                    val options = dataArray.map { element ->
                        val obj = element.asJsonObject
                        InfusionOptionDto(
                            id = obj.get("id")?.takeIf { !it.isJsonNull }?.asInt ?: 0,
                            code = obj.get("code")?.takeIf { !it.isJsonNull }?.asString ?: "",
                            name = obj.get("name")?.takeIf { !it.isJsonNull }?.asString ?: "",
                            defaultVolume = obj.get("default_volume")?.takeIf { !it.isJsonNull }?.asInt ?: 500,
                            defaultCchr = obj.get("default_cchr")?.takeIf { !it.isJsonNull }?.asInt ?: 200
                        )
                    }
                    ApiResult.Success(options)
                } else {
                    ApiResult.Success(emptyList())
                }
            } else {
                ApiResult.Error(
                    message = "수액 프리셋을 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 프리셋 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }
}

data class InfusionOptionDto(
    val id: Int,
    val code: String,
    val name: String,
    val defaultVolume: Int,
    val defaultCchr: Int
) {
    val label: String get() = "$name ($code)"
}
