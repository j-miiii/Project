package kr.roopre.iringer_app.data.manager

import kr.roopre.iringer_app.data.remote.dto.UserData

object UserManager {
    private var _currentUser: UserData? = null

    val currentUser: UserData?
        get() = _currentUser

    var accessToken: String? = null
        private set

    var refreshToken: String? = null
        private set

    fun setUserData(user: UserData, accessToken: String, refreshToken: String) {
        _currentUser = user
        this.accessToken = accessToken
        this.refreshToken = refreshToken
    }

    fun clearUserData() {
        _currentUser = null
        accessToken = null
        refreshToken = null
    }

    // 편의 메서드들
    val isLoggedIn: Boolean
        get() = _currentUser != null

    val userId: Int?
        get() = _currentUser?.id

    val userEmail: String?
        get() = _currentUser?.email

    val userNickname: String?
        get() = _currentUser?.nickname

    val userRole: String?
        get() = _currentUser?.role

    val hospitalId: Int?
        get() = _currentUser?.hospital_id

    val wardId: Int?
        get() = _currentUser?.ward_id

    val userName: String?
        get() = _currentUser?.name

    val employeeNumber: String?
        get() = _currentUser?.employee_number

    val profileImage: String?
        get() = _currentUser?.profile_image

    val hasEmployeeNumber: Boolean
        get() = !_currentUser?.employee_number.isNullOrEmpty()
}
