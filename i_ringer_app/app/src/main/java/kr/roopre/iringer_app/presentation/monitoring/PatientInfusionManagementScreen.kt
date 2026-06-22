package kr.roopre.iringer_app.presentation.monitoring

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.presentation.common.FormatUtils
import kr.roopre.iringer_app.ui.theme.AppColors

@Composable
internal fun PatientInfusionManagementScreen(
    room: RoomUiModel,
    bed: BedUiModel,
    selectedAssignmentId: Int?,
    viewModel: PatientMonitoringViewModel,
    onDismiss: () -> Unit,
    onNavigateToChangeSpeed: (RoomUiModel, BedUiModel, InfusionCardUiModel) -> Unit = { _, _, _ -> },
    onNavigateToChangeInfusion: (RoomUiModel, BedUiModel, InfusionCardUiModel) -> Unit = { _, _, _ -> },
    onNavigateToChangeDevice: (RoomUiModel, BedUiModel, InfusionCardUiModel) -> Unit = { _, _, _ -> }
) {
    var showEndAllDialog by remember { mutableStateOf(false) }
    val subText = FormatUtils.formatGenderAge(bed.gender, bed.age)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.5f))
            .clickable(enabled = false) { }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MonitoringColors.PageBg)
        ) {
            // === Top Bar ===
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .background(MonitoringColors.AppBarBg)
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_back),
                        contentDescription = "뒤로",
                        tint = AppColors.TextOnDark
                    )
                }
                Text(
                    text = "환자 수액 관리",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.TextOnDark
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

            HorizontalDivider(thickness = 0.5.dp, color = AppColors.InputBorder)

            // === Infusion Cards (scrollable) ===
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (bed.infusionCards.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "등록된 수액이 없습니다.",
                            fontSize = 14.sp,
                            color = AppColors.IconMuted
                        )
                    }
                } else {
                    bed.infusionCards.forEach { card ->
                        ManagementInfusionCard(
                            card = card,
                            room = room,
                            bed = bed,
                            viewModel = viewModel,
                            isHighlighted = card.assignmentId == selectedAssignmentId,
                            onDeleted = onDismiss,
                            onNavigateToChangeSpeed = {
                                onNavigateToChangeSpeed(room, bed, card)
                            },
                            onNavigateToChangeInfusion = {
                                onNavigateToChangeInfusion(room, bed, card)
                            },
                            onNavigateToChangeDevice = {
                                onNavigateToChangeDevice(room, bed, card)
                            }
                        )
                    }
                }
            }

            // === Bottom: End All Monitoring Button ===
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Button(
                    onClick = { showEndAllDialog = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppColors.FilterInactive
                    ),
                    border = BorderStroke(1.dp, MonitoringColors.BorderLight)
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_power),
                        contentDescription = null,
                        tint = MonitoringColors.FormLabel,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "퇴실",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = MonitoringColors.FormLabel
                    )
                }
            }
        }
    }

    // 전체 종료 확인 모달
    if (showEndAllDialog) {
        EndAllMonitoringDialog(
            onDismiss = { showEndAllDialog = false },
            onConfirm = {
                val ids = bed.allAssignmentIds
                viewModel.endAllMonitoring(
                    assignmentIds = ids,
                    onSuccess = {
                        showEndAllDialog = false
                        onDismiss()
                    },
                    onError = {
                        showEndAllDialog = false
                    }
                )
            }
        )
    }
}

