package kr.roopre.iringer_app.presentation.monitoring

import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.Gson
import com.google.gson.JsonObject
import kr.roopre.iringer_app.MainActivity
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.presentation.main.QrScanArea
import kr.roopre.iringer_app.presentation.main.ScanMode
import kr.roopre.iringer_app.ui.theme.AppColors

@Composable
internal fun ChangeDeviceScreen(
    room: RoomUiModel,
    bed: BedUiModel,
    card: InfusionCardUiModel,
    bedId: Int? = null,
    isRegistration: Boolean = false,
    viewModel: PatientMonitoringViewModel,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var tabIndex by remember { mutableIntStateOf(0) } // 0=QR 스캔, 1=기기 목록
    var scanMode by remember { mutableStateOf(ScanMode.IDLE) }

    // Hardware scanner
    val activity = LocalContext.current as? MainActivity
    val hasHardwareScanner = activity?.hasHardwareScanner ?: false
    val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    val scannerFocusRequester = remember { FocusRequester() }
    var scannerKeyboardInput by remember { mutableStateOf("") }

    // 현재 기기 정보
    var currentDevice by remember { mutableStateOf<DeviceInfo?>(null) }

    // 새 기기 정보
    var verifiedDevice by remember { mutableStateOf<DeviceInfo?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val isScanned = verifiedDevice != null

    // 기기 목록 탭용
    var filterQuery by remember { mutableStateOf("") }
    val wardDevices by viewModel.wardDevices.collectAsState()
    val wardDevicesLoading by viewModel.wardDevicesLoading.collectAsState()
    val wardDevicesError by viewModel.wardDevicesError.collectAsState()

    // Barcode handler (공통: 카메라 + 하드웨어 스캐너)
    val handleBarcode: (String) -> Unit = { barcode: String ->
        val decoded = try {
            if (barcode.contains(Regex("%[0-9A-Fa-f]{2}"))) android.net.Uri.decode(barcode) else barcode
        } catch (e: Exception) { barcode }

        fun lookupBySerial(serial: String) {
            viewModel.lookupDeviceBySerial(
                serialNumber = serial,
                onSuccess = { device ->
                    verifiedDevice = device
                    filterQuery = device.serialNumber
                    scanMode = ScanMode.IDLE
                    tabIndex = 1
                },
                onError = { msg ->
                    errorMessage = msg
                    Toast.makeText(activity, msg, Toast.LENGTH_SHORT).show()
                    scanMode = ScanMode.IDLE
                }
            )
        }

        var handled = false
        try {
            val data = Gson().fromJson(decoded, JsonObject::class.java)
            val qrType = data.get("type")?.asString
            if (qrType == "device") {
                val deviceId = data.get("device_id")?.asInt
                val serial = data.get("serial_number")?.asString
                if (deviceId != null) {
                    viewModel.lookupDeviceById(
                        deviceId = deviceId,
                        onSuccess = { device ->
                            verifiedDevice = device
                            filterQuery = device.serialNumber
                            scanMode = ScanMode.IDLE
                            tabIndex = 1
                        },
                        onError = { msg ->
                            errorMessage = msg
                            Toast.makeText(activity, msg, Toast.LENGTH_SHORT).show()
                            scanMode = ScanMode.IDLE
                        }
                    )
                    handled = true
                } else if (serial != null) {
                    lookupBySerial(serial)
                    handled = true
                }
            }
        } catch (_: Exception) { }

        if (!handled) {
            val regex = "serial_number\\s*:\\s*([^\\s]+)".toRegex(RegexOption.IGNORE_CASE)
            val match = regex.find(decoded)
            val serial = match?.groupValues?.get(1)
            if (!serial.isNullOrEmpty()) {
                lookupBySerial(serial)
            } else {
                Log.e("ChangeDevice", "QR 파싱 실패: $decoded")
                errorMessage = "올바른 기기 QR 코드가 아닙니다."
                scanMode = ScanMode.IDLE
            }
        }
    }

    // Scanner mode management (MainScreen과 동일 패턴)
    LaunchedEffect(scanMode) {
        when (scanMode) {
            ScanMode.SCANNER -> {
                activity?.externalBarcodeCallback = handleBarcode
                keyboardController?.hide()
                try { scannerFocusRequester.requestFocus() } catch (_: Exception) {}
                activity?.startScan()
            }
            ScanMode.CAMERA -> {
                activity?.externalBarcodeCallback = null
            }
            ScanMode.IDLE -> {
                activity?.externalBarcodeCallback = null
                try { activity?.stopScan() } catch (_: Exception) {}
            }
        }
    }

    // Cleanup on dispose
    DisposableEffect(Unit) {
        onDispose {
            activity?.externalBarcodeCallback = null
            try { activity?.stopScan() } catch (_: Exception) {}
        }
    }

    // 현재 기기 정보 로드 (이미 연결된 기기이므로 사용 중 체크 안 함)
    LaunchedEffect(card.deviceId) {
        if (card.deviceId != null) {
            viewModel.lookupDeviceById(
                deviceId = card.deviceId,
                onSuccess = { currentDevice = it },
                onError = { /* 현재 기기 정보 없어도 진행 가능 */ },
                checkAvailability = false
            )
        }
    }

    // 기기 목록 탭 진입 시 병동 기기 로드
    LaunchedEffect(tabIndex) {
        if (tabIndex == 1) {
            viewModel.loadWardDevices()
        }
    }

    // 클라이언트 필터링
    val filteredDevices = remember(wardDevices, filterQuery) {
        if (filterQuery.isBlank()) {
            wardDevices
        } else {
            wardDevices.filter { device ->
                device.name.contains(filterQuery, ignoreCase = true) ||
                    device.serialNumber.contains(filterQuery, ignoreCase = true)
            }
        }
    }

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
                    text = if (isRegistration) "기기 등록" else "기기 교체",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.TextOnDark
                )
            }

            // === 현재 기기 정보 섹션 ===
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(AppColors.SidebarBg)
                    .padding(horizontal = 20.dp, vertical = 14.dp)
            ) {
                Text(
                    text = "현재 기기 정보",
                    fontSize = 13.sp,
                    color = AppColors.IconDefault,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(AppColors.CardBg)
                        .border(1.dp, AppColors.InputBorder, RoundedCornerShape(12.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(AppColors.FilterInactive),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_device),
                            contentDescription = null,
                            tint = AppColors.IconDefault,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        Text(
                            text = card.deviceName ?: currentDevice?.name ?: "기기 미연결",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.TextPrimary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "S/N: ${currentDevice?.serialNumber ?: "-"}",
                                fontSize = 13.sp,
                                color = AppColors.IconMuted
                            )
                            if (card.batteryPercent != null) {
                                Spacer(modifier = Modifier.width(12.dp))
                                Icon(
                                    painter = painterResource(id = R.drawable.ic_device),
                                    contentDescription = null,
                                    tint = MonitoringColors.GreenAccent,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(2.dp))
                                Text(
                                    text = "${card.batteryPercent}%",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MonitoringColors.GreenAccent
                                )
                            }
                        }
                    }
                }
            }

            // === 탭 버튼 (QR 스캔 / 기기 목록) ===
            Row(modifier = Modifier.fillMaxWidth()) {
                listOf("QR 스캔", "기기 목록").forEachIndexed { index, label ->
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                tabIndex = index
                                if (index != 0) {
                                    scanMode = ScanMode.IDLE
                                }
                            },
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = label,
                            fontSize = 15.sp,
                            fontWeight = if (tabIndex == index) FontWeight.Bold else FontWeight.Normal,
                            color = if (tabIndex == index) MonitoringColors.FilterSelected else AppColors.IconMuted,
                            modifier = Modifier.padding(vertical = 10.dp)
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(
                                    if (tabIndex == index) MonitoringColors.FilterSelected else AppColors.InputBorder
                                )
                        )
                    }
                }
            }

            // === Content Area ===
            Box(
                modifier = Modifier.weight(1f),
                contentAlignment = Alignment.TopCenter
            ) {
                if (tabIndex == 0) {
                    // === QR 스캔 탭 ===
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 24.dp, vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        QrScanArea(
                            scanMode = scanMode,
                            isScanned = isScanned,
                            hasHardwareScanner = hasHardwareScanner,
                            guideText = "새로운 기기의 QR 코드를\n스캔해주세요",
                            fillRemainingSpace = true,
                            errorMessage = errorMessage,
                            onStartScannerScan = {
                                errorMessage = null
                                scanMode = ScanMode.SCANNER
                            },
                            onStartCameraScan = {
                                errorMessage = null
                                scanMode = ScanMode.CAMERA
                            },
                            onStopScan = {
                                scanMode = ScanMode.IDLE
                            },
                            onRescan = {
                                verifiedDevice = null
                                filterQuery = ""
                                scanMode = ScanMode.IDLE
                                errorMessage = null
                            },
                            onCameraBarcodeDetected = handleBarcode
                        )

                        // 숨겨진 키보드 입력 필드 (하드웨어 스캐너용)
                        OutlinedTextField(
                            value = scannerKeyboardInput,
                            onValueChange = { newValue ->
                                scannerKeyboardInput = newValue
                                if (newValue.length > 10) {
                                    handleBarcode(newValue)
                                    scannerKeyboardInput = ""
                                }
                            },
                            modifier = Modifier
                                .height(1.dp)
                                .width(1.dp)
                                .alpha(0f)
                                .focusRequester(scannerFocusRequester)
                                .onFocusChanged { focusState ->
                                    if (focusState.isFocused) {
                                        keyboardController?.hide()
                                    }
                                },
                            label = { },
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.None)
                        )
                    }
                } else {
                    // === 기기 목록 탭 ===
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 20.dp, vertical = 12.dp)
                    ) {
                        // 검색 필터
                        OutlinedTextField(
                            value = filterQuery,
                            onValueChange = { filterQuery = it },
                            placeholder = { Text("기기명 또는 시리얼 번호 검색", color = MonitoringColors.PlaceholderText) },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = null,
                                    tint = AppColors.IconDefault
                                )
                            },
                            trailingIcon = {
                                if (filterQuery.isNotEmpty()) {
                                    IconButton(onClick = { filterQuery = "" }) {
                                        Icon(
                                            imageVector = Icons.Default.Close,
                                            contentDescription = "지우기",
                                            tint = AppColors.IconDefault
                                        )
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                unfocusedBorderColor = MonitoringColors.InputBorderDisabled,
                                focusedBorderColor = MonitoringColors.AppBarBg
                            ),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // 로딩 상태
                        if (wardDevicesLoading) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        color = AppColors.IconDefault,
                                        strokeWidth = 2.dp
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "기기 목록 로딩 중...",
                                        fontSize = 13.sp,
                                        color = AppColors.IconDefault
                                    )
                                }
                            }
                        }

                        // 에러 상태
                        if (wardDevicesError != null) {
                            Text(
                                text = wardDevicesError!!,
                                fontSize = 12.sp,
                                color = AppColors.CriticalText,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }

                        // 기기 목록
                        if (!wardDevicesLoading) {
                            if (filteredDevices.isEmpty() && wardDevices.isNotEmpty()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 32.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "검색 결과가 없습니다.",
                                        fontSize = 14.sp,
                                        color = AppColors.IconMuted
                                    )
                                }
                            } else {
                                LazyColumn(
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    items(
                                        items = filteredDevices,
                                        key = { it.id }
                                    ) { device ->
                                        val isInUse = device.bedId != null
                                        val isSelected = verifiedDevice?.id == device.id
                                        WardDeviceCard(
                                            device = device,
                                            isInUse = isInUse,
                                            isSelected = isSelected,
                                            onClick = {
                                                if (!isInUse) {
                                                    verifiedDevice = device
                                                    errorMessage = null
                                                }
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // === Bottom Buttons ===
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
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
                        containerColor = AppColors.FilterInactive
                    ),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MonitoringColors.BorderLight)
                ) {
                    Text(
                        text = "취소",
                        fontSize = 15.sp,
                        color = AppColors.ButtonSecondaryText,
                        fontWeight = FontWeight.Medium
                    )
                }

                Button(
                    onClick = {
                        val device = verifiedDevice ?: return@Button
                        isSubmitting = true
                        errorMessage = null
                        viewModel.changeDevice(
                            assignmentId = card.assignmentId,
                            deviceId = device.id,
                            oldDeviceId = card.deviceId,
                            bedId = bedId,
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
                    enabled = verifiedDevice != null && !isSubmitting,
                    modifier = Modifier
                        .weight(2f)
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MonitoringColors.AppBarBg,
                        disabledContainerColor = AppColors.IconMuted
                    )
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = AppColors.TextOnDark,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = if (isRegistration) "기기 등록 완료" else "기기 변경 완료",
                            fontSize = 15.sp,
                            color = AppColors.TextOnDark,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WardDeviceCard(
    device: DeviceInfo,
    isInUse: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val borderColor = when {
        isSelected -> MonitoringColors.GreenBorder
        else -> AppColors.InputBorder
    }
    val borderWidth = if (isSelected) 1.5.dp else 1.dp

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.CardBg)
            .border(borderWidth, borderColor, RoundedCornerShape(12.dp))
            .then(
                if (!isInUse) Modifier.clickable(onClick = onClick)
                else Modifier
            )
            .alpha(if (isInUse) 0.5f else 1f)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 아이콘 박스
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (isSelected) MonitoringColors.GreenBg else AppColors.FilterInactive),
            contentAlignment = Alignment.Center
        ) {
            if (isSelected) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_done_ringer),
                    contentDescription = null,
                    tint = MonitoringColors.GreenAccent,
                    modifier = Modifier.size(24.dp)
                )
            } else {
                Icon(
                    painter = painterResource(id = R.drawable.ic_device),
                    contentDescription = null,
                    tint = AppColors.IconDefault,
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        // 기기 정보
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = device.name,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.TextPrimary
            )
            Spacer(modifier = Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "S/N: ${device.serialNumber}",
                    fontSize = 13.sp,
                    color = AppColors.IconMuted
                )
                if (device.batteryPercent != null) {
                    Spacer(modifier = Modifier.width(12.dp))
                    Icon(
                        painter = painterResource(id = R.drawable.ic_device),
                        contentDescription = null,
                        tint = MonitoringColors.GreenAccent,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(2.dp))
                    Text(
                        text = "${device.batteryPercent}%",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = MonitoringColors.GreenAccent
                    )
                }
            }
        }

        // 상태 뱃지
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(
                    if (isInUse) AppColors.CriticalBg
                    else MonitoringColors.GreenBg
                )
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = if (isInUse) "사용중" else "사용가능",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = if (isInUse) AppColors.CriticalText
                else MonitoringColors.GreenAccent
            )
        }
    }
}
