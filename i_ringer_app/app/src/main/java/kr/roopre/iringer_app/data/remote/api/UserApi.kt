package kr.roopre.iringer_app.data.remote.api

import kr.roopre.iringer_app.data.remote.dto.DeviceListResponse
import kr.roopre.iringer_app.data.remote.dto.DeviceResponse
import kr.roopre.iringer_app.data.remote.dto.LoginRequest
import kr.roopre.iringer_app.data.remote.dto.LoginResponse
import kr.roopre.iringer_app.data.remote.dto.MonitoringDataResponse
import kr.roopre.iringer_app.data.remote.dto.NotificationListResponse
import kr.roopre.iringer_app.data.remote.dto.PatientBedAssignmentListResponse
import kr.roopre.iringer_app.data.remote.dto.TermListResponse
import kr.roopre.iringer_app.data.remote.dto.UserTermAgreementListResponse
import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.DELETE
import retrofit2.http.Path
import retrofit2.http.Query

interface UserApi {
    @POST("api/user/signin")
    suspend fun signIn(@Body request: LoginRequest): Response<LoginResponse>

    // === 범용 CRUD ===
    @GET("api/{table_name}")
    suspend fun getList(
        @Path("table_name") tableName: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10,
        @Query("where") where: String? = null,
        @Query("order") order: String = "id:desc"
    ): Response<JsonObject>

    @GET("api/{table_name}/{id}")
    suspend fun getById(
        @Path("table_name") tableName: String,
        @Path("id") id: Int
    ): Response<JsonObject>

    @POST("api/{table_name}")
    suspend fun insertData(
        @Path("table_name") tableName: String,
        @Body data: JsonObject
    ): Response<JsonObject>

    @PUT("api/{table_name}/{id}")
    suspend fun updateData(
        @Path("table_name") tableName: String,
        @Path("id") id: Int,
        @Body data: JsonObject
    ): Response<JsonObject>

    @DELETE("api/{table_name}/{id}")
    suspend fun deleteData(
        @Path("table_name") tableName: String,
        @Path("id") id: Int
    ): Response<JsonObject>

    // === 기기 조회 ===
    @GET("api/{table_name}/{id}")
    suspend fun getDevice(
        @Path("table_name") tableName: String,
        @Path("id") id: Int
    ): Response<DeviceResponse>

    @GET("api/devices")
    suspend fun getDevicesBySerialNumber(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10,
        @Query("where") where: String,
        @Query("order") order: String = "id:desc"
    ): Response<DeviceListResponse>

    // === monitoring data ===
    @GET("api/monitoring/data/list")
    suspend fun getMonitoringData(
        @Query("hospital_id") hospitalId: Int,
        @Query("ward_id") wardId: Int
    ): Response<MonitoringDataResponse>

    // === monitoring assignment release (투여완료) ===
    @PUT("api/monitoring/assignments/{assignmentId}/release")
    suspend fun releaseAssignment(
        @Path("assignmentId") assignmentId: Int
    ): Response<JsonObject>

    // === monitoring clear-infusion (수액 삭제, 환자 유지) ===
    @PUT("api/monitoring/assignments/{assignmentId}/clear-infusion")
    suspend fun clearInfusion(
        @Path("assignmentId") assignmentId: Int
    ): Response<JsonObject>

    // === monitoring add-infusion (수액 추가 전용) ===
    @POST("api/monitoring/assignments/add-infusion")
    suspend fun addInfusion(
        @Body data: JsonObject
    ): Response<JsonObject>

    // === patient_bed_assignments ===
    @POST("api/patient_bed_assignments/upsert")
    suspend fun upsertPatientBedAssignment(
        @Body data: JsonObject
    ): Response<JsonObject>

    @GET("api/patient_bed_assignments")
    suspend fun getPatientBedAssignments(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10,
        @Query("where") where: String? = null,
        @Query("order") order: String = "id:desc"
    ): Response<JsonObject>

    @GET("api/patient_bed_assignments")
    suspend fun getPatientBedAssignmentList(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
        @Query("where") where: String? = null,
        @Query("order") order: String = "id:desc"
    ): Response<PatientBedAssignmentListResponse>

    // === notifications ===
    @GET("api/notifications")
    suspend fun getNotifications(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("where") where: String? = null,
        @Query("order") order: String = "id:desc"
    ): Response<NotificationListResponse>

    @POST("api/notifications/mark-all-read")
    suspend fun markAllNotificationsAsRead(
        @Body data: JsonObject
    ): Response<JsonObject>

    // === users 프로필 수정 ===
    @PUT("api/users/{id}")
    suspend fun updateUser(
        @Path("id") id: Int,
        @Body data: JsonObject
    ): Response<JsonObject>

    // === terms (약관) ===
    @GET("api/terms")
    suspend fun getTerms(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10,
        @Query("where") where: String? = null,
        @Query("order") order: String = "id:desc"
    ): Response<TermListResponse>

    // === user_term_agreements (약관 동의) ===
    @GET("api/user_term_agreements")
    suspend fun getUserTermAgreements(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10,
        @Query("where") where: String? = null,
        @Query("order") order: String = "id:desc"
    ): Response<UserTermAgreementListResponse>

    @POST("api/user_term_agreements")
    suspend fun agreeToTerm(
        @Body data: JsonObject
    ): Response<JsonObject>
}
