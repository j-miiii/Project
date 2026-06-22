package kr.roopre.iringer_app.data.remote.dto

data class ErrorResponse(
    val message: String,
    val error: String,
    val statusCode: Int
)
