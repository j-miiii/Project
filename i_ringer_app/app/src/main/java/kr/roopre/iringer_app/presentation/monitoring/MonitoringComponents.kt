package kr.roopre.iringer_app.presentation.monitoring

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.roopre.iringer_app.R

// Shape 캐싱 (매 recomposition 새 객체 방지)
private val Shape3 = RoundedCornerShape(3.dp)
private val Shape6 = RoundedCornerShape(6.dp)

// === Filter Bar ===
@Composable
internal fun MonitoringFilterBar(
    totalCount: Int,
    normalCount: Int,
    alertCount: Int,
    selectedFilter: MonitoringFilter,
    onFilterSelect: (MonitoringFilter) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            label = "전체 $totalCount",
            isSelected = selectedFilter == MonitoringFilter.ALL,
            onClick = { onFilterSelect(MonitoringFilter.ALL) }
        )
        FilterChip(
            label = "정상 $normalCount",
            isSelected = selectedFilter == MonitoringFilter.NORMAL,
            onClick = { onFilterSelect(MonitoringFilter.NORMAL) }
        )
        Spacer(modifier = Modifier.weight(1f))
        Box(
            modifier = Modifier
                .clip(Shape6)
                .background(
                    if (selectedFilter == MonitoringFilter.ALERT) MonitoringColors.FilterAlert
                    else MonitoringColors.FilterInactive
                )
                .then(
                    if (selectedFilter != MonitoringFilter.ALERT)
                        Modifier.border(1.dp, MonitoringColors.FilterBorder, Shape6)
                    else Modifier
                )
                .clickable { onFilterSelect(MonitoringFilter.ALERT) }
                .padding(horizontal = 12.dp, vertical = 6.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_info_triangle),
                    contentDescription = null,
                    tint = if (selectedFilter == MonitoringFilter.ALERT) Color.White
                    else MonitoringColors.FilterAlert,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "이상 $alertCount",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (selectedFilter == MonitoringFilter.ALERT) Color.White
                    else MonitoringColors.FilterAlert
                )
            }
        }
    }
    HorizontalDivider(thickness = 0.5.dp, color = MonitoringColors.Divider)
}

@Composable
private fun FilterChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(Shape6)
            .background(if (isSelected) MonitoringColors.FilterSelected else MonitoringColors.FilterInactive)
            .then(
                if (!isSelected) Modifier.border(1.dp, MonitoringColors.FilterBorder, Shape6)
                else Modifier
            )
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = if (isSelected) Color.White else MonitoringColors.FilterInactiveText
        )
    }
}

// === Room Sidebar ===
@Composable
internal fun RoomSidebar(
    items: List<RoomSidebarItem>,
    selectedRoomId: Int?,
    onRoomSelect: (Int) -> Unit
) {
    val sidebarListState = rememberLazyListState()

    // 선택된 병실이 변경되면 사이드바도 해당 항목으로 스크롤
    LaunchedEffect(selectedRoomId) {
        val idx = items.indexOfFirst { it.roomId == selectedRoomId }
        if (idx >= 0) {
            sidebarListState.animateScrollToItem(idx)
        }
    }

    LazyColumn(
        state = sidebarListState,
        modifier = Modifier
            .width(72.dp)
            .fillMaxHeight()
            .background(Color.White)
            .border(width = 0.5.dp, color = MonitoringColors.Divider)
    ) {
        items(items, key = { it.roomId }) { item ->
            val isSelected = item.roomId == selectedRoomId

            val bgColor = when (item.worstAlertCategory) {
                "critical" -> MonitoringColors.SidebarCriticalBg
                "caution" -> MonitoringColors.SidebarCautionBg
                "system_error" -> MonitoringColors.SidebarSystemErrorBg
                else -> MonitoringColors.SidebarDefaultBg
            }
            val borderColor = when (item.worstAlertCategory) {
                "critical", "caution", "system_error" -> MonitoringColors.SidebarAlertBorder
                else -> MonitoringColors.SidebarDefaultBorder
            }
            val textColor = when (item.worstAlertCategory) {
                "critical" -> MonitoringColors.SidebarCriticalText
                "caution" -> MonitoringColors.SidebarCautionText
                "system_error" -> MonitoringColors.SidebarSystemErrorText
                else -> MonitoringColors.SidebarDefaultText
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(bgColor)
                    .border(
                        width = if (isSelected) 2.dp else 0.5.dp,
                        color = if (isSelected) textColor else borderColor
                    )
                    .clickable { onRoomSelect(item.roomId) }
                    .padding(vertical = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "${item.roomNumber}호",
                    fontSize = 13.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    color = textColor
                )
                Text(
                    text = "(${item.patientCount}/${item.totalBedCount})",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (isSelected) textColor.copy(alpha = 0.8f) else Color(0xFF94A3B8)
                )
            }
        }
    }
}

