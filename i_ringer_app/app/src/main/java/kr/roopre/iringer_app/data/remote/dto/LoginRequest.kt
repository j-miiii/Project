package kr.roopre.iringer_app.data.remote.dto

data class LoginRequest(
    val auth_id: String,
    val password: String
)