package kr.roopre.iringer_app.data.repository

import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.common.ApiResult
import kr.roopre.iringer_app.data.remote.api.UserApi
import kr.roopre.iringer_app.data.remote.dto.PatientBedAssignment

class PatientRepository(private val userApi: UserApi) {

    suspend fun getAssignmentsByBedId(bedId: Int): ApiResult<List<PatientBedAssignment>> {
        return try {
            val response = userApi.getPatientBedAssignmentList(
                page = 1,
                limit = 50,
                where = "bed_id:$bedId"
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!.data)
            } else {
                ApiResult.Error(
                    message = "병상 정보를 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "병상 정보 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun getAssignmentById(assignmentId: Int): ApiResult<PatientBedAssignment> {
        return try {
            val response = userApi.getPatientBedAssignmentList(
                page = 1,
                limit = 1,
                where = "id:$assignmentId"
            )
            if (response.isSuccessful && response.body() != null) {
                val assignments = response.body()!!.data
                if (assignments.isNotEmpty()) {
                    ApiResult.Success(assignments.first())
                } else {
                    ApiResult.Error(message = "해당 수액 정보를 찾을 수 없습니다.")
                }
            } else {
                ApiResult.Error(
                    message = "정보를 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "정보 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun insertData(tableName: String, data: JsonObject): ApiResult<JsonObject> {
        return try {
            val response = userApi.insertData(tableName, data)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "데이터 삽입 실패: ${response.code()} - ${response.message()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "데이터 삽입 예외 발생: ${e.message}")
        }
    }

    suspend fun checkBedAssignmentStatus(bedId: Int): ApiResult<JsonObject> {
        return try {
            val response = userApi.getPatientBedAssignments(
                page = 1,
                limit = 10,
                where = "bed_id:$bedId",
                order = "id:desc"
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "할당 상태를 확인할 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "할당 상태 확인 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun upsertAssignment(data: JsonObject): ApiResult<JsonObject> {
        return try {
            val response = userApi.upsertPatientBedAssignment(data)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string()
                val serverMessage = try {
                    val errorJson = com.google.gson.Gson().fromJson(
                        errorBody, JsonObject::class.java
                    )
                    errorJson?.get("message")?.asString
                } catch (e: Exception) {
                    null
                }
                ApiResult.Error(
                    message = serverMessage ?: "환자 병상 할당 실패: ${response.code()} - ${response.message()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "환자 병상 할당 중 오류가 발생했습니다: ${e.message}")
        }
    }
}