// === Management Infusion Card ===
@Composable
private fun ManagementInfusionCard(
    card: InfusionCardUiModel,
    room: RoomUiModel,
    bed: BedUiModel,
    viewModel: PatientMonitoringViewModel,
    isHighlighted: Boolean,
    onDeleted: () -> Unit = {},
    onNavigateToChangeSpeed: () -> Unit = {},
    onNavigateToChangeInfusion: () -> Unit = {},
    onNavigateToChangeDevice: () -> Unit = {}
) {
    val isDeviceConnected = card.deviceId != null || !card.deviceName.isNullOrEmpty()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showCompleteDialog by remember { mutableStateOf(false) }

    // 기기 정보 조회 (이름 + 시리얼 번호)
    var lookedUpDeviceInfo by remember { mutableStateOf<DeviceInfo?>(null) }
    LaunchedEffect(card.deviceId) {
        if (card.deviceId != null) {
            viewModel.lookupDeviceById(
                deviceId = card.deviceId,
                onSuccess = { lookedUpDeviceInfo = it },
                onError = {},
                checkAvailability = false
            )
        }
    }
    val displayDeviceName = if (lookedUpDeviceInfo != null) {
        "${lookedUpDeviceInfo!!.name}(${lookedUpDeviceInfo!!.serialNumber})"
    } else if (!card.deviceName.isNullOrEmpty()) {
        card.deviceName
    } else if (isDeviceConnected) {
        "기기 #${card.deviceId}"
    } else {
        "기기 미연결"
    }
    val hasAlert = card.hasAlert

    // 정적 색상 (저사양 PDA 최적화: rememberInfiniteTransition 제거)
    val cardBgColor = Color.White
    val cardBorderColor = when {
        hasAlert && card.alertCategory == "critical" -> MonitoringColors.HeaderCriticalBorder
        hasAlert && card.alertCategory == "caution" -> MonitoringColors.HeaderCautionBorder
        hasAlert && card.alertCategory == "system_error" -> MonitoringColors.HeaderSystemErrorBorder
        else -> AppColors.InputBorder
    }
    val cardBorderWidth = if (hasAlert) 2.dp else 1.dp

    val textColor = when (card.alertCategory) {
        "critical" -> MonitoringColors.CriticalText
        "caution" -> MonitoringColors.CautionText
        "system_error" -> MonitoringColors.SystemErrorText
        else -> MonitoringColors.TextPrimary
    }
    val progressColor = when (card.alertCategory) {
        "critical" -> MonitoringColors.CriticalText
        "caution" -> MonitoringColors.CautionText
        "system_error" -> MonitoringColors.SystemErrorText
        else -> MonitoringColors.ProgressNormal
    }

    val alertLabel = if (card.alertType != null) MonitoringMapper.mapAlertLabel(card.alertType) else null
    val statusLabel = getStatusLabel(card.status)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(cardBgColor)
            .border(cardBorderWidth, cardBorderColor, RoundedCornerShape(16.dp))
    ) {
        // === Top: Progress bar + Infusion info ===
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 14.dp, end = 16.dp, top = 16.dp, bottom = 12.dp)
        ) {
            // Vertical segment progress bar (10 segments)
            ManagementProgressBar(
                percentage = card.percentage,
                filledColor = progressColor,
                modifier = Modifier.height(120.dp)
            )

            Spacer(modifier = Modifier.width(14.dp))

            // Infusion info
            Column(modifier = Modifier.weight(1f)) {
                // Title row: infusion name + status badge
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val infusionOptions by viewModel.infusionOptions.collectAsState()
                    val infusionLabel = remember(card.infusionType, infusionOptions) {
                        MonitoringMapper.resolveInfusionLabel(card.infusionType, infusionOptions)
                    }
                    Text(
                        text = infusionLabel,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        color = textColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Spacer(modifier = Modifier.width(8.dp))

                    // Status / Alert badge
                    if (alertLabel != null) {
                        val badgeBg = when (card.alertCategory) {
                            "critical" -> MonitoringColors.CriticalBg
                            "caution" -> MonitoringColors.CautionBg
                            "system_error" -> MonitoringColors.SystemErrorBg
                            else -> AppColors.FilterInactive
                        }
                        val badgeBorderColor2 = when (card.alertCategory) {
                            "critical" -> MonitoringColors.CriticalText
                            "caution" -> MonitoringColors.CautionText
                            "system_error" -> MonitoringColors.SystemErrorText
                            else -> Color.Transparent
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(badgeBg)
                                .border(1.dp, badgeBorderColor2, RoundedCornerShape(4.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = alertLabel,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = textColor
                            )
                        }
                    } else if (!isDeviceConnected) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(AppColors.FilterInactive)
                                .border(1.dp, AppColors.IconMuted, RoundedCornerShape(4.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = "미연결",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.IconDefault
                            )
                        }
                    } else {
                        val (sBg, sBorder, sColor) = getStatusColors(card.status)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(sBg)
                                .border(1.dp, sBorder, RoundedCornerShape(4.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = statusLabel,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = sColor
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))

                // Device name
                Text(
                    text = displayDeviceName,
                    fontSize = 13.sp,
                    color = if (isDeviceConnected) AppColors.ButtonSecondaryText else AppColors.IconMuted,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Info table: bordered box with rows
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(AppColors.SidebarBg)
                        .border(1.dp, AppColors.InputBorder, RoundedCornerShape(8.dp))
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    InfoRow(
                        label = "전체 수액",
                        value = if (card.totalVolume != null) "${card.totalVolume}ml" else "-"
                    )
                    InfoRow(
                        label = "투입량",
                        value = when {
                            card.percentage != null && card.currentVolume != null ->
                                "${kotlin.math.ceil(card.percentage).toInt()}% (${card.currentVolume}ml)"
                            card.currentVolume != null -> "${card.currentVolume}ml"
                            card.percentage != null -> "${kotlin.math.ceil(card.percentage).toInt()}%"
                            else -> "-"
                        }
                    )
                    InfoRow(
                        label = "속도",
                        value = if (card.ccHr != null) "${card.ccHr.toInt()} cc/hr" else "-"
                    )
                }
            }
        }

        // Dashed divider
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .padding(horizontal = 16.dp)
        ) {
            drawLine(
                color = MonitoringColors.BorderLight,
                start = Offset(0f, 0f),
                end = Offset(size.width, 0f),
                strokeWidth = 1.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 4f))
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Action buttons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (isDeviceConnected) {
                // 기기 연결됨: 속도변경(다크) / 수액교체 / 기기교체 / 투여완료
                ActionButton(
                    icon = R.drawable.ic_speed_change,
                    label = "속도변경",
                    tintColor = AppColors.TextOnDark,
                    bgColor = MonitoringColors.AppBarBg,
                    borderColor = MonitoringColors.AppBarBg,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToChangeSpeed
                )
            } else {
                // 기기 미연결: 삭제(빨강) / 수액교체 / 기기교체 / 투여완료
                ActionButton(
                    icon = R.drawable.ic_delete,
                    label = "삭제",
                    tintColor = AppColors.CriticalText,
                    bgColor = AppColors.CriticalBg,
                    borderColor = AppColors.CriticalBorder,
                    modifier = Modifier.weight(1f),
                    onClick = { showDeleteDialog = true }
                )
            }
            ActionButton(
                icon = R.drawable.ic_change_ringer,
                label = "수액교체",
                tintColor = MonitoringColors.GreenAccent,
                bgColor = MonitoringColors.GreenBg,
                borderColor = MonitoringColors.GreenLightBorder,
                modifier = Modifier.weight(1f),
                onClick = onNavigateToChangeInfusion
            )
            if (isDeviceConnected) {
                ActionButton(
                    icon = R.drawable.ic_device,
                    label = "기기교체",
                    tintColor = AppColors.SystemErrorText,
                    bgColor = AppColors.SystemErrorBg,
                    borderColor = AppColors.SystemErrorBorder,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToChangeDevice
                )
            } else {
                ActionButton(
                    icon = R.drawable.ic_device,
                    label = "기기 등록",
                    tintColor = AppColors.SystemErrorText,
                    bgColor = AppColors.SystemErrorBg,
                    borderColor = AppColors.SystemErrorBorder,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToChangeDevice
                )
            }
            ActionButton(
                icon = R.drawable.ic_done_ringer,
                label = "투여완료",
                tintColor = AppColors.IconDefault,
                bgColor = AppColors.FilterInactive,
                borderColor = AppColors.InputBorder,
                modifier = Modifier.weight(1f),
                onClick = { showCompleteDialog = true }
            )
        }
    }

    // 삭제 확인 모달
    if (showDeleteDialog) {
        DeleteInfusionDialog(
            onDismiss = { showDeleteDialog = false },
            onConfirm = {
                viewModel.clearInfusion(
                    assignmentId = card.assignmentId,
                    onSuccess = {
                        showDeleteDialog = false
                        onDeleted()
                    },
                    onError = {
                        showDeleteDialog = false
                    }
                )
            }
        )
    }

    // 투여완료 확인 모달
    if (showCompleteDialog) {
        CompleteInfusionDialog(
            onDismiss = { showCompleteDialog = false },
            onConfirm = {
                viewModel.clearInfusion(
                    assignmentId = card.assignmentId,
                    onSuccess = {
                        showCompleteDialog = false
                        onDeleted()
                    },
                    onError = {
                        showCompleteDialog = false
                    }
                )
            }
        )
    }

}

