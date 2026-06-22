package kr.roopre.iringer_app.presentation.mypage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.roopre.iringer_app.ui.theme.AppColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TermsScreen(
    onBack: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "서비스 이용약관",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppColors.TextOnDark
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "뒤로가기",
                            tint = AppColors.TextOnDark
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.AppBarBg
                )
            )
        },
        containerColor = AppColors.PageBg
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = AppColors.CardBg)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp)
                ) {
                    Text(
                        text = "iRinger 서비스 이용약관",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppColors.TextPrimary
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "시행일: 2025년 01월 01일",
                        fontSize = 13.sp,
                        color = AppColors.TextTertiary
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    TermsArticle(
                        title = "제 1 조 (목적)",
                        content = "이 약관은 iRinger(이하 \"서비스\")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다."
                    )

                    TermsArticle(
                        title = "제 2 조 (용어의 정의)",
                        content = "① \"서비스\"란 회사가 제공하는 수액 모니터링 및 환자 관리 관련 모바일 애플리케이션 서비스를 말합니다.\n② \"이용자\"란 이 약관에 따라 서비스를 이용하는 의료기관 소속 직원을 말합니다.\n③ \"기기\"란 수액 모니터링을 위해 서비스와 연동되는 IoT 디바이스를 말합니다."
                    )

                    TermsArticle(
                        title = "제 3 조 (서비스의 제공)",
                        content = "① 회사는 다음의 서비스를 제공합니다.\n  1. 수액 잔량 모니터링 서비스\n  2. 환자 정보 관리 서비스\n  3. 기기 연동 및 관리 서비스\n  4. 알림 서비스\n② 서비스는 연중무휴, 1일 24시간 제공을 원칙으로 합니다."
                    )

                    TermsArticle(
                        title = "제 4 조 (이용자의 의무)",
                        content = "① 이용자는 서비스 이용 시 관련 법령 및 이 약관의 규정을 준수하여야 합니다.\n② 이용자는 자신의 계정 정보를 타인에게 제공하거나 공유해서는 안 됩니다.\n③ 이용자는 환자의 개인정보를 관련 법령에 따라 적절히 보호하여야 합니다."
                    )

                    TermsArticle(
                        title = "제 5 조 (서비스의 중단 및 변경)",
                        content = "① 회사는 시스템 점검, 교체 및 고장, 통신 두절 등의 사유가 발생한 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.\n② 회사는 서비스의 내용을 변경하거나 중단할 수 있으며, 이 경우 사전에 공지합니다."
                    )

                    TermsArticle(
                        title = "제 6 조 (서비스 제공 중 면책)",
                        content = "① 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적인 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.\n② 회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다."
                    )

                    TermsArticle(
                        title = "제 7 조 (개인정보의 보호)",
                        content = "회사는 관련 법령이 정하는 바에 따라 이용자의 개인정보를 보호하기 위해 노력합니다. 개인정보의 보호 및 이용에 대해서는 관련 법령 및 회사의 개인정보처리방침에 따릅니다."
                    )

                    TermsArticle(
                        title = "제 8 조 (약관의 변경)",
                        content = "① 회사는 필요하다고 인정되는 경우 이 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지합니다.\n② 이용자가 변경된 약관에 동의하지 않는 경우, 서비스 이용을 중단할 수 있습니다.",
                        isLast = true
                    )
                }
            }
        }
    }
}

@Composable
private fun TermsArticle(
    title: String,
    content: String,
    isLast: Boolean = false
) {
    Text(
        text = title,
        fontSize = 15.sp,
        fontWeight = FontWeight.Bold,
        color = AppColors.TextPrimary
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = content,
        fontSize = 14.sp,
        color = AppColors.TextBody,
        lineHeight = 22.sp
    )
    if (!isLast) {
        Spacer(modifier = Modifier.height(20.dp))
    }
}