// === Flat list item for LazyColumn (bed-level 평탄화) ===
private sealed class MonitoringListItem {
    data class Header(val room: RoomUiModel) : MonitoringListItem()
    data class Bed(val room: RoomUiModel, val bed: BedUiModel) : MonitoringListItem()
}

// === Monitoring Content ===
@Composable
internal fun MonitoringContent(
    rooms: List<RoomUiModel>,
    selectedRoomId: Int?,
    volumeDisplayMode: String,
    onAddInfusion: (RoomUiModel, BedUiModel) -> Unit = { _, _ -> },
    onPatientClick: (RoomUiModel, BedUiModel, Int?) -> Unit = { _, _, _ -> },
    onVisibleRoomChange: (Int) -> Unit = {}
) {
    val listState = rememberLazyListState()

    // rooms → flat items 평탄화 + roomId→index 매핑 (rooms 변경 시에만 재계산)
    val (flatItems, roomIndexMap) = remember(rooms) {
        val items = mutableListOf<MonitoringListItem>()
        val indexMap = mutableMapOf<Int, Int>()
        for (room in rooms) {
            indexMap[room.roomId] = items.size
            items.add(MonitoringListItem.Header(room))
            for (bed in room.beds) {
                items.add(MonitoringListItem.Bed(room, bed))
            }
        }
        items to indexMap
    }

    // 사이드바 클릭 시 해당 호실 헤더로 스크롤
    LaunchedEffect(selectedRoomId) {
        val roomId = selectedRoomId ?: return@LaunchedEffect
        val idx = roomIndexMap[roomId] ?: return@LaunchedEffect
        if (listState.firstVisibleItemIndex == idx) return@LaunchedEffect
        listState.animateScrollToItem(idx)
    }

    // 콘텐츠 스크롤 시 현재 보이는 병실로 사이드바 연동
    val currentVisibleRoomId by remember {
        derivedStateOf {
            val firstIdx = listState.firstVisibleItemIndex
            for (i in firstIdx downTo 0) {
                val item = flatItems.getOrNull(i)
                if (item is MonitoringListItem.Header) return@derivedStateOf item.room.roomId
            }
            null
        }
    }
    LaunchedEffect(currentVisibleRoomId) {
        val roomId = currentVisibleRoomId ?: return@LaunchedEffect
        onVisibleRoomChange(roomId)
    }

    // 공유 블링크 애니메이션 1개 (카드마다 개별 생성하지 않음)
    val blinkTransition = rememberInfiniteTransition(label = "alertBlink")
    val rawBlinkAlpha = blinkTransition.animateFloat(
        initialValue = 1f,
        targetValue = 0.35f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = EaseInOut),
            repeatMode = RepeatMode.Reverse
        ),
        label = "blinkAlpha"
    )

    // 스크롤 중에는 블링크 멈춤 → draw 경쟁 제거 (저사양 PDA 핵심 최적화)
    val blinkAlpha: State<Float> = remember {
        derivedStateOf {
            if (listState.isScrollInProgress) 1f else rawBlinkAlpha.value
        }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier
            .fillMaxSize()
            .background(MonitoringColors.PageBg)
    ) {
        items(
            count = flatItems.size,
            key = { index ->
                when (val item = flatItems[index]) {
                    is MonitoringListItem.Header -> "header_${item.room.roomId}"
                    is MonitoringListItem.Bed -> "bed_${item.bed.bedId}"
                }
            },
            contentType = { index ->
                when (flatItems[index]) {
                    is MonitoringListItem.Header -> "header"
                    is MonitoringListItem.Bed -> "bed"
                }
            }
        ) { index ->
            when (val item = flatItems[index]) {
                is MonitoringListItem.Header -> {
                    RoomSectionHeader(room = item.room)
                }
                is MonitoringListItem.Bed -> {
                    PatientRow(
                        bed = item.bed,
                        volumeDisplayMode = volumeDisplayMode,
                        blinkAlpha = blinkAlpha,
                        onAddInfusion = { onAddInfusion(item.room, item.bed) },
                        onPatientClick = { onPatientClick(item.room, item.bed, null) },
                        onCardClick = { assignmentId -> onPatientClick(item.room, item.bed, assignmentId) }
                    )
                }
            }
        }
    }
}

