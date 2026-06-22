package kr.roopre.iringer_app.data.remote.dto

data class Term(
    val id: Int,
    val title: String,
    val content: String,
    val version: String,
    val type: String,
    val is_required: Boolean,
    val is_active: Boolean,
    val effective_at: String?,
    val created_at: String?,
    val updated_at: String?
)

data class TermListResponse(
    val data: List<Term>,
    val pagination: Pagination
)

data class UserTermAgreement(
    val id: Int,
    val user_id: Int,
    val term_id: Int,
    val agreed_at: String?,
    val created_at: String?,
    val updated_at: String?
)

data class UserTermAgreementListResponse(
    val data: List<UserTermAgreement>,
    val pagination: Pagination
)
