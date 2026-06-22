package kr.roopre.iringer_app.presentation.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import kr.roopre.iringer_app.data.local.PreferenceManager
import kr.roopre.iringer_app.data.repository.AuthRepository

class LoginViewModelFactory(
    private val authRepository: AuthRepository,
    private val preferenceManager: PreferenceManager
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(LoginViewModel::class.java)) {
            return LoginViewModel(authRepository, preferenceManager) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}