// === Room Section Header ===
@Composable
private fun RoomSectionHeader(room: RoomUiModel) {
    val bgColor = when (room.worstAlertCategory) {
        "critical" -> MonitoringColors.HeaderCriticalBg
        "caution" -> MonitoringColors.HeaderCautionBg
        "system_error" -> MonitoringColors.HeaderSystemErrorBg
        else -> MonitoringColors.HeaderDefaultBg
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(bgColor)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "${room.roomNumber}호",
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            color = Color(0xFF1F2937)
        )
        Spacer(modifier = Modifier.weight(1f))
        if (room.nurseName != null) {
            Box(
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.6f), Shape3)
                    .border(1.dp, Color.Black.copy(alpha = 0.05f), Shape3)
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = room.nurseName,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF111827)
                    )
                    Spacer(modifier = Modifier.width(2.dp))
                    Text(
                        text = "간호사",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF64748B)
                    )
                }
            }
        } else {
            Box(
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.4f), Shape3)
                    .border(1.dp, Color.Black.copy(alpha = 0.05f), Shape3)
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = "미배정",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF94A3B8)
                )
            }
        }
    }
}

// === Patient Row ===
@Composable
private fun PatientRow(
    bed: BedUiModel,
    volumeDisplayMode: String = "percentage",
    blinkAlpha: State<Float>,
    onAddInfusion: () -> Unit = {},
    onPatientClick: () -> Unit = {},
    onCardClick: (Int) -> Unit = {}
) {
    val hasPatient = bed.patientName != null

    // 빈 침상 (환자 없음)
    if (!hasPatient) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(68.dp)
                .background(Color(0xFFF8FAFC))
                .border(width = 0.5.dp, color = MonitoringColors.Divider)
                .clickable { onPatientClick() }
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = bed.bedNumber,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFCBD5E1),
                modifier = Modifier.width(22.dp)
            )
            Text(
                text = "빈 침상",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF94A3B8)
            )
        }
        return
    }

    val subText = bed.subText
    val bedAlertCategory = bed.worstAlertCategory

    val rowBgColor = when (bedAlertCategory) {
        "critical" -> MonitoringColors.CriticalBg
        "caution" -> MonitoringColors.CautionBg
        "system_error" -> MonitoringColors.SystemErrorBg
        else -> Color.White
    }
    val rowBorderColor = when (bedAlertCategory) {
        "critical" -> MonitoringColors.CriticalBorder
        "caution" -> MonitoringColors.CautionBorder
        "system_error" -> MonitoringColors.SystemErrorBorder
        else -> MonitoringColors.Divider
    }
    val bedNumberColor = when (bedAlertCategory) {
        "critical" -> MonitoringColors.HeaderCriticalBorder
        "caution" -> MonitoringColors.HeaderCautionBorder
        "system_error" -> MonitoringColors.HeaderSystemErrorBorder
        else -> MonitoringColors.TextPrimary
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(rowBgColor)
            .border(width = if (bedAlertCategory != null) 1.dp else 0.5.dp, color = rowBorderColor)
            .clickable { onPatientClick() }
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier.width(80.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = bed.bedNumber,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = bedNumberColor,
                modifier = Modifier.width(22.dp)
            )
            Column {
                Text(
                    text = bed.patientName ?: "-",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MonitoringColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (subText.isNotEmpty()) {
                    Text(
                        text = subText,
                        fontSize = 11.sp,
                        color = MonitoringColors.TextTertiary
                    )
                }
            }
        }

        Row(
            modifier = Modifier.weight(1f).height(68.dp),
            horizontalArrangement = Arrangement.Start
        ) {
            val maxCards = 3
            bed.infusionCards.take(maxCards).forEach { card ->
                InfusionCard(
                    card = card,
                    volumeDisplayMode = volumeDisplayMode,
                    blinkAlpha = blinkAlpha,
                    modifier = Modifier.weight(1f),
                    onCardClick = { onCardClick(card.assignmentId) }
                )
            }
            val remaining = maxCards - bed.infusionCards.size
            if (remaining > 0) {
                repeat(remaining) {
                    EmptyInfusionSlot(modifier = Modifier.weight(1f), onClick = onAddInfusion)
                }
            }
        }
    }
}

// === Segment Progress Bar (Canvas 1개로 10세그먼트 직접 그리기) ===
@Composable
private fun SegmentProgressBar(
    percentage: Double?,
    filledColor: Color,
    modifier: Modifier = Modifier
) {
    val totalSegments = 10
    val filledSegments = if (percentage != null) {
        kotlin.math.floor(percentage / 10.0).toInt().coerceIn(0, totalSegments)
    } else 0
    val emptyColor = MonitoringColors.ProgressEmpty
    val cornerRadius = CornerRadius(2f, 2f)

    Canvas(
        modifier = modifier
            .width(14.dp)
            .fillMaxHeight()
    ) {
        val gapPx = 1.dp.toPx()
        val totalGap = gapPx * (totalSegments - 1)
        val segH = (size.height - totalGap) / totalSegments
        val segW = size.width

        for (i in 0 until totalSegments) {
            // i=0이 상단(10번 세그먼트), i=9가 하단(1번 세그먼트)
            val segIndex = totalSegments - i  // 10, 9, 8, ... 1
            val isFilled = segIndex <= filledSegments
            val y = i * (segH + gapPx)

            drawRoundRect(
                color = if (isFilled) filledColor else emptyColor,
                topLeft = Offset(0f, y),
                size = Size(segW, segH),
                cornerRadius = cornerRadius
            )
        }
    }
}

