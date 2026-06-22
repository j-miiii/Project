package kr.roopre.iringer_app.data.repository

import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.common.ApiResult
import kr.roopre.iringer_app.data.remote.api.UserApi
import kr.roopre.iringer_app.data.remote.dto.MonitoringDataResponse
import kr.roopre.iringer_app.data.remote.dto.PatientBedAssignment

class MonitoringRepository(private val userApi: UserApi) {

    suspend fun getMonitoringData(
        hospitalId: Int,
        wardId: Int
    ): ApiResult<MonitoringDataResponse> {
        return try {
            val response = userApi.getMonitoringData(
                hospitalId = hospitalId,
                wardId = wardId
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "모니터링 데이터를 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "네트워크 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun getAssignmentById(assignmentId: Int): ApiResult<JsonObject> {
        return try {
            val response = userApi.getById(
                tableName = "patient_bed_assignments",
                id = assignmentId
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "수액 정보를 찾을 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 정보 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun fetchAssignmentInfo(assignmentId: Int): ApiResult<PatientBedAssignment> {
        return try {
            val response = userApi.getPatientBedAssignmentList(
                page = 1, limit = 1, where = "id:$assignmentId"
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
                    message = "수액 정보를 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 정보 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun insertPatient(data: JsonObject): ApiResult<JsonObject> {
        return try {
            val response = userApi.insertData(
                tableName = "patients",
                data = data
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "환자 추가 실패: ${response.code()} - ${response.message()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "환자 추가 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun insertAssignment(data: JsonObject): ApiResult<JsonObject> {
        return try {
            val response = userApi.insertData(
                tableName = "patient_bed_assignments",
                data = data
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "수액 추가 실패: ${response.code()} - ${response.message()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 추가 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun addInfusion(data: JsonObject): ApiResult<JsonObject> {
        return try {
            val response = userApi.addInfusion(data)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string()
                val errorMsg = try {
                    com.google.gson.Gson().fromJson(errorBody, JsonObject::class.java)
                        ?.get("message")?.asString
                } catch (_: Exception) { null }
                ApiResult.Error(
                    message = errorMsg ?: "수액 추가 실패: ${response.code()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 추가 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun updateAssignment(assignmentId: Int, data: JsonObject): ApiResult<JsonObject> {
        return try {
            val response = userApi.updateData(
                tableName = "patient_bed_assignments",
                id = assignmentId,
                data = data
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "수액 업데이트 실패: ${response.code()} - ${response.message()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 업데이트 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun clearInfusion(assignmentId: Int): ApiResult<JsonObject> {
        return try {
            val response = userApi.clearInfusion(assignmentId)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "수액 삭제 실패: ${response.code()} - ${response.message()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 삭제 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun releaseAssignment(assignmentId: Int): ApiResult<JsonObject> {
        return try {
            val response = userApi.releaseAssignment(assignmentId)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "수액 해제 실패: ${response.code()} - ${response.message()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 해제 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun deleteAssignment(assignmentId: Int): ApiResult<JsonObject> {
        return try {
            val response = userApi.deleteData(
                tableName = "patient_bed_assignments",
                id = assignmentId
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "수액 삭제 실패: ${response.code()} - ${response.message()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "수액 삭제 중 오류가 발생했습니다: ${e.message}")
        }
    }
}
