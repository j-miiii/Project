package kr.roopre.iringer_app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import kr.roopre.iringer_app.data.fcm.FCMTokenSender
import kr.roopre.iringer_app.data.local.PreferenceManager
import kr.roopre.iringer_app.data.manager.UserManager
import kr.roopre.iringer_app.data.mqtt.MqttManager
import kr.roopre.iringer_app.data.repository.AuthRepository
import kr.roopre.iringer_app.di.totalProvider
import kr.roopre.iringer_app.presentation.login.LoginScreen
import kr.roopre.iringer_app.presentation.login.LoginViewModel
import kr.roopre.iringer_app.presentation.login.LoginViewModelFactory
import kr.roopre.iringer_app.presentation.main.MainTabScreen
import kr.roopre.iringer_app.presentation.main.MainViewModel
import kr.roopre.iringer_app.presentation.main.MainViewModelFactory

@Composable
fun AppNavigation(
    navController: NavHostController,
    mainViewModel: MainViewModel? = null,  // MainActivity에서 전달받은 viewModel
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val preferenceManager = remember { PreferenceManager(context) }
    var startDestination by remember { mutableStateOf<String?>(null) }

    // 자동 로그인 체크
    LaunchedEffect(Unit) {
        val isAutoLogin = preferenceManager.isAutoLoginEnabled &&
                !preferenceManager.savedUserId.isNullOrEmpty() &&
                !preferenceManager.savedPassword.isNullOrEmpty()

        if (isAutoLogin) {
            // 저장된 사용자 정보 로드
            val userData = preferenceManager.userData
            val accessToken = preferenceManager.accessToken
            val refreshToken = preferenceManager.refreshToken

            if (userData != null && accessToken != null && refreshToken != null) {
                UserManager.setUserData(userData, accessToken, refreshToken)
                // 자동 로그인 시 FCM 토큰 서버 전송
                FCMTokenSender.sendTokenToServer()
                startDestination = NavRoute.Main.route
            } else {
                startDestination = NavRoute.Login.route
            }
        } else {
            startDestination = NavRoute.Login.route
        }
    }

    // startDestination이 결정될 때까지 대기
    if (startDestination != null) {
        NavHost(
            navController = navController,
            startDestination = startDestination!!,
            modifier = modifier
        ) {
            composable(NavRoute.Login.route) {
                val loginViewModel: LoginViewModel = viewModel(
                    factory = LoginViewModelFactory(
                        AuthRepository(totalProvider.userApi),
                        preferenceManager
                    )
                )
                LoginScreen(
                    viewModel = loginViewModel,
                    onLoginSuccess = {
                        navController.navigate(NavRoute.Main.route) {
                            popUpTo(NavRoute.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(NavRoute.Main.route) {
                MainTabScreen(
                    viewModel = mainViewModel ?: viewModel(
                        factory = MainViewModelFactory(
                            totalProvider.patientRepository,
                            totalProvider.deviceRepository,
                            totalProvider.userSettingsRepository
                        )
                    ),
                    onLogout = {
                        // FCM 토큰 서버에서 클리어 후 로그아웃 처리
                        FCMTokenSender.clearTokenOnServer {
                            MqttManager.unsubscribeAll()
                            MqttManager.disconnect()
                            UserManager.clearUserData()
                            preferenceManager.clearLoginData()
                            navController.navigate(NavRoute.Login.route) {
                                popUpTo(NavRoute.Main.route) { inclusive = true }
                            }
                        }
                    }
                )
            }
        }
    }
}