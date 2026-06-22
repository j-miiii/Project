package kr.roopre.iringer_app.presentation.monitoring

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import com.google.gson.Gson
import com.google.gson.JsonObject
import kr.roopre.iringer_app.MainActivity
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.presentation.main.QrScanArea
import kr.roopre.iringer_app.presentation.main.ScanMode
import kr.roopre.iringer_app.ui.theme.AppColors

// === Add Infusion Dialog ===
@Composable
internal fun AddInfusionDialog(
    roomNumber: String,
    bedNumber: String,
    patientName: String,
    gender: String,
    age: String,
    bedId: Int,
    patientId: Int?,
    viewModel: PatientMonitoringViewModel,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var tabIndex by remember { mutableIntStateOf(1) } // 0=QR 스캔, 1=수동 입력
    var scanMode by remember { mutableStateOf(ScanMode.IDLE) }

    // Hardware scanner
    val activity = LocalContext.current as? MainActivity
    val hasHardwareScanner = activity?.hasHardwareScanner ?: false
    val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    val scannerFocusRequester = remember { FocusRequester() }
    var scannerKeyboardInput by remember { mutableStateOf("") }

    // 수동 입력 필드
    var infusionType by remember { mutableStateOf("") }
    var infusionVolume by remember { mutableStateOf("") }
    var infusionGtt by remember { mutableStateOf("") }
    var dropdownExpanded by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isQrScanned by remember { mutableStateOf(false) }

    // Barcode handler (공통: 카메라 + 하드웨어 스캐너)
    val handleBarcode: (String) -> Unit = { barcode: String ->
        val decoded = try {
            if (barcode.contains(Regex("%[0-9A-Fa-f]{2}"))) android.net.Uri.decode(barcode) else barcode
        } catch (e: Exception) { barcode }
        try {
            val data = Gson().fromJson(decoded, JsonObject::class.java)
            val qrType = data.get("type")?.asString

            when (qrType) {
                "infusion" -> {
                    val assignmentId = data.get("assignment_id")?.asInt
                    if (assignmentId != null) {
                        viewModel.fetchInfusionByAssignmentId(
                            assignmentId = assignmentId,
                            onSuccess = { infType, infVol, infGtt ->
                                infusionType = infType
                                infusionVolume = infVol.toString()
                                infusionGtt = infGtt.toString()
                                isQrScanned = true
                                scanMode = ScanMode.IDLE
                                tabIndex = 1
                            },
                            onError = { msg ->
                                errorMessage = msg
                                scanMode = ScanMode.IDLE
                            }
                        )
                    } else {
                        errorMessage = "올바른 수액 QR 코드가 아닙니다."
                        scanMode = ScanMode.IDLE
                    }
                }
                "patient" -> {
                    errorMessage = "환자 QR 코드입니다. 수액 QR 코드를 스캔해주세요."
                    scanMode = ScanMode.IDLE
                }
                else -> {
                    errorMessage = "올바른 수액 QR 코드가 아닙니다."
                    scanMode = ScanMode.IDLE
                }
            }
        } catch (e: Exception) {
            Log.e("AddInfusion", "QR 파싱 실패", e)
            errorMessage = "QR 코드를 인식할 수 없습니다."
            scanMode = ScanMode.IDLE
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

    // 서버에서 수액 프리셋 로드
    val serverInfusionOptions by viewModel.infusionOptions.collectAsState()
    val infusionOptionsLoading by viewModel.infusionOptionsLoading.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadInfusionOptions()
    }

    // 수액 옵션 로드 (자동 선택 없음 - 미선택이 기본)
    LaunchedEffect(serverInfusionOptions) {
    }

    val subText = if (gender.isNotEmpty() && age.isNotEmpty()) "$gender/$age" else "$gender$age"

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
            // Top bar
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
                    text = "수액 추가",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.TextOnDark
                )
            }

            // === 환자 정보 섹션 ===
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(AppColors.SidebarBg)
                    .padding(horizontal = 20.dp, vertical = 10.dp)
            ) {
                Text(
                    text = "환자 정보",
                    fontSize = 13.sp,
                    color = AppColors.IconDefault,
                    modifier = Modifier.padding(bottom = 6.dp)
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(AppColors.CardBg)
                        .border(1.dp, AppColors.InputBorder, RoundedCornerShape(12.dp))
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(AppColors.FilterInactive),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = AppColors.IconDefault,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Text(
                        text = patientName,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppColors.TextPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "${roomNumber}호 ${bedNumber}번 침상" + if (subText.isNotEmpty()) " · $subText" else "",
                        fontSize = 13.sp,
                        color = AppColors.IconMuted
                    )
                }
            }

            // 탭 버튼 (QR 스캔 / 수동 입력) - MainScreen 패턴
            Row(
                modifier = Modifier.fillMaxWidth()
            ) {
                listOf("QR 스캔", "수동 입력").forEachIndexed { index, label ->
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

            // Content area
            Box(
                modifier = Modifier
                    .weight(1f),
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
                            isScanned = isQrScanned,
                            hasHardwareScanner = hasHardwareScanner,
                            guideText = "새로운 수액의 QR 코드를\n스캔해주세요",
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
                                infusionType = ""
                                infusionVolume = ""
                                infusionGtt = ""
                                isQrScanned = false
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
                    // === 수동 입력 탭 ===
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(20.dp)
                    ) {
                        // 수액 종류
                        Text(
                            text = "수액 종류",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = MonitoringColors.FormLabel,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                        Box {
                            OutlinedTextField(
                                value = infusionType,
                                onValueChange = {},
                                readOnly = true,
                                enabled = false,
                                placeholder = {
                                    Text(
                                        if (infusionOptionsLoading) "로딩 중..." else "수액 종류 선택",
                                        color = MonitoringColors.PlaceholderText
                                    )
                                },
                                trailingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.ArrowDropDown,
                                        contentDescription = "선택"
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    disabledTextColor = AppColors.TextPrimary,
                                    disabledContainerColor = Color.White,
                                    disabledBorderColor = MonitoringColors.InputBorderDisabled,
                                    disabledTrailingIconColor = MonitoringColors.IconDisabled,
                                    disabledPlaceholderColor = MonitoringColors.PlaceholderText
                                ),
                                singleLine = true
                            )
                            // 전체 컨테이너 클릭 영역
                            Box(
                                modifier = Modifier
                                    .matchParentSize()
                                    .clickable {
                                        searchQuery = ""
                                        dropdownExpanded = true
                                    }
                            )
                            DropdownMenu(
                                expanded = dropdownExpanded,
                                onDismissRequest = { dropdownExpanded = false },
                                modifier = Modifier
                                    .fillMaxWidth(0.9f)
                                    .heightIn(max = 350.dp)
                                    .background(Color.White),
                                offset = androidx.compose.ui.unit.DpOffset(0.dp, (-200).dp)
                            ) {
                                // 검색 입력 필드
                                OutlinedTextField(
                                    value = searchQuery,
                                    onValueChange = { searchQuery = it },
                                    placeholder = { Text("검색", color = MonitoringColors.PlaceholderText, fontSize = 14.sp) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 4.dp),
                                    shape = RoundedCornerShape(8.dp),
                                    singleLine = true,
                                    textStyle = TextStyle(fontSize = 14.sp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MonitoringColors.AppBarBg,
                                        unfocusedBorderColor = MonitoringColors.InputBorderDisabled,
                                        unfocusedContainerColor = Color.White,
                                        focusedContainerColor = Color.White
                                    )
                                )

                                val filtered = serverInfusionOptions.filter { option ->
                                    searchQuery.isEmpty() ||
                                    option.name.contains(searchQuery, ignoreCase = true) ||
                                    option.label.contains(searchQuery, ignoreCase = true)
                                }

                                if (filtered.isEmpty()) {
                                    DropdownMenuItem(
                                        text = { Text("검색 결과 없음", color = MonitoringColors.PlaceholderText) },
                                        onClick = {},
                                        enabled = false
                                    )
                                } else {
                                    filtered.forEachIndexed { index, option ->
                                        DropdownMenuItem(
                                            text = { Text(option.label) },
                                            onClick = {
                                                infusionType = option.name
                                                infusionVolume = (option.defaultVolume).toString()
                                                searchQuery = ""
                                                dropdownExpanded = false
                                            }
                                        )
                                        if (index < filtered.size - 1) {
                                            HorizontalDivider(
                                                color = Color(0xFFF1F5F9),
                                                thickness = 1.dp,
                                                modifier = Modifier.padding(horizontal = 12.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // 전체 용량
                        Text(
                            text = "전체 용량 (ml)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = MonitoringColors.FormLabel,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                        OutlinedTextField(
                            value = infusionVolume,
                            onValueChange = { infusionVolume = it.filter { c -> c.isDigit() } },
                            placeholder = { Text("용량 입력", color = MonitoringColors.PlaceholderText) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = OutlinedTextFieldDefaults.colors(
                                unfocusedBorderColor = MonitoringColors.InputBorderDisabled,
                                focusedBorderColor = MonitoringColors.AppBarBg
                            ),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // 전체 용량 빠른 선택 버튼
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf("250", "500", "1000").forEach { volValue ->
                                val isSelected = infusionVolume == volValue
                                Button(
                                    onClick = { infusionVolume = volValue },
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
                                        text = volValue,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSelected) Color.White else Color(0xFF1B1D1F)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // 처방 속도
                        Text(
                            text = "처방 속도 (cc/hr)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = MonitoringColors.FormLabel,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )

                        // 직접 입력 필드
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, MonitoringColors.InputBorderDisabled, RoundedCornerShape(8.dp))
                                .padding(horizontal = 16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                BasicTextField(
                                    value = infusionGtt,
                                    onValueChange = { value ->
                                        val filtered = value.filter { it.isDigit() }
                                        if (filtered.length <= 4) {
                                            infusionGtt = filtered
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
                                            if (infusionGtt.isEmpty()) {
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


                        // Error message
                        if (errorMessage != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = errorMessage!!,
                                fontSize = 12.sp,
                                color = AppColors.CriticalText
                            )
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        // Bottom buttons (스크롤 영역 내부 - 키보드 시 스크롤하여 접근)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Button(
                                onClick = onDismiss,
                                modifier = Modifier.weight(1f).height(48.dp),
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
                                    if (infusionType.isEmpty()) {
                                        errorMessage = "수액 종류를 선택해주세요."
                                        return@Button
                                    }
                                    if (infusionVolume.isEmpty()) {
                                        errorMessage = "전체 용량을 입력해주세요."
                                        return@Button
                                    }
                                    if (infusionGtt.isEmpty()) {
                                        errorMessage = "처방 속도를 입력해주세요."
                                        return@Button
                                    }
                                    isSubmitting = true
                                    errorMessage = null

                                    val data = JsonObject().apply {
                                        addProperty("bed_id", bedId)
                                        if (patientId != null) {
                                            addProperty("patient_id", patientId)
                                        }
                                        addProperty("infusion_type", infusionType)
                                        addProperty("infusion_total_volume", infusionVolume.toIntOrNull() ?: 0)
                                        addProperty("infusion_cchr", infusionGtt.toIntOrNull() ?: 0)
                                        addProperty("status", "pending")
                                    }

                                    viewModel.insertInfusion(
                                        data = data,
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
                                modifier = Modifier.weight(2f).height(48.dp),
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
                                        text = "추가하기",
                                        fontSize = 15.sp,
                                        color = AppColors.TextOnDark,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            }

            // Bottom buttons (QR 탭에서만 고정 표시)
            if (tabIndex == 0) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f).height(48.dp),
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
                        if (infusionType.isEmpty()) {
                            errorMessage = "수액 종류를 선택해주세요."
                            return@Button
                        }
                        if (infusionVolume.isEmpty()) {
                            errorMessage = "전체 용량을 입력해주세요."
                            return@Button
                        }
                        if (infusionGtt.isEmpty()) {
                            errorMessage = "처방 속도를 입력해주세요."
                            return@Button
                        }
                        isSubmitting = true
                        errorMessage = null

                        val data = JsonObject().apply {
                            addProperty("bed_id", bedId)
                            if (patientId != null) {
                                addProperty("patient_id", patientId)
                            }
                            addProperty("infusion_type", infusionType)
                            addProperty("infusion_total_volume", infusionVolume.toIntOrNull() ?: 0)
                            addProperty("infusion_cchr", infusionGtt.toIntOrNull() ?: 0)
                            addProperty("status", "pending")
                        }

                        viewModel.insertInfusion(
                            data = data,
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
                    enabled = !isSubmitting && (tabIndex == 1 || isQrScanned),
                    modifier = Modifier.weight(2f).height(48.dp),
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
                            text = "추가하기",
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
}
