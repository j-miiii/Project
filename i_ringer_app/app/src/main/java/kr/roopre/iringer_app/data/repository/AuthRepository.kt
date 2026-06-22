package kr.roopre.iringer_app.data.repository

import kr.roopre.iringer_app.data.remote.api.UserApi
import kr.roopre.iringer_app.data.remote.dto.ErrorResponse
import kr.roopre.iringer_app.data.remote.dto.LoginRequest
import kr.roopre.iringer_app.data.remote.dto.LoginResponse
import com.google.gson.Gson
import retrofit2.Response

class AuthRepository(private val userApi: UserApi) {
    suspend fun signIn(authId: String, password: String): Result<LoginResponse> {
        return try {
            val response: Response<LoginResponse> = userApi.signIn(
                LoginRequest(auth_id = authId, password = password)
            )

            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                // 에러 응답 파싱
                val errorMessage = try {
                    val errorBody = response.errorBody()?.string()
                    if (errorBody != null) {
                        val errorResponse = Gson().fromJson(errorBody, ErrorResponse::class.java)
                        errorResponse.message
                    } else {
                        "로그인 실패"
                    }
                } catch (e: Exception) {
                    "로그인 실패"
                }
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Result.failure(Exception("네트워크 오류: ${e.message}"))
        }
    }
}