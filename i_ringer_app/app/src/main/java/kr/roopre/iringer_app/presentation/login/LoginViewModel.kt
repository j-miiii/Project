package kr.roopre.iringer_app.presentation.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kr.roopre.iringer_app.data.fcm.FCMTokenSender
import kr.roopre.iringer_app.data.local.PreferenceManager
import kr.roopre.iringer_app.data.manager.UserManager
import kr.roopre.iringer_app.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class LoginUiState {
    object Idle : LoginUiState()
    object Loading : LoginUiState()
    data class Success(val message: String) : LoginUiState()
    data class Error(val message: String) : LoginUiState()
}

class LoginViewModel(
    private val authRepository: AuthRepository,
    private val preferenceManager: PreferenceManager
) : ViewModel() {
    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun login(username: String, password: String, autoLogin: Boolean) {
        viewModelScope.launch {
            _uiState.value = LoginUiState.Loading

            val result = authRepository.signIn(username, password)

            _uiState.value = if (result.isSuccess) {
                val response = result.getOrNull()
                if (response != null) {
                    // UserManager에 현재 사용자 정보 저장
                    UserManager.setUserData(
                        user = response.user,
                        accessToken = response.access_token,
                        refreshToken = response.refresh_token
                    )

                    // 자동 로그인 데이터 저장
                    preferenceManager.saveLoginData(
                        userId = username,
                        password = password,
                        autoLogin = autoLogin,
                        accessToken = response.access_token,
                        refreshToken = response.refresh_token,
                        userData = response.user
                    )
                    // FCM 토큰을 서버에 전송
                    FCMTokenSender.sendTokenToServer()

                    LoginUiState.Success("${response.user.nickname}님 환영합니다")
                } else {
                    LoginUiState.Error("로그인 실패")
                }
            } else {
                LoginUiState.Error(result.exceptionOrNull()?.message ?: "네트워크 오류")
            }
        }
    }

    fun resetState() {
        _uiState.value = LoginUiState.Idle
    }

    // 저장된 로그인 정보 가져오기
    fun getSavedUserId(): String {
        return preferenceManager.savedUserId ?: ""
    }

    fun getSavedPassword(): String {
        return preferenceManager.savedPassword ?: ""
    }
}