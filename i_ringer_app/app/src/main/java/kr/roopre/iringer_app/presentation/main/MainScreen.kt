package kr.roopre.iringer_app.presentation.main

import android.net.Uri
import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.runtime.collectAsState
import kr.roopre.iringer_app.MainActivity
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.data.manager.UserManager
import com.google.gson.Gson
import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.remote.dto.DeviceResponse

enum class SectionState {
    INACTIVE,    // 아직 도달 안함
    ACTIVE,      // 현재 진행 중
    COMPLETED    // 완료됨
}

// 커스텀 Toast Composable
@Composable
fun CustomToast(
    message: String,
    isSuccess: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .wrapContentWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSuccess) Color(0xFF616161) else Color(0xFFFF3E3E)
        )
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 24.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (!isSuccess) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_warning),
                    contentDescription = "경고",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = message,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

// 스캔 오버레이 (가운데 스캔 영역 + 외곽 딤 + 코너 브라켓 + 스캔 라인)
@Composable
private fun ScanOverlay() {
    val infiniteTransition = rememberInfiniteTransition(label = "scanLine")
    val scanLineProgress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scanLineProgress"
    )

    BoxWithConstraints(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        val squareSize = minOf(maxWidth, maxHeight) - 32.dp

        // 외곽 딤 처리 (스캔 영역 바깥을 어둡게)
        Canvas(modifier = Modifier.fillMaxSize()) {
            val totalW = size.width
            val totalH = size.height
            val sq = squareSize.toPx()
            val left = (totalW - sq) / 2
            val top = (totalH - sq) / 2

            // 상단 딤
            drawRect(Color(0xAA000000), Offset.Zero, Size(totalW, top))
            // 하단 딤
            drawRect(Color(0xAA000000), Offset(0f, top + sq), Size(totalW, totalH - top - sq))
            // 좌측 딤
            drawRect(Color(0xAA000000), Offset(0f, top), Size(left, sq))
            // 우측 딤
            drawRect(Color(0xAA000000), Offset(left + sq, top), Size(totalW - left - sq, sq))
        }

        // 가운데 스캔 영역
        Box(
            modifier = Modifier.size(squareSize),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val s = size.width
                val cornerLen = 30.dp.toPx()
                val strokeW = 3.dp.toPx()

                // 코너 브라켓 (좌상)
                drawLine(Color.White, Offset(0f, cornerLen), Offset(0f, 0f), strokeW)
                drawLine(Color.White, Offset(0f, 0f), Offset(cornerLen, 0f), strokeW)
                // 우상
                drawLine(Color.White, Offset(s - cornerLen, 0f), Offset(s, 0f), strokeW)
                drawLine(Color.White, Offset(s, 0f), Offset(s, cornerLen), strokeW)
                // 좌하
                drawLine(Color.White, Offset(0f, s - cornerLen), Offset(0f, s), strokeW)
                drawLine(Color.White, Offset(0f, s), Offset(cornerLen, s), strokeW)
                // 우하
                drawLine(Color.White, Offset(s - cornerLen, s), Offset(s, s), strokeW)
                drawLine(Color.White, Offset(s, s - cornerLen), Offset(s, s), strokeW)

                // 스캔 라인 (파란색)
                val lineY = s * scanLineProgress
                drawLine(
                    color = Color(0xFF38BDF8),
                    start = Offset(0f, lineY),
                    end = Offset(s, lineY),
                    strokeWidth = 2.dp.toPx()
                )
            }

            // 가운데 안내 텍스트
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_qr),
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "스캔 영역에 맞춰주세요",
                    fontSize = 12.sp,
                    color = Color.White.copy(alpha = 0.7f)
                )
            }
        }
    }
}

enum class ScanMode { IDLE, SCANNER, CAMERA }

// QR 스캔 영역 + 버튼 재사용 컴포넌트
@Composable
fun QrScanArea(
    scanMode: ScanMode,
    isScanned: Boolean,
    hasHardwareScanner: Boolean,
    guideText: String,
    onStartScannerScan: () -> Unit,
    onStartCameraScan: () -> Unit,
    onStopScan: () -> Unit,
    onRescan: () -> Unit,
    onCameraBarcodeDetected: ((String) -> Unit)? = null,
    fillRemainingSpace: Boolean = false,
    errorMessage: String? = null,
) {
    val isScanning = scanMode != ScanMode.IDLE
    val wrapperModifier = if (fillRemainingSpace) Modifier.fillMaxSize() else Modifier.fillMaxWidth()

    Column(modifier = wrapperModifier) {
        val scanBoxModifier = if (fillRemainingSpace) {
            Modifier.fillMaxWidth().weight(1f)
        } else {
            Modifier.fillMaxWidth().aspectRatio(1f)
        }

        // 스캔 영역 박스
        if (scanMode == ScanMode.CAMERA) {
            Box(
                modifier = scanBoxModifier
                    .background(Color(0xFF1E293B), RoundedCornerShape(8.dp))
            ) {
                if (onCameraBarcodeDetected != null) {
                    CameraQrPreview(onBarcodeDetected = onCameraBarcodeDetected)
                }
                ScanOverlay()
            }
        } else if (scanMode == ScanMode.SCANNER) {
            Box(
                modifier = scanBoxModifier
                    .background(Color(0xFF1E293B), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                ScanOverlay()
            }
        } else if (!isScanned) {
            Box(
                modifier = scanBoxModifier
                    .background(Color(0xFFF1F5F9), RoundedCornerShape(8.dp))
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_qr),
                        contentDescription = null,
                        tint = Color(0xFF94A3B8),
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = guideText,
                        fontSize = 14.sp,
                        color = Color(0xFF64748B),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        // 스캔 버튼
        Spacer(modifier = Modifier.height(10.dp))
        if (isScanning) {
            // 스캔 중: 취소 버튼 + 프로그레스
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = { onStopScan() },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFE53935),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f).height(48.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp)
                ) {
                    Text(
                        text = "스캔 취소",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                CircularProgressIndicator(
                    modifier = Modifier.size(22.dp),
                    color = Color(0xFF009EE6),
                    strokeWidth = 2.5.dp
                )
            }
        } else if (isScanned) {
            // 스캔 완료: 다시 스캔하기 버튼
            Button(
                onClick = { onRescan() },
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF334155),
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, Color(0xFF64748B)),
                modifier = Modifier.fillMaxWidth().height(48.dp),
                contentPadding = PaddingValues(horizontal = 12.dp)
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_qr),
                    contentDescription = "다시 스캔하기",
                    modifier = Modifier.size(16.dp),
                    tint = Color.White
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "다시 스캔하기",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        } else {
            // IDLE + 미스캔: 활성화 버튼
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (hasHardwareScanner) {
                    Button(
                        onClick = { onStartScannerScan() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF009EE6),
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f).height(48.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp)
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_qr),
                            contentDescription = "스캐너",
                            modifier = Modifier.size(16.dp),
                            tint = Color.White
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "스캐너",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1
                        )
                    }
                }
                Button(
                    onClick = { onStartCameraScan() },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF009EE6),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f).height(48.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp)
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_qr),
                        contentDescription = "카메라",
                        modifier = Modifier.size(16.dp),
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "카메라",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1
                    )
                }
            }
        }

        // 에러 메시지
        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = errorMessage,
                fontSize = 12.sp,
                color = Color(0xFFDC2626),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// 스텝 인디케이터 (좌측 사각 컨테이너)