// === Delete Confirmation Dialog ===
@Composable
private fun DeleteInfusionDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    var isDeleting by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = { if (!isDeleting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .padding(top = 32.dp, bottom = 24.dp, start = 24.dp, end = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "선택하신 수액을 삭제하시겠습니까?",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    color = AppColors.TextPrimary
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "모니터링 대기 중인 수액을 삭제합니다.",
                    fontSize = 14.sp,
                    color = AppColors.IconMuted
                )

                Spacer(modifier = Modifier.height(28.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // 취소
                    Button(
                        onClick = { if (!isDeleting) onDismiss() },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppColors.FilterInactive
                        ),
                        border = BorderStroke(1.dp, MonitoringColors.BorderLight)
                    ) {
                        Text(
                            text = "취소",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.ButtonSecondaryText
                        )
                    }

                    // 삭제하기
                    Button(
                        onClick = {
                            isDeleting = true
                            onConfirm()
                        },
                        enabled = !isDeleting,
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppColors.ButtonDanger,
                            disabledContainerColor = AppColors.CriticalBorder
                        )
                    ) {
                        if (isDeleting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = AppColors.TextOnDark,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = "삭제하기",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.TextOnDark
                            )
                        }
                    }
                }
            }
        }
    }
}

// === Complete Infusion Confirmation Dialog ===
@Composable
private fun CompleteInfusionDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    var isCompleting by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = { if (!isCompleting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .padding(top = 32.dp, bottom = 24.dp, start = 24.dp, end = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "완료처리하시겠습니까?",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    color = AppColors.TextPrimary
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "이 작업은 되돌릴 수 없습니다.",
                    fontSize = 14.sp,
                    color = AppColors.IconMuted
                )

                Spacer(modifier = Modifier.height(28.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // 취소
                    Button(
                        onClick = { if (!isCompleting) onDismiss() },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppColors.FilterInactive
                        ),
                        border = BorderStroke(1.dp, MonitoringColors.BorderLight)
                    ) {
                        Text(
                            text = "취소",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.ButtonSecondaryText
                        )
                    }

                    // 완료하기
                    Button(
                        onClick = {
                            isCompleting = true
                            onConfirm()
                        },
                        enabled = !isCompleting,
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppColors.SystemErrorText,
                            disabledContainerColor = AppColors.SystemErrorBorder
                        )
                    ) {
                        if (isCompleting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = AppColors.TextOnDark,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = "완료하기",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.TextOnDark
                            )
                        }
                    }
                }
            }
        }
    }
}

