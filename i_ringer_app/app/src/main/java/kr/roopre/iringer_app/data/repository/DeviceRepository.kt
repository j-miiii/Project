package kr.roopre.iringer_app.data.repository

import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.common.ApiResult
import kr.roopre.iringer_app.data.remote.api.UserApi
import kr.roopre.iringer_app.data.remote.dto.DeviceResponse

class DeviceRepository(private val userApi: UserApi) {

    suspend fun getDeviceById(deviceId: Int): ApiResult<DeviceResponse> {
        return try {
            val response = userApi.getDevicesBySerialNumber(
                page = 1,
                limit = 1,
                where = "id:$deviceId",
                order = "id:desc"
            )
            if (response.isSuccessful && response.body() != null) {
                val deviceList = response.body()!!.data
                if (deviceList.isNotEmpty()) {
                    ApiResult.Success(deviceList.first())
                } else {
                    ApiResult.Error(message = "기기 정보를 찾을 수 없습니다.")
                }
            } else {
                ApiResult.Error(
                    message = "기기 정보를 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "기기 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun getDeviceBySerialNumber(serialNumber: String): ApiResult<DeviceResponse> {
        return try {
            val response = userApi.getDevicesBySerialNumber(
                page = 1,
                limit = 10,
                where = "serial_number:$serialNumber",
                order = "id:desc"
            )
            if (response.isSuccessful && response.body() != null) {
                val deviceList = response.body()!!.data
                if (deviceList.isNotEmpty()) {
                    ApiResult.Success(deviceList.first())
                } else {
                    ApiResult.Error(message = "해당 시리얼 번호의 기기를 찾을 수 없습니다.")
                }
            } else {
                ApiResult.Error(
                    message = "기기 정보를 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "기기 정보 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun getDevicesByWard(wardId: Int): ApiResult<List<DeviceResponse>> {
        return try {
            val response = userApi.getDevicesBySerialNumber(
                page = 1,
                limit = 200,
                where = "ward_id:$wardId",
                order = "device_name:asc"
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!.data)
            } else {
                ApiResult.Error(
                    message = "병동 기기 목록을 불러올 수 없습니다.",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "병동 기기 조회 중 오류가 발생했습니다: ${e.message}")
        }
    }

    suspend fun updateDevice(deviceId: Int, data: JsonObject): ApiResult<JsonObject> {
        return try {
            val response = userApi.updateData(
                tableName = "devices",
                id = deviceId,
                data = data
            )
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(
                    message = "기기 업데이트 실패: ${response.code()}",
                    code = response.code()
                )
            }
        } catch (e: Exception) {
            ApiResult.Error(message = "기기 업데이트 중 오류: ${e.message}")
        }
    }
}