@Composable
private fun StepIndicator(
    currentStep: Int,
    totalSteps: Int,
    stepLabels: List<String>,
    stepStates: List<SectionState>,
    onStepClick: (Int) -> Unit
) {
    Column(
        modifier = Modifier
            .width(71.dp)
            .fillMaxHeight()
            .background(Color(0xFFF8FAFC)),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        for (i in 1..totalSteps) {
            val state = stepStates.getOrNull(i - 1) ?: SectionState.INACTIVE
            val isClickable = state == SectionState.COMPLETED
            val isActiveOrCompleted = state != SectionState.INACTIVE

            val circleColor = if (isActiveOrCompleted) Color(0xFF0F172A) else Color(0xFFE2E8F0)
            val numberColor = if (isActiveOrCompleted) Color.White else Color(0xFF64748B)
            val labelColor = if (isActiveOrCompleted) Color(0xFF0F172A) else Color(0xFF64748B)
            val stepBgColor = if (isActiveOrCompleted) Color.White else Color(0xFFF8FAFC)

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier
                    .height(104.dp)
                    .fillMaxWidth()
                    .background(stepBgColor)
                    .then(
                        if (isClickable) Modifier.clickable { onStepClick(i) }
                        else Modifier
                    )
            ) {
                // 숫자 원형
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(circleColor, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (state == SectionState.COMPLETED) {
                        Text(
                            text = "✓",
                            color = numberColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    } else {
                        Text(
                            text = "$i",
                            color = numberColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // 라벨
                Text(
                    text = stepLabels.getOrNull(i - 1) ?: "",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = labelColor
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: MainViewModel = viewModel(
        factory = MainViewModelFactory(
            kr.roopre.iringer_app.di.totalProvider.patientRepository,
            kr.roopre.iringer_app.di.totalProvider.deviceRepository,
            kr.roopre.iringer_app.di.totalProvider.userSettingsRepository
        )
    ),
    modifier: Modifier = Modifier,
    onLogout: () -> Unit = {}
) {
    val scanData by viewModel.scanData.collectAsState()
    val scanError by viewModel.scanError.collectAsState()
    val context = LocalContext.current
    val activity = context as? MainActivity
    val keyboardController = LocalSoftwareKeyboardController.current

    val hasEmr = UserManager.currentUser?.has_emr ?: false
    val scrollState = rememberScrollState()
    val totalSteps = 3

    // 커스텀 Toast 상태
    var showToast by remember { mutableStateOf(false) }
    var toastMessage by remember { mutableStateOf("") }
    var isToastSuccess by remember { mutableStateOf(true) }

    // 다른 기기 연결 중 안내 다이얼로그 상태
    var showAlreadyAssignedDialog by remember { mutableStateOf(false) }
    // 이미 사용 중인 기기 안내 다이얼로그 상태
    var showDeviceAlreadyInUseDialog by remember { mutableStateOf(false) }

    // 스캔 에러 감지 및 토스트/다이얼로그 표시
    LaunchedEffect(scanError.timestamp) {
        if (scanError.message.isNotEmpty() && scanError.timestamp > 0) {
            when (scanError.message) {
                "ALREADY_ASSIGNED" -> showAlreadyAssignedDialog = true
                "DEVICE_ALREADY_IN_USE" -> showDeviceAlreadyInUseDialog = true
                else -> {
                    toastMessage = scanError.message
                    isToastSuccess = false
                    showToast = true
                }
            }
        }
    }

    // FocusRequester for each section
    val patientFocusRequester = remember { FocusRequester() }
    val infusionFocusRequester = remember { FocusRequester() }
    val deviceFocusRequester = remember { FocusRequester() }

    // Keyboard input states
    var patientKeyboardInput by remember { mutableStateOf("") }
    var deviceKeyboardInput by remember { mutableStateOf("") }

    // 수액 정보 입력 상태
    var infusionType by remember { mutableStateOf("") }
    var infusionVolume by remember { mutableStateOf("500") }
    var infusionCchr by remember { mutableStateOf(0) }
    var infusionConfirmed by remember { mutableStateOf(false) }
    var infusionDropdownExpanded by remember { mutableStateOf(false) }
    var infusionSearchQuery by remember { mutableStateOf("") }

    // 서버에서 수액 프리셋 로드
    val serverInfusionOptions by viewModel.infusionOptions.collectAsState()
    val infusionOptionsLoading by viewModel.infusionOptionsLoading.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadInfusionOptions()
    }

    // 수액 스텝 탭/스캔 상태
    var infusionTabIndex by remember { mutableStateOf(0) } // 0=QR 스캔, 1=수동 입력
    var infusionScanMode by remember { mutableStateOf(ScanMode.IDLE) }
    var infusionKeyboardInput by remember { mutableStateOf("") }

    // 수액 자동 입력 데이터
    val infusionAutoFill by viewModel.infusionAutoFill.collectAsState()

    // === 스텝 상태 (아코디언 → 스테퍼 전환) ===
    var currentStep by remember { mutableStateOf(1) }

    // 스캔 상태 (top-level로 이동)
    var patientScanMode by remember { mutableStateOf(ScanMode.IDLE) }
    var deviceScanMode by remember { mutableStateOf(ScanMode.IDLE) }
    val hasHardwareScanner = activity?.hasHardwareScanner ?: true

    // ViewModel에서 스캔 완료 여부 확인
    val patientScanned = scanData.patientQrCode.isNotEmpty()
    val infusionScanned = infusionConfirmed
    val deviceScanned = scanData.deviceQrCode.isNotEmpty()

    // 수액 자동 입력 감지 (수액 QR에서 수액 데이터 포함 시)
    LaunchedEffect(infusionAutoFill.timestamp) {
        if (infusionAutoFill.timestamp > 0 && currentStep >= 2) {
            infusionType = infusionAutoFill.infusionType
            infusionVolume = infusionAutoFill.infusionVolume.toString()
            infusionCchr = infusionAutoFill.infusionCchr
            infusionConfirmed = true
            currentStep = 3
            Log.d("MainScreen", "✓ 수액 QR → 3단계로 이동")
        }
    }

    // 환자 스캔 완료 시 자동으로 다음 단계로 이동
    LaunchedEffect(patientScanned) {
        if (patientScanned && currentStep == 1) {
            kotlinx.coroutines.delay(500)
            if (infusionAutoFill.timestamp > 0) {
                infusionType = infusionAutoFill.infusionType
                infusionVolume = infusionAutoFill.infusionVolume.toString()
                infusionCchr = infusionAutoFill.infusionCchr
                infusionConfirmed = true
                currentStep = 3
            } else {
                currentStep = 2
            }
        }
    }

    // 각 섹션의 상태 계산 (스텝 인디케이터용)
    val patientState = when {
        currentStep == 1 -> SectionState.ACTIVE
        patientScanned -> SectionState.COMPLETED
        else -> SectionState.INACTIVE
    }

    val infusionState = when {
        currentStep == 2 -> SectionState.ACTIVE
        infusionScanned -> SectionState.COMPLETED
        else -> SectionState.INACTIVE
    }

    val deviceStep = 3
    val deviceState = when {
        currentStep == deviceStep -> SectionState.ACTIVE
        deviceScanned && scanData.deviceInfo != null -> SectionState.COMPLETED
        else -> SectionState.INACTIVE
    }

    val stepStates = listOf(patientState, infusionState, deviceState)

    // 스텝 전환 시 스캔 중지 및 스크롤 초기화
    LaunchedEffect(currentStep) {
        patientScanMode = ScanMode.IDLE
        deviceScanMode = ScanMode.IDLE
        infusionScanMode = ScanMode.IDLE
        activity?.stopScan()
        scrollState.scrollTo(0)

        // 스캔 타겟 설정
        when (currentStep) {
            1 -> viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.PATIENT)
            deviceStep -> viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.DEVICE)
            else -> viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.INFUSION)
        }
    }

    // ALREADY_ASSIGNED 에러 시 환자 정보 스텝으로 복귀
    LaunchedEffect(showAlreadyAssignedDialog) {
        if (showAlreadyAssignedDialog) {
            currentStep = 1
        }
    }

    // URL 디코딩 함수 - 유효한 퍼센트 인코딩(%XX)이 있을 때만 적용
    fun decodeUrl(encoded: String): String {
        return try {
            if (encoded.contains(Regex("%[0-9A-Fa-f]{2}"))) {
                Uri.decode(encoded)
            } else {
                encoded
            }
        } catch (e: Exception) {
            Log.e("MainScreen", "URL 디코딩 실패", e)
            encoded
        }
    }

    // 등록 가능 여부
    val registrationEnabled = if (hasEmr) {
        patientScanned && deviceScanned && scanData.deviceInfo != null
    } else {
        patientScanned && infusionScanned && deviceScanned && scanData.deviceInfo != null
    }

    // 하단 버튼 상태
    val isLastStep = currentStep == totalSteps
    val canAdvance = when (currentStep) {
        1 -> patientScanned
        2 -> infusionType.isNotEmpty() && infusionVolume.trim().isNotEmpty()
        3 -> registrationEnabled
        else -> false
    }

    // Toast 자동 숨김 처리
    LaunchedEffect(showToast) {
        if (showToast) {
            kotlinx.coroutines.delay(3000)
            showToast = false
        }
    }


    // 등록 처리 함수
    fun performRegistration() {
        try {
            Log.d("MainScreen", "=== 등록하기 시작 ===")
            Log.d("MainScreen", "환자 QR: ${scanData.patientQrCode}")
            Log.d("MainScreen", "기기 정보: ${scanData.deviceInfo}")

            val patientData = Gson().fromJson(scanData.patientQrCode, JsonObject::class.java)
            val bedId = patientData.get("bed_id")?.asInt
            val deviceId = scanData.deviceInfo?.id

            Log.d("MainScreen", "추출된 bed_id: $bedId, device_id: $deviceId")

            if (bedId == null || deviceId == null) {
                val missingData = mutableListOf<String>()
                if (bedId == null) missingData.add("bed_id")
                if (deviceId == null) missingData.add("device_id")
                val errorMsg = "필수 데이터가 누락되었습니다: ${missingData.joinToString(", ")}"
                Log.e("MainScreen", errorMsg)
                return
            }

            val registrationData = JsonObject().apply {
                // patient_id: QR에 포함된 경우 사용, 없으면 null
                val patientId = patientData.get("patient_id")?.asInt
                if (patientId != null) {
                    addProperty("patient_id", patientId)
                } else {
                    add("patient_id", com.google.gson.JsonNull.INSTANCE)
                }
                addProperty("bed_id", bedId)
                addProperty("device_id", deviceId as Number)

                // 수액 정보 (수동 입력 또는 QR 자동 입력된 값 사용)
                addProperty("infusion_type", infusionType)
                val volume = infusionVolume.toIntOrNull() ?: 0
                addProperty("infusion_total_volume", volume)
                addProperty("infusion_cchr", infusionCchr)
            }

            Log.d("MainScreen", "등록 데이터: $registrationData")

            viewModel.upsertPatientBedAssignment(
                data = registrationData,
                onSuccess = { response ->
                    Log.d("MainScreen", "등록 성공: $response")
                    toastMessage = "정상적으로 등록되었습니다."
                    isToastSuccess = true
                    showToast = true

                    // 모든 데이터 초기화
                    viewModel.clearPatientQr()
                    viewModel.clearDeviceQr()
                    viewModel.clearInfusionAutoFill()
                    infusionType = ""
                    infusionVolume = "500"
                    infusionCchr = 0
                    infusionConfirmed = false
                    currentStep = 1
                    Log.d("MainScreen", "등록 성공 후 모든 데이터 초기화")
                },
                onError = { error ->
                    Log.e("MainScreen", "등록 실패: $error")
                    toastMessage = when {
                        error.contains("최대 3개") || error.contains("maximum") ->
                            "환자당 최대 3개의 수액만 동시 투여 가능합니다."
                        else -> "등록에 실패했습니다. ($error)"
                    }
                    isToastSuccess = false
                    showToast = true
                }
            )
        } catch (e: Exception) {
            Log.e("MainScreen", "등록 버튼 오류", e)
        }
    }

    // 전체 초기화 함수
    fun resetAll() {
        viewModel.clearPatientQr()
        viewModel.clearDeviceQr()
        viewModel.clearInfusionAutoFill()
        infusionType = ""
        infusionVolume = "500"
        infusionCchr = 0
        infusionConfirmed = false
        infusionTabIndex = 0
        patientScanMode = ScanMode.IDLE
        deviceScanMode = ScanMode.IDLE
        infusionScanMode = ScanMode.IDLE
        infusionKeyboardInput = ""
        activity?.stopScan()
        currentStep = 1
        Log.d("MainScreen", "처음으로 돌아가기 - 모든 데이터 초기화")
    }

    Box(modifier = modifier.fillMaxSize()) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            topBar = {
                TopAppBar(
                    title = {
                        Box(
                            modifier = Modifier.fillMaxHeight(),
                            contentAlignment = Alignment.CenterStart
                        ) {
                            Text(
                                text = "환자 등록",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    },
                    actions = {
                        TextButton(
                            onClick = { resetAll() },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.textButtonColors(
                                containerColor = Color(0xFF334155)
                            ),
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Text(
                                text = "초기화",
                                color = Color(0xFFCBD5E1),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color(0xFF111827)
                    )
                )
            },
            bottomBar = {
                // 하단 고정 버튼
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color.White
                ) {
                    val isReadyToRegister = isLastStep && canAdvance
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                            .then(
                                if (isReadyToRegister) {
                                    Modifier.background(
                                        color = Color(0xFF111827),
                                        shape = RoundedCornerShape(16.dp)
                                    )
                                } else {
                                    Modifier
                                        .border(
                                            width = 1.dp,
                                            color = Color(0xFFE2E8F0),
                                            shape = RoundedCornerShape(16.dp)
                                        )
                                        .background(
                                            color = Color(0xFFF1F5F9),
                                            shape = RoundedCornerShape(16.dp)
                                        )
                                }
                            )
                            .clickable(enabled = canAdvance) {
                                if (isLastStep) {
                                    performRegistration()
                                } else {
                                    if (currentStep == 2) {
                                        if (infusionType.isEmpty()) {
                                            toastMessage = "수액 종류를 선택해주세요."
                                            isToastSuccess = false
                                            showToast = true
                                            return@clickable
                                        }
                                        if (infusionVolume.trim().isEmpty()) {
                                            toastMessage = "수액 용량을 입력해주세요."
                                            isToastSuccess = false
                                            showToast = true
                                            return@clickable
                                        }
                                        infusionConfirmed = true
                                    }
                                    currentStep++
                                }
                            }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (isLastStep) {
                                Text(
                                    text = "✓",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isReadyToRegister) Color.White else Color(0xFF94A3B8)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text(
                                text = if (isLastStep) "최종 등록 완료" else "다음 단계로",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isReadyToRegister) Color.White else Color(0xFF94A3B8)
                            )
                            if (!isLastStep) {
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "→",
                                    fontSize = 16.sp,
                                    color = Color(0xFF94A3B8)
                                )
                            }
                        }
                    }
                }
            },
            containerColor = Color.White
        ) { paddingValues ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(end = 16.dp)
            ) {
                // 좌측: 스텝 인디케이터 (사각 컨테이너)
                StepIndicator(
                    currentStep = currentStep,
                    totalSteps = totalSteps,
                    stepLabels = listOf("환자", "수액", "기기"),
                    stepStates = stepStates,
                    onStepClick = { step ->
                        if (stepStates[step - 1] == SectionState.COMPLETED) {
                            currentStep = step
                        }
                    }
                )

                // 구분선
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .width(1.dp)
                        .background(Color(0xFFE2E8F0))
                )

                // 우측: 콘텐츠 영역
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .verticalScroll(scrollState)
                        .padding(horizontal = 16.dp, vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                        when (currentStep) {
                            // ============================================
                            // 스텝 1: 환자 정보 스캔
                            // ============================================
                            1 -> {
                                Text(
                                    text = "환자 정보 스캔",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 4.dp)
                                )
                                Text(
                                    text = "환자 팔찌의 QR 코드를 스캔해주세요.",
                                    fontSize = 14.sp,
                                    color = Color(0xFF64748B),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 16.dp)
                                )

                                QrScanArea(
                                    scanMode = patientScanMode,
                                    isScanned = patientScanned,
                                    hasHardwareScanner = hasHardwareScanner,
                                    guideText = "환자 팔찌의 QR 코드를\n스캔해주세요",
                                    onStartScannerScan = { patientScanMode = ScanMode.SCANNER },
                                    onStartCameraScan = { patientScanMode = ScanMode.CAMERA },
                                    onStopScan = { patientScanMode = ScanMode.IDLE },
                                    onRescan = {
                                        viewModel.clearPatientQr()
                                        patientScanMode = ScanMode.IDLE
                                    },
                                    onCameraBarcodeDetected = { barcode ->
                                        activity?.scanReceiver?.onBarcodeScanned(barcode)
                                        patientScanMode = ScanMode.IDLE
                                    }
                                )

                                // 환자 정보 표시 (스캔 완료 시)
                                if (patientScanned) {
                                    val patientInfoData = remember(scanData.patientQrCode) {
                                        try {
                                            val pd = Gson().fromJson(
                                                scanData.patientQrCode,
                                                JsonObject::class.java
                                            )
                                            val result = mutableMapOf<String, String>()

                                            // 환자명 + 성별/나이
                                            val name = pd.get("name")?.asString ?: pd.get("patient_name")?.asString
                                            val sex = pd.get("sex")?.asString ?: ""
                                            val age = pd.get("age")?.let {
                                                if (!it.isJsonNull) try { it.asInt } catch (e: Exception) { null } else null
                                            }
                                            if (!name.isNullOrEmpty()) {
                                                val demographics = listOfNotNull(
                                                    sex.takeIf { it.isNotEmpty() },
                                                    age?.toString()
                                                ).joinToString("/")
                                                result["환자"] = if (demographics.isNotEmpty()) "$name ($demographics)" else name
                                            }

                                            // 차트번호
                                            val chartNumber = pd.get("chart_number")?.asString
                                            if (!chartNumber.isNullOrEmpty()) {
                                                result["차트번호"] = chartNumber
                                            }

                                            // 병실 위치
                                            val hospitalName = pd.get("hospital_name")?.asString ?: ""
                                            val wardName = pd.get("ward_name")?.asString ?: ""
                                            val roomNumber = pd.get("room_number")?.asString ?: ""
                                            val bedNumber = pd.get("bed_number")?.asString ?: ""
                                            if (hospitalName.isNotEmpty()) {
                                                result["병상"] = "$hospitalName / $wardName / $roomNumber-$bedNumber"
                                            } else if (roomNumber.isNotEmpty()) {
                                                result["병실"] = "${roomNumber}호 - ${bedNumber}번"
                                            }

                                            // 수액 정보 (QR에 포함된 경우)
                                            val infType = pd.get("infusion_type")?.asString
                                            if (!infType.isNullOrEmpty()) {
                                                val infVolume = pd.get("infusion_total_volume")?.asInt ?: 0
                                                val infGttVal = try {
                                                    pd.get("infusion_cchr")?.asDouble?.toInt() ?: 0
                                                } catch (e: Exception) { 0 }
                                                result["수액"] = "$infType / ${infVolume}ml / ${infGttVal}cc/hr"
                                            }

                                            result.toMap()
                                        } catch (e: Exception) {
                                            Log.e("MainScreen", "환자 정보 파싱 실패", e)
                                            emptyMap()
                                        }
                                    }

                                    if (patientInfoData.isNotEmpty()) {
                                        Card(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 8.dp),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = CardDefaults.cardColors(
                                                containerColor = Color(0xFF334155)
                                            )
                                        ) {
                                            Column(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(16.dp)
                                            ) {
                                                patientInfoData.forEach { (label, value) ->
                                                    Text(
                                                        text = buildAnnotatedString {
                                                            withStyle(style = SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFFCBD5E1))) {
                                                                append("$label: ")
                                                            }
                                                            withStyle(style = SpanStyle(color = Color.White)) {
                                                                append(value)
                                                            }
                                                        },
                                                        fontSize = 14.sp,
                                                        modifier = Modifier
                                                            .fillMaxWidth()
                                                            .padding(vertical = 2.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }

                                // 숨겨진 키보드 입력 필드 (하드웨어 스캐너용)
                                OutlinedTextField(
                                    value = patientKeyboardInput,
                                    onValueChange = { newValue ->
                                        patientKeyboardInput = newValue
                                        if (newValue.length > 10) {
                                            val decoded = decodeUrl(newValue)

                                            // QR 코드 유효성 검사
                                            try {
                                                val patientData = Gson().fromJson(
                                                    decoded,
                                                    JsonObject::class.java
                                                )
                                                val bedId = patientData.get("bed_id")?.asInt

                                                if (bedId == null) {
                                                    Log.e("MainScreen", "✗ 환자 QR 유효성 검사 실패 (bed_id 없음)")
                                                    toastMessage = "올바른 환자 QR 코드가 아닙니다."
                                                    isToastSuccess = false
                                                    showToast = true
                                                    patientKeyboardInput = ""
                                                    patientScanMode = ScanMode.IDLE
                                                    activity?.stopScan()
                                                    return@OutlinedTextField
                                                }
                                            } catch (e: Exception) {
                                                Log.e("MainScreen", "환자 QR 코드 검증 실패", e)
                                                toastMessage = "올바른 환자 QR 코드가 아닙니다."
                                                isToastSuccess = false
                                                showToast = true
                                                patientKeyboardInput = ""
                                                patientScanMode = ScanMode.IDLE
                                                activity?.stopScan()
                                                return@OutlinedTextField
                                            }

                                            // 스캔 상태 해제
                                            patientKeyboardInput = ""
                                            patientScanMode = ScanMode.IDLE
                                            activity?.stopScan()

                                            // bed_id 추출 후 할당 상태 확인
                                            val patientData = Gson().fromJson(decoded, JsonObject::class.java)
                                            val bedId = patientData.get("bed_id")?.asInt ?: return@OutlinedTextField

                                            viewModel.checkBedAssignmentStatus(
                                                bedId = bedId,
                                                onAlreadyAssigned = {
                                                    Log.d("MainScreen", "⚠️ 환자가 이미 최대 기기(3개) 연결됨")
                                                    showAlreadyAssignedDialog = true
                                                },
                                                onAvailable = {
                                                    val assignmentId = patientData.get("assignment_id")?.asInt
                                                    val patientId = patientData.get("patient_id")?.asInt
                                                    if (assignmentId != null) {
                                                        // 수액 QR → 환자+수액 정보 한번에 처리
                                                        viewModel.processInfusionQrWithPatient(bedId, assignmentId, patientId)
                                                        Log.d("MainScreen", "✓ 수액 QR로 환자+수액 통합 처리: assignment_id=$assignmentId")
                                                    } else {
                                                        // 환자 QR → 기존 처리
                                                        viewModel.updateScanData(decoded)
                                                        viewModel.fetchAndUpdatePatientInfo(bedId)
                                                        Log.d("MainScreen", "✓ 환자 QR 스캔 완료")
                                                    }
                                                },
                                                onError = { errorMsg ->
                                                    Log.e("MainScreen", "할당 상태 확인 실패: $errorMsg")
                                                    toastMessage = errorMsg
                                                    isToastSuccess = false
                                                    showToast = true
                                                }
                                            )
                                        }
                                    },
                                    modifier = Modifier
                                        .height(1.dp)
                                        .width(1.dp)
                                        .alpha(0f)
                                        .focusRequester(patientFocusRequester)
                                        .onFocusChanged { focusState ->
                                            if (focusState.isFocused) {
                                                keyboardController?.hide()
                                            }
                                        },
                                    label = { },
                                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.None)
                                )

                                // 스캔 시작/중지 LaunchedEffect
                                LaunchedEffect(patientScanMode) {
                                    when (patientScanMode) {
                                        ScanMode.SCANNER -> {
                                            try {
                                                keyboardController?.hide()
                                                viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.PATIENT)
                                                patientFocusRequester.requestFocus()
                                                activity?.startScan()
                                            } catch (e: Exception) {
                                                Log.e("MainScreen", "스캔 시작 실패", e)
                                                patientScanMode = ScanMode.IDLE
                                            }
                                        }
                                        ScanMode.CAMERA -> {
                                            try {
                                                keyboardController?.hide()
                                                viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.PATIENT)
                                            } catch (e: Exception) {
                                                Log.e("MainScreen", "카메라 스캔 시작 실패", e)
                                                patientScanMode = ScanMode.IDLE
                                            }
                                        }
                                        ScanMode.IDLE -> {
                                            try {
                                                activity?.stopScan()
                                            } catch (e: Exception) {
                                                Log.e("MainScreen", "스캔 중지 실패", e)
                                            }
                                        }
                                    }
                                }

                            }

                            // ============================================
                            // 스텝 2: 수액 정보 (QR 스캔 / 수동 입력 탭)
                            // ============================================
                            2 -> {
                                Text(
                                    text = "수액 정보",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 4.dp)
                                )
                                Text(
                                    text = "수액 종류와 용량을 입력해주세요.",
                                    fontSize = 14.sp,
                                    color = Color(0xFF64748B),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 16.dp)
                                )

                                // 탭 버튼 (QR 스캔 / 수동 입력)
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 16.dp)
                                ) {
                                    listOf("QR 스캔", "수동 입력").forEachIndexed { index, label ->
                                        Column(
                                            modifier = Modifier
                                                .weight(1f)
                                                .clickable {
                                                    infusionTabIndex = index
                                                    if (index != 0) {
                                                        infusionScanMode = ScanMode.IDLE
                                                        activity?.stopScan()
                                                    }
                                                },
                                            horizontalAlignment = Alignment.CenterHorizontally
                                        ) {
                                            Text(
                                                text = label,
                                                fontSize = 15.sp,
                                                fontWeight = if (infusionTabIndex == index) FontWeight.Bold else FontWeight.Normal,
                                                color = if (infusionTabIndex == index) Color(0xFF0F172A) else Color(0xFF94A3B8),
                                                modifier = Modifier.padding(vertical = 10.dp)
                                            )
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .height(2.dp)
                                                    .background(
                                                        if (infusionTabIndex == index) Color(0xFF0F172A)
                                                        else Color(0xFFE2E8F0)
                                                    )
                                            )
                                        }
                                    }
                                }

                                // === QR 스캔 탭 ===
                                if (infusionTabIndex == 0) {
                                    QrScanArea(
                                        scanMode = infusionScanMode,
                                        isScanned = infusionConfirmed,
                                        hasHardwareScanner = hasHardwareScanner,
                                        guideText = "새로운 수액의 QR 코드를\n스캔해주세요",
                                        onStartScannerScan = { infusionScanMode = ScanMode.SCANNER },
                                        onStartCameraScan = { infusionScanMode = ScanMode.CAMERA },
                                        onStopScan = { infusionScanMode = ScanMode.IDLE },
                                        onRescan = {
                                            infusionConfirmed = false
                                            infusionType = ""
                                            infusionVolume = "500"
                                            infusionCchr = 0
                                            viewModel.clearInfusionAutoFill()
                                            infusionScanMode = ScanMode.IDLE
                                        },
                                        onCameraBarcodeDetected = { barcode ->
                                            val decoded = try {
                                                if (barcode.contains(Regex("%[0-9A-Fa-f]{2}"))) Uri.decode(barcode) else barcode
                                            } catch (e: Exception) { barcode }
                                            Log.d("MainScreen", "수액 QR 스캔: $decoded")
                                            try {
                                                val data = Gson().fromJson(decoded, JsonObject::class.java)
                                                val qrType = data.get("type")?.asString

                                                when (qrType) {
                                                    "infusion" -> {
                                                        val assignmentId = data.get("assignment_id")?.asInt
                                                        val bedId = data.get("bed_id")?.asInt
                                                        val patientId = data.get("patient_id")?.asInt
                                                        if (assignmentId != null) {
                                                            if (bedId != null) {
                                                                viewModel.processInfusionQrWithPatient(bedId, assignmentId, patientId)
                                                            } else {
                                                                viewModel.fetchInfusionByAssignmentId(assignmentId)
                                                            }
                                                            Log.d("MainScreen", "✓ 수액 QR → API 조회: assignment_id=$assignmentId, bed_id=$bedId")
                                                        } else {
                                                            toastMessage = "올바른 수액 QR 코드가 아닙니다."
                                                            isToastSuccess = false
                                                            showToast = true
                                                        }
                                                    }
                                                    "patient" -> {
                                                        toastMessage = "환자 QR 코드입니다. 수액 QR 코드를 스캔해주세요."
                                                        isToastSuccess = false
                                                        showToast = true
                                                    }
                                                    else -> {
                                                        toastMessage = "올바른 수액 QR 코드가 아닙니다."
                                                        isToastSuccess = false
                                                        showToast = true
                                                    }
                                                }
                                            } catch (e: Exception) {
                                                Log.e("MainScreen", "수액 QR 파싱 실패: ${e.message}", e)
                                                toastMessage = "올바른 수액 QR 코드가 아닙니다."
                                                isToastSuccess = false
                                                showToast = true
                                            }
                                            infusionScanMode = ScanMode.IDLE
                                        }
                                    )

                                    // 수액 정보 표시 (스캔 완료 시)
                                    if (infusionConfirmed && infusionType.isNotEmpty()) {
                                        Card(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 8.dp),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = CardDefaults.cardColors(
                                                containerColor = Color(0xFF334155)
                                            )
                                        ) {
                                            Column(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(16.dp)
                                            ) {
                                                Text(
                                                    text = buildAnnotatedString {
                                                        withStyle(style = SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFFCBD5E1))) {
                                                            append("수액 종류: ")
                                                        }
                                                        withStyle(style = SpanStyle(color = Color.White)) {
                                                            append(infusionType)
                                                        }
                                                    },
                                                    fontSize = 14.sp,
                                                    modifier = Modifier.padding(bottom = 4.dp)
                                                )
                                                Text(
                                                    text = buildAnnotatedString {
                                                        withStyle(style = SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFFCBD5E1))) {
                                                            append("용량: ")
                                                        }
                                                        withStyle(style = SpanStyle(color = Color.White)) {
                                                            append("${infusionVolume}ml")
                                                        }
                                                    },
                                                    fontSize = 14.sp,
                                                    modifier = Modifier.padding(bottom = 4.dp)
                                                )
                                                if (infusionCchr > 0) {
                                                    Text(
                                                        text = buildAnnotatedString {
                                                            withStyle(style = SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFFCBD5E1))) {
                                                                append("속도: ")
                                                            }
                                                            withStyle(style = SpanStyle(color = Color.White)) {
                                                                append("${infusionCchr}cc/hr")
                                                            }
                                                        },
                                                        fontSize = 14.sp
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    // 숨겨진 키보드 입력 (하드웨어 스캐너)
                                    OutlinedTextField(
                                        value = infusionKeyboardInput,
                                        onValueChange = { newValue ->
                                            infusionKeyboardInput = newValue
                                            if (newValue.length > 10) {
                                                val decoded = decodeUrl(newValue)
                                                Log.d("MainScreen", "수액 HW스캔: $decoded")
                                                try {
                                                    val data = Gson().fromJson(decoded, JsonObject::class.java)
                                                    val qrType = data.get("type")?.asString

                                                    when (qrType) {
                                                        "infusion" -> {
                                                            val assignmentId = data.get("assignment_id")?.asInt
                                                            val bedId = data.get("bed_id")?.asInt
                                                            val patientId = data.get("patient_id")?.asInt
                                                            if (assignmentId != null) {
                                                                if (bedId != null) {
                                                                    viewModel.processInfusionQrWithPatient(bedId, assignmentId, patientId)
                                                                } else {
                                                                    viewModel.fetchInfusionByAssignmentId(assignmentId)
                                                                }
                                                                Log.d("MainScreen", "✓ 수액 HW스캔 → API 조회: assignment_id=$assignmentId, bed_id=$bedId")
                                                            } else {
                                                                toastMessage = "올바른 수액 QR 코드가 아닙니다."
                                                                isToastSuccess = false
                                                                showToast = true
                                                            }
                                                        }
                                                        "patient" -> {
                                                            toastMessage = "환자 QR 코드입니다. 수액 QR 코드를 스캔해주세요."
                                                            isToastSuccess = false
                                                            showToast = true
                                                        }
                                                        else -> {
                                                            toastMessage = "올바른 수액 QR 코드가 아닙니다."
                                                            isToastSuccess = false
                                                            showToast = true
                                                        }
                                                    }
                                                } catch (e: Exception) {
                                                    Log.e("MainScreen", "수액 HW스캔 파싱 실패: ${e.message}", e)
                                                    toastMessage = "올바른 수액 QR 코드가 아닙니다."
                                                    isToastSuccess = false
                                                    showToast = true
                                                }
                                                infusionKeyboardInput = ""
                                                infusionScanMode = ScanMode.IDLE
                                                activity?.stopScan()
                                            }
                                        },
                                        modifier = Modifier
                                            .height(1.dp)
                                            .width(1.dp)
                                            .alpha(0f)
                                            .focusRequester(infusionFocusRequester)
                                            .onFocusChanged { focusState ->
                                                if (focusState.isFocused) {
                                                    keyboardController?.hide()
                                                }
                                            },
                                        label = { },
                                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.None)
                                    )

                                    // 스캔 시작/중지
                                    LaunchedEffect(infusionScanMode) {
                                        when (infusionScanMode) {
                                            ScanMode.SCANNER -> {
                                                try {
                                                    keyboardController?.hide()
                                                    viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.INFUSION)
                                                    infusionFocusRequester.requestFocus()
                                                    activity?.startScan()
                                                } catch (e: Exception) {
                                                    Log.e("MainScreen", "수액 스캔 시작 실패", e)
                                                    infusionScanMode = ScanMode.IDLE
                                                }
                                            }
                                            ScanMode.CAMERA -> {
                                                try {
                                                    keyboardController?.hide()
                                                    viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.INFUSION)
                                                } catch (e: Exception) {
                                                    Log.e("MainScreen", "수액 카메라 스캔 시작 실패", e)
                                                    infusionScanMode = ScanMode.IDLE
                                                }
                                            }
                                            ScanMode.IDLE -> {
                                                try { activity?.stopScan() } catch (e: Exception) { }
                                            }
                                        }
                                    }

                                }

                                // === 수동 입력 탭 ===
                                if (infusionTabIndex == 1) {
                                    // 수액 종류 라벨
                                    Text(
                                        text = "수액 종류",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0F172A),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(bottom = 8.dp)
                                    )

                                    Box(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
                                        OutlinedTextField(
                                            value = infusionType,
                                            onValueChange = {},
                                            readOnly = true,
                                            enabled = false,
                                            placeholder = {
                                                Text(
                                                    if (infusionOptionsLoading) "로딩 중..." else "수액 종류를 선택하세요",
                                                    color = Color(0xFF64748B)
                                                )
                                            },
                                            trailingIcon = {
                                                Icon(
                                                    imageVector = Icons.Default.ArrowDropDown,
                                                    contentDescription = "선택"
                                                )
                                            },
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = OutlinedTextFieldDefaults.colors(
                                                disabledTextColor = Color(0xFF0F172A),
                                                disabledContainerColor = Color.White,
                                                disabledBorderColor = Color(0xFFE2E8F0),
                                                disabledTrailingIconColor = Color(0xFF94A3B8),
                                                disabledPlaceholderColor = Color(0xFF64748B)
                                            ),
                                            singleLine = true
                                        )
                                        Box(
                                            modifier = Modifier
                                                .matchParentSize()
                                                .clickable {
                                                    infusionSearchQuery = ""
                                                    infusionDropdownExpanded = true
                                                }
                                        )
                                        DropdownMenu(
                                            expanded = infusionDropdownExpanded,
                                            onDismissRequest = { infusionDropdownExpanded = false },
                                            modifier = Modifier
                                                .fillMaxWidth(0.9f)
                                                .heightIn(max = 350.dp)
                                                .background(Color.White)
                                        ) {
                                            OutlinedTextField(
                                                value = infusionSearchQuery,
                                                onValueChange = { infusionSearchQuery = it },
                                                placeholder = { Text("검색", color = Color(0xFF64748B), fontSize = 14.sp) },
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(horizontal = 12.dp, vertical = 4.dp),
                                                shape = RoundedCornerShape(8.dp),
                                                singleLine = true,
                                                textStyle = TextStyle(fontSize = 14.sp),
                                                colors = OutlinedTextFieldDefaults.colors(
                                                    focusedBorderColor = Color(0xFF009EE6),
                                                    unfocusedBorderColor = Color(0xFFE2E8F0),
                                                    unfocusedContainerColor = Color.White,
                                                    focusedContainerColor = Color.White
                                                )
                                            )

                                            val filtered = serverInfusionOptions.filter { option ->
                                                infusionSearchQuery.isEmpty() ||
                                                option.name.contains(infusionSearchQuery, ignoreCase = true) ||
                                                option.label.contains(infusionSearchQuery, ignoreCase = true)
                                            }

                                            if (filtered.isEmpty()) {
                                                DropdownMenuItem(
                                                    text = { Text("검색 결과 없음", color = Color(0xFF64748B)) },
                                                    onClick = {},
                                                    enabled = false
                                                )
                                            } else {
                                                filtered.forEachIndexed { index, option ->
                                                    DropdownMenuItem(
                                                        text = { Text(option.label) },
                                                        onClick = {
                                                            infusionType = option.name
                                                            infusionSearchQuery = ""
                                                            infusionDropdownExpanded = false
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

                                    // 전체 용량
                                    Text(
                                        text = "전체 용량 (ml)",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0F172A),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(bottom = 8.dp)
                                    )

                                    OutlinedTextField(
                                        value = infusionVolume,
                                        onValueChange = { infusionVolume = it.filter { c -> c.isDigit() } },
                                        placeholder = { Text("용량 입력", color = Color(0xFF64748B)) },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp),
                                        keyboardOptions = KeyboardOptions(
                                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                                        ),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = Color(0xFF009EE6),
                                            unfocusedBorderColor = Color(0xFFE2E8F0),
                                            focusedTextColor = Color(0xFF0F172A),
                                            unfocusedTextColor = Color(0xFF0F172A),
                                            cursorColor = Color(0xFF0F172A),
                                            unfocusedPlaceholderColor = Color(0xFF64748B),
                                            focusedPlaceholderColor = Color(0xFF64748B)
                                        ),
                                        singleLine = true
                                    )

                                    Spacer(modifier = Modifier.height(12.dp))

                                    // 전체 용량 빠른 선택 버튼
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
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
                                                    BorderStroke(1.dp, Color(0xFFE2E8F0))
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
                                }
                            }

                            // ============================================
                            // 스텝 3 (소형병원: 기기 정보)
                            // ============================================
                            3 -> {
                                DeviceStepContent(
                                    scanData = scanData,
                                    viewModel = viewModel,
                                    activity = activity,
                                    keyboardController = keyboardController,
                                    hasHardwareScanner = hasHardwareScanner,
                                    deviceScanMode = deviceScanMode,
                                    onDeviceScanModeChange = { deviceScanMode = it },
                                    deviceKeyboardInput = deviceKeyboardInput,
                                    onDeviceKeyboardInputChange = { deviceKeyboardInput = it },
                                    deviceFocusRequester = deviceFocusRequester,
                                    deviceScanned = deviceScanned,
                                    showToast = { msg, success ->
                                        toastMessage = msg
                                        isToastSuccess = success
                                        showToast = true
                                    },
                                    decodeUrl = ::decodeUrl
                                )
                            }
                        }

                        // ============================================
                        // 등록 예정 정보 요약
                        // ============================================
                        if (patientScanned || infusionConfirmed) {
                            Spacer(modifier = Modifier.height(24.dp))

                            Text(
                                text = "등록 예정 정보 요약",
                                fontSize = 13.sp,
                                color = Color(0xFF94A3B8),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 12.dp)
                            )

                            // 환자 정보 요약 카드
                            if (patientScanned) {
                                val patientSummary = remember(scanData.patientQrCode) {
                                    try {
                                        val pd = Gson().fromJson(
                                            scanData.patientQrCode,
                                            JsonObject::class.java
                                        )
                                        val name = pd.get("name")?.asString
                                            ?: pd.get("patient_name")?.asString ?: ""
                                        val sex = pd.get("sex")?.asString ?: ""
                                        val age = pd.get("age")?.let {
                                            if (!it.isJsonNull) try { it.asInt } catch (e: Exception) { null } else null
                                        }
                                        val roomNumber = pd.get("room_number")?.asString ?: ""
                                        val bedNumber = pd.get("bed_number")?.asString ?: ""

                                        val demographics = listOfNotNull(
                                            sex.takeIf { it.isNotEmpty() },
                                            age?.toString()
                                        ).joinToString("/")
                                        val nameDisplay = if (name.isNotEmpty()) {
                                            if (demographics.isNotEmpty()) "$name ($demographics)" else name
                                        } else ""
                                        val locationDisplay = if (roomNumber.isNotEmpty()) {
                                            "${roomNumber}호 $bedNumber"
                                        } else ""

                                        Pair(nameDisplay, locationDisplay)
                                    } catch (e: Exception) {
                                        Pair("", "")
                                    }
                                }

                                if (patientSummary.first.isNotEmpty()) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
                                            .padding(horizontal = 16.dp, vertical = 14.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            painter = painterResource(id = R.drawable.ic_profile),
                                            contentDescription = null,
                                            tint = Color(0xFF64748B),
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Text(
                                            text = patientSummary.first,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFF0F172A),
                                            modifier = Modifier.weight(1f)
                                        )
                                        if (patientSummary.second.isNotEmpty()) {
                                            Text(
                                                text = patientSummary.second,
                                                fontSize = 13.sp,
                                                color = Color(0xFF94A3B8)
                                            )
                                        }
                                    }
                                }
                            }

                            // 수액 정보 요약 카드
                            if (infusionConfirmed && infusionType.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
                                        .padding(horizontal = 16.dp, vertical = 14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // 수액 아이콘 (점적 모양)
                                    Box(
                                        modifier = Modifier.size(20.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Canvas(modifier = Modifier.size(16.dp)) {
                                            drawCircle(
                                                color = Color(0xFF64748B),
                                                radius = size.minDimension / 2,
                                                style = Stroke(width = 1.5.dp.toPx())
                                            )
                                            drawCircle(
                                                color = Color(0xFF64748B),
                                                radius = size.minDimension / 5
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        text = infusionType,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color(0xFF0F172A),
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = "${infusionVolume}ml",
                                        fontSize = 13.sp,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        // 커스텀 Toast 오버레이
        if (showToast) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CustomToast(
                    message = toastMessage,
                    isSuccess = isToastSuccess
                )
            }
        }

        // 이미 사용 중인 기기 안내 다이얼로그
        if (showDeviceAlreadyInUseDialog) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .clickable(enabled = false) { },
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier
                        .width(360.dp)
                        .padding(16.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White
                    ),
                    elevation = CardDefaults.cardElevation(
                        defaultElevation = 8.dp
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_warning),
                            contentDescription = "경고",
                            tint = Color(0xFFFF9800),
                            modifier = Modifier
                                .size(48.dp)
                                .padding(bottom = 12.dp)
                        )

                        Text(
                            text = "등록 불가",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF2C3E50),
                            modifier = Modifier.padding(bottom = 12.dp)
                        )

                        Text(
                            text = "이미 등록된 기기입니다.\n다른 기기를 사용해주세요.",
                            fontSize = 16.sp,
                            color = Color(0xFF757575),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(bottom = 24.dp)
                        )

                        Button(
                            onClick = { showDeviceAlreadyInUseDialog = false },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF009EE6),
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = "확인",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }

        // 다른 기기 연결 중 안내 다이얼로그
        if (showAlreadyAssignedDialog) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .clickable(enabled = false) { },
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier
                        .width(360.dp)
                        .padding(16.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White
                    ),
                    elevation = CardDefaults.cardElevation(
                        defaultElevation = 8.dp
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_warning),
                            contentDescription = "경고",
                            tint = Color(0xFFFF9800),
                            modifier = Modifier
                                .size(48.dp)
                                .padding(bottom = 12.dp)
                        )

                        Text(
                            text = "연결 불가",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF2C3E50),
                            modifier = Modifier.padding(bottom = 12.dp)
                        )

                        Text(
                            text = "해당 환자는 이미 3개의 기기와 연결중입니다.\n기존 연결 해제 후 시도해주세요.",
                            fontSize = 16.sp,
                            color = Color(0xFF757575),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(bottom = 24.dp)
                        )

                        Button(
                            onClick = { showAlreadyAssignedDialog = false },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF009EE6),
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = "확인",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

