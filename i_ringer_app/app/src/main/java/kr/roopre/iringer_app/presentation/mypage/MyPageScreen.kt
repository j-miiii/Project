package kr.roopre.iringer_app.presentation.mypage

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.data.manager.UserManager
import kr.roopre.iringer_app.ui.theme.AppColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyPageScreen(
    onLogout: () -> Unit,
    onNavigateToTerms: () -> Unit = {},
    onNavigateToProfileEdit: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val appVersion = remember {
        try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            "v${pInfo.versionName}"
        } catch (_: Exception) { "v2.0.1" }
    }

    val user = UserManager.currentUser
    val displayName = user?.name ?: user?.nickname ?: "사용자"
    val userRole = user?.role ?: "간호사"
    val employeeNumber = user?.employee_number

    var showLogoutDialog by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "마이페이지",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppColors.TextOnDark
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.AppBarBg
                )
            )
        },
        containerColor = AppColors.PageBg
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // 사용자 프로필 카드
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = AppColors.CardBg),
                    border = BorderStroke(1.dp, AppColors.CardBorder)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 20.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // 프로필 아이콘
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(AppColors.CardBorder),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_profile),
                                contentDescription = "프로필",
                                tint = AppColors.IconMuted,
                                modifier = Modifier.size(32.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        // 이름, 병동, 사번
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = displayName,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.TextPrimary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = user?.nickname ?: userRole,
                                fontSize = 14.sp,
                                color = AppColors.TextSecondary
                            )
                            if (!employeeNumber.isNullOrEmpty()) {
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "사번:$employeeNumber",
                                    fontSize = 13.sp,
                                    color = AppColors.TextTertiary
                                )
                            }
                        }

                        // 수정 버튼
                        OutlinedButton(
                            onClick = onNavigateToProfileEdit,
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = Color(0xFFF8FAFC),
                                contentColor = Color(0xFF475569)
                            ),
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = "수정",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // 서비스 정보 섹션
                SectionHeader("서비스 정보")
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = AppColors.CardBg),
                    border = BorderStroke(1.dp, AppColors.CardBorder)
                ) {
                    MenuItem(
                        iconRes = R.drawable.ic_term,
                        title = "약관 보기",
                        onClick = { onNavigateToTerms() }
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // 시스템 섹션
                SectionHeader("시스템")
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = AppColors.CardBg),
                    border = BorderStroke(1.dp, AppColors.CardBorder)
                ) {
                    MenuItem(
                        iconRes = R.drawable.ic_app_version,
                        title = "앱버전 정보",
                        subtitle = appVersion,
                        showArrow = false,
                        onClick = { }
                    )
                    HorizontalDivider(
                        modifier = Modifier.padding(horizontal = 20.dp),
                        thickness = 0.5.dp,
                        color = AppColors.Divider
                    )
                    MenuItem(
                        iconRes = R.drawable.ic_logout,
                        title = "로그아웃",
                        titleColor = AppColors.ButtonDanger,
                        iconTint = AppColors.ButtonDanger,
                        showArrow = false,
                        onClick = { showLogoutDialog = true }
                    )
                }
            }

            // 로그아웃 확인 다이얼로그 오버레이
            if (showLogoutDialog) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.5f))
                        .clickable { showLogoutDialog = false },
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
                                text = "로그아웃 하시겠습니까?",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.TextPrimary,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                            Text(
                                text = "로그아웃 시 수신 중인 알림이 중단됩니다.",
                                fontSize = 14.sp,
                                color = AppColors.TextSecondary,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(bottom = 24.dp)
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Button(
                                    onClick = { showLogoutDialog = false },
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
                                    onClick = {
                                        showLogoutDialog = false
                                        onLogout()
                                    },
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(48.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = AppColors.ButtonDanger,
                                        contentColor = AppColors.TextOnDark
                                    ),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Text("로그아웃", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        color = AppColors.TextPrimary,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
    )
}

@Composable
private fun MenuItem(
    iconRes: Int,
    title: String,
    subtitle: String? = null,
    titleColor: Color = AppColors.TextPrimary,
    iconTint: Color = AppColors.IconDefault,
    showArrow: Boolean = true,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            painter = painterResource(id = iconRes),
            contentDescription = title,
            tint = iconTint,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(14.dp))
        Text(
            text = title,
            fontSize = 15.sp,
            color = titleColor,
            modifier = Modifier.weight(1f)
        )
        if (subtitle != null) {
            Text(
                text = subtitle,
                fontSize = 13.sp,
                color = AppColors.TextTertiary
            )
            Spacer(modifier = Modifier.width(4.dp))
        }
        if (showArrow) {
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                contentDescription = null,
                tint = AppColors.IconArrow,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
