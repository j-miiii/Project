package kr.roopre.iringer_app.presentation.monitoring

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.data.remote.dto.NotificationResponse
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NotificationScreen(
    viewModel: PatientMonitoringViewModel,
    onDismiss: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadNotifications()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F9FB))
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top Bar
            TopAppBar(
                title = {
                    Text(
                        text = "알림",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onDismiss) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_back),
                            contentDescription = "뒤로가기",
                            tint = Color.White,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                },
                actions = {
                    if (uiState.isMarkingAllRead) {
                        CircularProgressIndicator(
                            modifier = Modifier
                                .size(20.dp)
                                .padding(end = 4.dp),
                            color = Color(0xFF93C5FD),
                            strokeWidth = 2.dp
                        )
                    }
                    TextButton(
                        onClick = { viewModel.markAllNotificationsAsRead() },
                        enabled = !uiState.isMarkingAllRead
                    ) {
                        Text(
                            text = "모두 읽음",
                            color = if (uiState.isMarkingAllRead) Color(0xFF6B7280) else Color(0xFF93C5FD),
                            fontSize = 14.sp
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MonitoringColors.AppBarBg
                )
            )

            // Content
            when {
                uiState.isLoadingNotifications -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Color(0xFF3B82F6))
                    }
                }

                uiState.notifications.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "알림이 없습니다",
                                fontSize = 15.sp,
                                color = Color(0xFF9CA3AF)
                            )
                        }
                    }
                }

                else -> {
                    val listState = rememberLazyListState()

                    // 스크롤 끝 감지 → 추가 로드
                    LaunchedEffect(listState.canScrollForward, uiState.notifications.size) {
                        if (!listState.canScrollForward
                            && uiState.hasMoreNotifications
                            && !uiState.isLoadingMoreNotifications
                            && uiState.notifications.isNotEmpty()
                        ) {
                            viewModel.loadMoreNotifications()
                        }
                    }

                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .fillMaxSize()
                            .weight(1f)
                    ) {
                        items(
                            items = uiState.notifications,
                            key = { it.id }
                        ) { notification ->
                            NotificationItem(
                                notification = notification,
                                onClick = {
                                    if (notification.is_read == 0) {
                                        viewModel.markNotificationAsRead(notification.id)
                                    }
                                }
                            )
                        }

                        // 추가 로딩 인디케이터
                        if (uiState.isLoadingMoreNotifications) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        color = Color(0xFF3B82F6),
                                        strokeWidth = 2.dp
                                    )
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
private fun NotificationItem(
    notification: NotificationResponse,
    onClick: () -> Unit
) {
    val isUnread = notification.is_read == 0

    // 이상 카테고리 판별 (위급, 주의, 시스템 오류 → 이상)
    val isAbnormal = notification.alert_category in listOf("critical", "caution", "system_error")

    // 이상 뱃지 색상
    val badgeBg = when (notification.alert_category) {
        "critical" -> Color(0xFFFEF2F2)
        "caution" -> Color(0xFFFFFBEB)
        "system_error" -> Color(0xFFF5F3FF)
        else -> Color(0xFFEFF6FF)
    }
    val badgeTextColor = when (notification.alert_category) {
        "critical" -> Color(0xFFDC2626)
        "caution" -> Color(0xFFD97706)
        "system_error" -> Color(0xFF7C3AED)
        else -> Color(0xFF2563EB)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (isUnread) Color.White else Color(0xFFFAFAFB))
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
            // 상단: 이상 뱃지 + 시간
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (isAbnormal) {
                        // 이상 뱃지
                        Box(
                            modifier = Modifier
                                .background(
                                    color = badgeBg,
                                    shape = RoundedCornerShape(4.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "이상",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = badgeTextColor,
                                lineHeight = 14.sp
                            )
                        }
                    }

                    // 제목
                    Text(
                        text = notification.title ?: "",
                        fontSize = 14.sp,
                        fontWeight = if (isUnread) FontWeight.SemiBold else FontWeight.Normal,
                        color = Color(0xFF1F2937),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // 시간
                    Text(
                        text = formatNotificationTime(notification.created_at),
                        fontSize = 11.sp,
                        color = Color(0xFF9CA3AF)
                    )

                    // 읽지 않음 표시
                    if (isUnread) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF3B82F6))
                        )
                    }
                }
            }

            // 메시지
            if (!notification.message.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = notification.message,
                    fontSize = 13.sp,
                    color = Color(0xFF6B7280),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 18.sp
                )
        }
    }

    HorizontalDivider(
        color = Color(0xFFD1D5DB),
        thickness = 0.5.dp
    )
}

private fun formatNotificationTime(dateStr: String?): String {
    if (dateStr.isNullOrEmpty()) return ""
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(dateStr) ?: return dateStr
        val now = System.currentTimeMillis()
        val diff = now - date.time

        val minutes = diff / (1000 * 60)
        val hours = diff / (1000 * 60 * 60)
        val days = diff / (1000 * 60 * 60 * 24)

        when {
            minutes < 1 -> "방금 전"
            minutes < 60 -> "${minutes}분 전"
            hours < 24 -> "${hours}시간 전"
            days < 7 -> "${days}일 전"
            else -> {
                val outputFormat = SimpleDateFormat("MM/dd HH:mm", Locale.getDefault())
                outputFormat.format(date)
            }
        }
    } catch (e: Exception) {
        dateStr
    }
}