// 기기 정보 스캔 스텝 콘텐츠 (EMR/소형병원 공통)
@Composable
private fun DeviceStepContent(
    scanData: ScanData,
    viewModel: MainViewModel,
    activity: MainActivity?,
    keyboardController: androidx.compose.ui.platform.SoftwareKeyboardController?,
    hasHardwareScanner: Boolean,
    deviceScanMode: ScanMode,
    onDeviceScanModeChange: (ScanMode) -> Unit,
    deviceKeyboardInput: String,
    onDeviceKeyboardInputChange: (String) -> Unit,
    deviceFocusRequester: FocusRequester,
    deviceScanned: Boolean,
    showToast: (String, Boolean) -> Unit,
    decodeUrl: (String) -> String
) {
    var deviceTabIndex by remember { mutableStateOf(0) } // 0=QR 스캔, 1=수동 입력
    var manualSerialNumber by remember { mutableStateOf("") }

    Text(
        text = "기기 정보 스캔",
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        color = Color(0xFF0F172A),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 4.dp)
    )
    Text(
        text = "iRinger 기기의 QR을 스캔합니다.",
        fontSize = 14.sp,
        color = Color(0xFF64748B),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp)
    )

    // 탭 버튼 (QR 스캔 / 수동 입력)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp)
    ) {
        listOf("QR 스캔", "수동 입력").forEachIndexed { index, label ->
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable {
                        deviceTabIndex = index
                        if (index != 0) {
                            onDeviceScanModeChange(ScanMode.IDLE)
                            activity?.stopScan()
                        }
                    },
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = label,
                    fontSize = 15.sp,
                    fontWeight = if (deviceTabIndex == index) FontWeight.Bold else FontWeight.Normal,
                    color = if (deviceTabIndex == index) Color(0xFF0F172A) else Color(0xFF94A3B8),
                    modifier = Modifier.padding(vertical = 10.dp)
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(2.dp)
                        .background(
                            if (deviceTabIndex == index) Color(0xFF0F172A)
                            else Color(0xFFE2E8F0)
                        )
                )
            }
        }
    }

    // === QR 스캔 탭 ===
    if (deviceTabIndex == 0) {
        QrScanArea(
            scanMode = deviceScanMode,
            isScanned = deviceScanned,
            hasHardwareScanner = hasHardwareScanner,
            guideText = "iRinger 기기의 QR 코드를\n스캔해주세요",
            onStartScannerScan = { onDeviceScanModeChange(ScanMode.SCANNER) },
            onStartCameraScan = { onDeviceScanModeChange(ScanMode.CAMERA) },
            onStopScan = { onDeviceScanModeChange(ScanMode.IDLE) },
            onRescan = {
                viewModel.clearDeviceQr()
                onDeviceScanModeChange(ScanMode.IDLE)
            },
            onCameraBarcodeDetected = { barcode ->
                activity?.scanReceiver?.onBarcodeScanned(barcode)
                onDeviceScanModeChange(ScanMode.IDLE)
            }
        )

        // 기기 정보 표시 (스캔 완료 시)
        if (deviceScanned && scanData.deviceInfo != null) {
            DeviceInfoCard(deviceInfo = scanData.deviceInfo!!)
        }

        // 숨겨진 키보드 입력 필드 (하드웨어 스캐너용)
        OutlinedTextField(
            value = deviceKeyboardInput,
            onValueChange = { newValue ->
                onDeviceKeyboardInputChange(newValue)
                if (newValue.length > 10) {
                    val decoded = decodeUrl(newValue)
                    Log.d("MainScreen", "기기 QR 디코딩: $decoded")

                    var serialNumber: String? = null
                    try {
                        val regex = "serial_number\\s*:\\s*([^\\s]+)".toRegex(RegexOption.IGNORE_CASE)
                        val match = regex.find(decoded)
                        serialNumber = match?.groupValues?.get(1)

                        if (serialNumber.isNullOrEmpty()) {
                            Log.e("MainScreen", "✗ 기기 QR 유효성 검사 실패 (serial_number 없음)")
                            showToast("올바른 기기 QR 코드가 아닙니다.", false)
                            onDeviceKeyboardInputChange("")
                            onDeviceScanModeChange(ScanMode.IDLE)
                            activity?.stopScan()
                            return@OutlinedTextField
                        }

                        onDeviceScanModeChange(ScanMode.IDLE)
                        activity?.stopScan()

                        viewModel.updateScanData(decoded)
                        Log.d("MainScreen", "✓ Serial Number 파싱 성공: $serialNumber")
                        viewModel.fetchDeviceInfo(serialNumber)
                    } catch (e: Exception) {
                        Log.e("MainScreen", "✗ Serial Number 파싱 실패", e)
                        showToast("올바른 기기 QR 코드가 아닙니다.", false)
                        onDeviceKeyboardInputChange("")
                        onDeviceScanModeChange(ScanMode.IDLE)
                        activity?.stopScan()
                        return@OutlinedTextField
                    }

                    onDeviceKeyboardInputChange("")
                }
            },
            modifier = Modifier
                .height(1.dp)
                .width(1.dp)
                .alpha(0f)
                .focusRequester(deviceFocusRequester)
                .onFocusChanged { focusState ->
                    if (focusState.isFocused) {
                        keyboardController?.hide()
                    }
                },
            label = { },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.None)
        )

        // 스캔 시작/중지 LaunchedEffect
        LaunchedEffect(deviceScanMode) {
            when (deviceScanMode) {
                ScanMode.SCANNER -> {
                    try {
                        keyboardController?.hide()
                        viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.DEVICE)
                        deviceFocusRequester.requestFocus()
                        activity?.startScan()
                    } catch (e: Exception) {
                        Log.e("MainScreen", "스캔 시작 실패", e)
                        onDeviceScanModeChange(ScanMode.IDLE)
                    }
                }
                ScanMode.CAMERA -> {
                    try {
                        keyboardController?.hide()
                        viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.DEVICE)
                    } catch (e: Exception) {
                        Log.e("MainScreen", "카메라 스캔 시작 실패", e)
                        onDeviceScanModeChange(ScanMode.IDLE)
                    }
                }
                ScanMode.IDLE -> {
                    try {
                        activity?.stopScan()
                    } catch (e: Exception) {
                        Log.e("MainScreen", "스캔 중지 실패", e)
                    }
                }
            }
        }

    }

    // === 수동 입력 탭 ===
    if (deviceTabIndex == 1) {
        // 기기 시리얼 번호 라벨
        Text(
            text = "기기 시리얼 번호 (S/N)",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF0F172A),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp)
        )

        OutlinedTextField(
            value = manualSerialNumber,
            onValueChange = { manualSerialNumber = it },
            placeholder = { Text("시리얼 번호를 입력해주세요", color = Color(0xFF64748B)) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF009EE6),
                unfocusedBorderColor = Color(0xFFE2E8F0),
                focusedTextColor = Color(0xFF0F172A),
                unfocusedTextColor = Color(0xFF0F172A),
                cursorColor = Color(0xFF0F172A),
                unfocusedPlaceholderColor = Color(0xFF64748B),
                focusedPlaceholderColor = Color(0xFF64748B)
            )
        )

        // 기기 조회 버튼
        Button(
            onClick = {
                if (manualSerialNumber.isNotBlank()) {
                    viewModel.setCurrentScanTarget(MainViewModel.ScanTarget.DEVICE)
                    viewModel.updateScanData("serial_number: $manualSerialNumber")
                    viewModel.fetchDeviceInfo(manualSerialNumber.trim())
                } else {
                    showToast("시리얼 번호를 입력해주세요.", false)
                }
            },
            enabled = manualSerialNumber.isNotBlank(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF009EE6),
                contentColor = Color.White,
                disabledContainerColor = Color(0xFFE2E8F0),
                disabledContentColor = Color(0xFF94A3B8)
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            Text(
                text = "기기 조회",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
        }

        // 기기 정보 표시 (조회 완료 시)
        if (deviceScanned && scanData.deviceInfo != null) {
            Spacer(modifier = Modifier.height(16.dp))
            DeviceInfoCard(deviceInfo = scanData.deviceInfo!!)
        }
    }
}