// === Infusion Card ===
@Composable
private fun InfusionCard(
    card: InfusionCardUiModel,
    volumeDisplayMode: String = "percentage",
    blinkAlpha: State<Float>,
    modifier: Modifier = Modifier,
    onCardClick: () -> Unit = {}
) {
    val hasAlert = card.hasAlert
    val cat = card.alertCategory
    val isDeviceDisconnected = card.deviceId == null && card.deviceName.isNullOrEmpty()

    // 색상 한번에 결정
    val cardBgColor: Color
    val cardBorderColor: Color
    val textColor: Color
    val progressColor: Color
    when {
        cat == "critical" -> {
            cardBgColor = MonitoringColors.HeaderCriticalBg
            cardBorderColor = MonitoringColors.HeaderCriticalBorder
            textColor = MonitoringColors.CriticalText
            progressColor = MonitoringColors.CriticalText
        }
        cat == "caution" -> {
            cardBgColor = MonitoringColors.HeaderCautionBg
            cardBorderColor = MonitoringColors.HeaderCautionBorder
            textColor = MonitoringColors.CautionText
            progressColor = MonitoringColors.CautionText
        }
        cat == "system_error" -> {
            cardBgColor = MonitoringColors.HeaderSystemErrorBg
            cardBorderColor = MonitoringColors.HeaderSystemErrorBorder
            textColor = MonitoringColors.SystemErrorText
            progressColor = MonitoringColors.SystemErrorText
        }
        isDeviceDisconnected -> {
            cardBgColor = MonitoringColors.DisconnectedBg
            cardBorderColor = MonitoringColors.DisconnectedBorder
            textColor = MonitoringColors.DisconnectedText
            progressColor = MonitoringColors.DisconnectedText
        }
        else -> {
            cardBgColor = MonitoringColors.CardDefaultBg
            cardBorderColor = MonitoringColors.CardDefaultBorder
            textColor = MonitoringColors.TextSecondary
            progressColor = MonitoringColors.ProgressNormal
        }
    }

    val volumeText = if (volumeDisplayMode == "ml") {
        when {
            card.currentVolume != null -> "${card.currentVolume}ml"
            card.totalVolume != null -> "${card.totalVolume}ml"
            else -> ""
        }
    } else {
        when {
            card.percentage != null -> "${kotlin.math.ceil(card.percentage).toInt()}%"
            card.totalVolume != null -> "${card.totalVolume}ml"
            else -> ""
        }
    }

    Row(
        modifier = modifier
            .height(68.dp)
            .graphicsLayer { alpha = if (hasAlert) blinkAlpha.value else 1f }
            .background(cardBgColor)
            .border(if (hasAlert) 2.dp else 1.dp, cardBorderColor)
            .clickable { onCardClick() }
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        SegmentProgressBar(
            percentage = card.percentage,
            filledColor = progressColor
        )

        Spacer(modifier = Modifier.width(4.dp))

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .padding(start = 2.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            val alertLabel = card.alertLabel
            if (hasAlert && alertLabel != null) {
                Box(
                    modifier = Modifier
                        .clip(Shape3)
                        .background(cardBgColor)
                        .border(1.dp, textColor, Shape3)
                        .padding(horizontal = 4.dp, vertical = 2.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = alertLabel,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = textColor,
                        maxLines = 1
                    )
                }
            } else if (isDeviceDisconnected) {
                Text(
                    text = card.infusionCode,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = textColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Box(
                    modifier = Modifier
                        .clip(Shape3)
                        .background(MonitoringColors.DisconnectedBg)
                        .border(1.dp, MonitoringColors.DisconnectedText, Shape3)
                        .padding(horizontal = 4.dp, vertical = 2.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "미연결",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MonitoringColors.DisconnectedText,
                        maxLines = 1
                    )
                }
            } else {
                Text(
                    text = card.infusionCode,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = textColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (volumeText.isNotEmpty()) {
                    Text(
                        text = volumeText,
                        fontSize = 11.sp,
                        color = textColor,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

// === Empty Infusion Slot ===
@Composable
internal fun EmptyInfusionSlot(modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
    Box(
        modifier = modifier
            .height(68.dp)
            .border(1.dp, MonitoringColors.CardDefaultBorder)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                painter = painterResource(id = R.drawable.ic_add_ringer),
                contentDescription = "추가",
                tint = Color.Unspecified,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "추가",
                fontSize = 10.sp,
                color = MonitoringColors.TextTertiary
            )
        }
    }
}
