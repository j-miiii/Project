package kr.roopre.iringer_app.presentation.main

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.presentation.monitoring.PatientMonitoringScreen
import kr.roopre.iringer_app.presentation.mypage.MyPageScreen
import kr.roopre.iringer_app.presentation.mypage.ProfileEditScreen
import kr.roopre.iringer_app.presentation.mypage.TermsScreen
import kr.roopre.iringer_app.ui.theme.AppColors

enum class MainTab(
    val label: String,
    @DrawableRes val iconRes: Int
) {
    MONITORING("환자 목록", R.drawable.ic_tab_patients),
    REGISTRATION("환자 등록", R.drawable.ic_tab_register),
    MY_PAGE("마이페이지", R.drawable.ic_tab_mypage)
}

@Composable
fun MainTabScreen(
    viewModel: MainViewModel,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableStateOf(MainTab.MONITORING) }
    var showTerms by remember { mutableStateOf(false) }
    var showProfileEdit by remember { mutableStateOf(false) }
    var isFullScreen by remember { mutableStateOf(false) }
    var showExitDialog by remember { mutableStateOf(false) }
    val activity = LocalContext.current as? Activity

    BackHandler(enabled = !showTerms && !showProfileEdit && !isFullScreen) {
        showExitDialog = true
    }

    if (showExitDialog) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .zIndex(10f)
                .background(Color.Black.copy(alpha = 0.5f))
                .clickable { showExitDialog = false },
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier
                    .width(320.dp)
                    .clickable(enabled = false) { },
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = AppColors.CardBg),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "앱을 종료하시겠습니까?",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppColors.TextPrimary,
                        modifier = Modifier.padding(bottom = 24.dp)
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { showExitDialog = false },
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AppColors.CardBorder,
                                contentColor = AppColors.TextPrimary
                            ),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, AppColors.InputBorder)
                        ) {
                            Text("취소", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        }
                        Button(
                            onClick = { activity?.finish() },
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AppColors.ButtonDanger,
                                contentColor = AppColors.TextOnDark
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("종료", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        bottomBar = {
            if (!isFullScreen && !showTerms && !showProfileEdit) {
                NavigationBar(
                    containerColor = Color(0xFF111827),
                    tonalElevation = 0.dp
                ) {
                    MainTab.entries.forEach { tab ->
                        val selected = selectedTab == tab
                        NavigationBarItem(
                            selected = selected,
                            onClick = { selectedTab = tab },
                            icon = {
                                Icon(
                                    painter = painterResource(id = tab.iconRes),
                                    contentDescription = tab.label,
                                    modifier = Modifier.size(22.dp)
                                )
                            },
                            label = {
                                Text(
                                    text = tab.label,
                                    fontSize = 11.sp
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Color.White,
                                selectedTextColor = Color.White,
                                unselectedIconColor = Color(0xFF64748B),
                                unselectedTextColor = Color(0xFF64748B),
                                indicatorColor = Color(0xFF111827)
                            )
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (showProfileEdit) {
                ProfileEditScreen(onBack = { showProfileEdit = false })
            } else if (showTerms) {
                // 약관 화면: Scaffold 위에 오버레이 (탭 파괴 안 함)
                TermsScreen(onBack = { showTerms = false })
            } else {
                // 선택된 탭만 렌더링 (ViewModel은 ViewModelStoreOwner 스코프에서 유지됨)
                when (selectedTab) {
                    MainTab.MONITORING -> {
                        PatientMonitoringScreen(
                            onFullScreenChange = { isFullScreen = it }
                        )
                    }
                    MainTab.REGISTRATION -> {
                        MainScreen(
                            viewModel = viewModel,
                            onLogout = onLogout
                        )
                    }
                    MainTab.MY_PAGE -> {
                        MyPageScreen(
                            onLogout = onLogout,
                            onNavigateToTerms = { showTerms = true },
                            onNavigateToProfileEdit = { showProfileEdit = true }
                        )
                    }
                }
            }
        }
    }
}