// === End All Monitoring Confirmation Dialog ===
@Composable
private fun EndAllMonitoringDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    var isEnding by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = { if (!isEnding) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .padding(top = 32.dp, bottom = 24.dp, start = 24.dp, end = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "퇴실 처리 하시겠습니까?",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF1B1D1F)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "해당 환자의 모든 수액 투여가 완료 처리됩니다.",
                    fontSize = 14.sp,
                    color = Color(0xFF94A3B8)
                )

                Spacer(modifier = Modifier.height(28.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = { if (!isEnding) onDismiss() },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF1F5F9)
                        ),
                        border = BorderStroke(1.dp, Color(0xFFCBD5E1))
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
                            isEnding = true
                            onConfirm()
                        },
                        enabled = !isEnding,
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFDC2626),
                            disabledContainerColor = Color(0xFFFCA5A5)
                        )
                    ) {
                        if (isEnding) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = "퇴실",
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

// === Management Progress Bar (10 segments, vertical) ===
@Composable
private fun ManagementProgressBar(
    percentage: Double?,
    filledColor: Color,
    modifier: Modifier = Modifier
) {
    val totalSegments = 10
    val filledSegments = if (percentage != null) {
        kotlin.math.round(percentage / 10.0).toInt().coerceIn(0, totalSegments)
    } else 0

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        for (i in totalSegments downTo 1) {
            val isFilled = i <= filledSegments
            Box(
                modifier = Modifier
                    .width(24.dp)
                    .weight(1f)
                    .clip(RoundedCornerShape(2.dp))
                    .background(if (isFilled) filledColor else MonitoringColors.ProgressEmpty)
            )
        }
    }
}

// === Info Row (label left, value right) ===
@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = AppColors.IconDefault,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = AppColors.TextPrimary
        )
    }
}

// === Action Button ===
@Composable
private fun ActionButton(
    icon: Int,
    label: String,
    tintColor: Color,
    bgColor: Color,
    borderColor: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            painter = painterResource(id = icon),
            contentDescription = label,
            tint = tintColor,
            modifier = Modifier.size(22.dp)
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = tintColor
        )
    }
}

// === Status label ===
private fun getStatusLabel(status: String): String {
    return when (status) {
        "pending" -> "대기중"
        "active", "infusing" -> "투여중"
        "paused" -> "일시정지"
        "completed", "done" -> "완료"
        else -> status
    }
}

// === Status badge colors (bg, border, text) ===
private fun getStatusColors(status: String): Triple<Color, Color, Color> {
    return when (status) {
        "pending" -> Triple(AppColors.FilterInactive, MonitoringColors.BorderLight, AppColors.IconDefault)
        "active", "infusing" -> Triple(MonitoringColors.GreenBg, MonitoringColors.GreenBorder, MonitoringColors.GreenAccent)
        "paused" -> Triple(MonitoringColors.SidebarCautionBg, MonitoringColors.CautionYellow, AppColors.CautionText)
        "completed", "done" -> Triple(AppColors.SidebarBg, AppColors.InputBorder, AppColors.IconMuted)
        else -> Triple(AppColors.FilterInactive, AppColors.InputBorder, AppColors.IconDefault)
    }
}

