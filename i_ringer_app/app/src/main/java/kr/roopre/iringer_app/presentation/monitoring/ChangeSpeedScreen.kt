package kr.roopre.iringer_app.presentation.monitoring

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.presentation.common.FormatUtils
import kr.roopre.iringer_app.ui.theme.AppColors

@Composable
internal fun ChangeSpeedScreen(
    room: RoomUiModel,
    bed: BedUiModel,
    card: InfusionCardUiModel,
    viewModel: PatientMonitoringViewModel,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    val subText = FormatUtils.formatGenderAge(bed.gender, bed.age)
    val infusionOptions by viewModel.infusionOptions.collectAsState()
    val infusionCode = remember(card.infusionType, infusionOptions) {
        viewModel.resolveInfusionCode(card.infusionType)
    }

    var newSpeed by remember { mutableStateOf(card.ccHr?.toInt()?.toString() ?: "200") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val hasAlert = card.hasAlert
    val isSpeedAlert = card.alertCategory == "caution" && card.alertType?.uppercase() in listOf("SLOW", "FAST", "ALMOST_DONE")
    // 정지/완료/연결끊김 상태에서는 현재 속도를 0으로 표시
    val isStoppedState = card.alertType?.uppercase() in listOf("STOP", "STOPPED", "DONE", "DISCONNECTED")
    val displayCcHr = if (isStoppedState) 0 else (card.measuredCchr?.toInt() ?: card.ccHr?.toInt() ?: 0)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.5f))
            .clickable(enabled = false) { }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White)
        ) {
            // === Top Bar ===
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .background(Color(0xFF111827))
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_back),
                        contentDescription = "뒤로",
                        tint = Color.White
                    )
                }
                Text(
                    text = "속도 변경",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            // === Patient Info Area ===
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(AppColors.SidebarBg)
                    .padding(horizontal = 20.dp, vertical = 14.dp)
            ) {
                Text(
                    text = "${room.roomNumber}호 · ${bed.bedNumber}번 침상",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.IconDefault
                )
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = bed.patientName ?: "-",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppColors.TextPrimary
                    )
                    if (subText.isNotEmpty()) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = subText,
                            fontSize = 13.sp,
                            color = AppColors.IconMuted,
                            modifier = Modifier.padding(bottom = 1.dp)
                        )
                    }
                }
            }

            // === Divider ===
            HorizontalDivider(thickness = 0.5.dp, color = Color(0xFFE2E8F0))

            // === Scrollable Content ===
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
            ) {
                // === 속도 상태 Container ===
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFF8FAFC))
                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                            .padding(16.dp)
                    ) {
                        // Title row: "속도 상태" + alert badge
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "속도 상태",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1B1D1F)
                            )
                            if (card.alertType != null) {
                                val alertLabel = MonitoringMapper.mapAlertLabel(card.alertType)
                                val badgeBg = when (card.alertCategory) {
                                    "critical" -> MonitoringColors.CriticalBg
                                    "caution" -> MonitoringColors.CautionBg
                                    "system_error" -> MonitoringColors.SystemErrorBg
                                    else -> Color(0xFFF1F5F9)
                                }
                                val badgeBorderColor = when (card.alertCategory) {
                                    "critical" -> MonitoringColors.CriticalText
                                    "caution" -> MonitoringColors.CautionText
                                    "system_error" -> MonitoringColors.SystemErrorText
                                    else -> Color.Transparent
                                }
                                val badgeTextColor = when (card.alertCategory) {
                                    "critical" -> MonitoringColors.CriticalText
                                    "caution" -> MonitoringColors.CautionText
                                    "system_error" -> MonitoringColors.SystemErrorText
                                    else -> Color(0xFF64748B)
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(badgeBg)
                                        .border(1.dp, badgeBorderColor, RoundedCornerShape(4.dp))
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text(
                                        text = alertLabel,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = badgeTextColor
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Speed boxes row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(0.dp)
                        ) {
                            // Left box: 처방 속도
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color.White)
                                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "처방 속도",
                                    fontSize = 11.sp,
                                    color = Color(0xFF94A3B8)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(
                                    verticalAlignment = Alignment.Bottom
                                ) {
                                    Text(
                                        text = "${card.ccHr?.toInt() ?: 0}",
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF1B1D1F)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = "cc/hr",
                                        fontSize = 13.sp,
                                        color = Color(0xFF94A3B8),
                                        modifier = Modifier.padding(bottom = 2.dp)
                                    )
                                }
                            }

                            // Center arrow
                            Box(
                                modifier = Modifier.padding(horizontal = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = ">",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFCBD5E1)
                                )
                            }

                            // Right box: 현재 속도
                            val currentSpeedBorderColor = if (isSpeedAlert) Color(0xFFFDE047) else Color(0xFFE2E8F0)
                            val currentSpeedBgColor = if (isSpeedAlert) Color(0xFFFEFCE8) else Color.White
                            val currentSpeedValueColor = if (isSpeedAlert) Color(0xFFCA8A04) else Color(0xFF1B1D1F)
                            val currentSpeedLabelColor = if (isSpeedAlert) Color(0xFFCA8A04) else Color(0xFF94A3B8)

                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(currentSpeedBgColor)
                                    .border(1.dp, currentSpeedBorderColor, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "현재 속도",
                                    fontSize = 11.sp,
                                    color = currentSpeedLabelColor
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(
                                    verticalAlignment = Alignment.Bottom
                                ) {
                                    Text(
                                        text = "$displayCcHr",
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = currentSpeedValueColor
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = "cc/hr",
                                        fontSize = 13.sp,
                                        color = currentSpeedLabelColor,
                                        modifier = Modifier.padding(bottom = 2.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                // === 변경할 속도 입력 Section ===
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                ) {
                    Text(
                        text = "변경할 속도 입력",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1B1D1F),
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    // Input field
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(2.dp, Color(0xFF111827), RoundedCornerShape(12.dp))
                            .padding(horizontal = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            BasicTextField(
                                value = newSpeed,
                                onValueChange = { value ->
                                    val filtered = value.filter { it.isDigit() }
                                    if (filtered.length <= 4) {
                                        newSpeed = filtered
                                    }
                                },
                                textStyle = TextStyle(
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF111827),
                                    textAlign = TextAlign.Center
                                ),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                cursorBrush = SolidColor(Color(0xFF111827)),
                                modifier = Modifier.widthIn(min = 40.dp, max = 120.dp),
                                decorationBox = { innerTextField ->
                                    Box(contentAlignment = Alignment.Center) {
                                        if (newSpeed.isEmpty()) {
                                            Text(
                                                text = "0",
                                                fontSize = 24.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFFCBD5E1),
                                                textAlign = TextAlign.Center
                                            )
                                        }
                                        innerTextField()
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "cc/hr",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Quick select buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("100", "200", "300").forEach { speedValue ->
                            val isSelected = newSpeed == speedValue
                            Button(
                                onClick = { newSpeed = speedValue },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(40.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isSelected) Color(0xFF111827) else Color.White
                                ),
                                border = if (!isSelected) {
                                    androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
                                } else {
                                    null
                                },
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Text(
                                    text = speedValue,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color.White else Color(0xFF1B1D1F)
                                )
                            }
                        }
                    }

                    // Error message
                    if (errorMessage != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = errorMessage!!,
                            fontSize = 12.sp,
                            color = Color(0xFFDC2626)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // === Bottom Buttons (스크롤 영역 내부) ===
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = onDismiss,
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF1F5F9)
                        ),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1))
                    ) {
                        Text(
                            text = "취소",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF475569)
                        )
                    }

                    Button(
                        onClick = {
                            val speedInt = newSpeed.toIntOrNull()
                            if (speedInt == null || speedInt <= 0) {
                                errorMessage = "올바른 속도를 입력해주세요."
                                return@Button
                            }
                            isSubmitting = true
                            errorMessage = null

                            viewModel.changeSpeed(
                                assignmentId = card.assignmentId,
                                newSpeed = speedInt,
                                onSuccess = {
                                    isSubmitting = false
                                    onSuccess()
                                },
                                onError = { msg ->
                                    isSubmitting = false
                                    errorMessage = msg
                                }
                            )
                        },
                        enabled = !isSubmitting,
                        modifier = Modifier
                            .weight(2f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF111827),
                            disabledContainerColor = Color(0xFF94A3B8)
                        )
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = "변경하기",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }
    }
}
