package kr.roopre.iringer_app.data.remote.dto

data class LoginResponse(
    val access_token: String,
    val refresh_token: String,
    val user: UserData
)

data class UserData(
    val id: Int,
    val email: String,
    val role: String,
    val nickname: String,
    val hospital_id: Int,
    val ward_id: Int,
    val has_emr: Boolean,
    val employee_number: String? = null,
    val profile_image: String? = "/images/default_profile.png",
    val name: String? = null
)