// 기기 정보 카드 (QR 스캔/수동 입력 공통)
@Composable
private fun DeviceInfoCard(deviceInfo: DeviceResponse) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFF0FDF4)
        ),
        border = BorderStroke(1.dp, Color(0xFFBBF7D0))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // 기기 확인됨 헤더
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(Color(0xFF22C55E), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "✓",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "기기 확인됨",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF16A34A)
                )
            }

            // 기기명
            Text(
                text = buildAnnotatedString {
                    withStyle(style = SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFF64748B))) {
                        append("기기명: ")
                    }
                    withStyle(style = SpanStyle(color = Color(0xFF0F172A))) {
                        append(deviceInfo.device_name)
                    }
                },
                fontSize = 14.sp,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            // 시리얼
            Text(
                text = buildAnnotatedString {
                    withStyle(style = SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFF64748B))) {
                        append("S/N: ")
                    }
                    withStyle(style = SpanStyle(color = Color(0xFF0F172A))) {
                        append(deviceInfo.serial_number)
                    }
                },
                fontSize = 14.sp,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            // 배터리
            Text(
                text = buildAnnotatedString {
                    withStyle(style = SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFF64748B))) {
                        append("배터리: ")
                    }
                    withStyle(style = SpanStyle(color = Color(0xFF0F172A))) {
                        append("${deviceInfo.battery_percent}%")
                    }
                },
                fontSize = 14.sp
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun MainScreenPreview() {
    MainScreen()
}
