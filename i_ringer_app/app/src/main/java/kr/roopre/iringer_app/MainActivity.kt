package kr.roopre.iringer_app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import kr.roopre.iringer_app.di.totalProvider
import kr.roopre.iringer_app.navigation.AppNavigation
import kr.roopre.iringer_app.presentation.main.MainViewModel
import kr.roopre.iringer_app.presentation.main.MainViewModelFactory
import kr.roopre.iringer_app.presentation.main.ScanReceiver
import com.google.firebase.messaging.FirebaseMessaging
import kr.roopre.iringer_app.ui.theme.Iringer_appTheme

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels {
        MainViewModelFactory(
            patientRepository = totalProvider.patientRepository,
            deviceRepository = totalProvider.deviceRepository,
            userSettingsRepository = totalProvider.userSettingsRepository
        )
    }

    // BroadcastReceiver for scanning
    lateinit var scanReceiver: ScanReceiver
        private set

    // Urovo SDK
    private var mScanManager: android.device.ScanManager? = null
    var hasHardwareScanner: Boolean = false
        private set

    // External callback for monitoring sub-screens (수액 추가/교체, 기기 교체)
    var externalBarcodeCallback: ((String) -> Unit)? = null

    // Point Mobile SDK (리플렉션)
    private var mPmScanManager: Any? = null
    private var pmTriggerMethod: java.lang.reflect.Method? = null
    private var pmSetResultTypeMethod: java.lang.reflect.Method? = null
    private var isPointMobileDevice: Boolean = false

    companion object {
        private const val TAG = "MainActivity"
    }

    // 중복 스캔 방지를 위한 변수
    private var lastScannedData: String = ""
    private var lastScannedTime: Long = 0L
    private val DUPLICATE_SCAN_THRESHOLD_MS = 2000L // 2초 이내 중복 무시

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 알림 권한 요청 (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1001)
        }

        // FCM 토큰 조회
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                Log.d(TAG, "FCM 토큰: ${task.result}")
            } else {
                Log.e(TAG, "FCM 토큰 조회 실패", task.exception)
            }
        }

        // BroadcastReceiver 초기화 (PM ScanManager 참조 전달)
        scanReceiver = ScanReceiver(
            onDataReceived = { barcode ->
            // Log.d(TAG, "===== 스캔 데이터 수신됨 (Intent) =====")
            // Log.d(TAG, "Barcode (원본): ${barcode.take(100)}")

            // URL 디코딩 - 유효한 퍼센트 인코딩(%XX)이 있을 때만 적용
            // "5%" 같은 데이터 내 퍼센트 문자가 Uri.decode에 의해 손상되는 것을 방지
            val decoded = try {
                if (barcode.contains(Regex("%[0-9A-Fa-f]{2}"))) {
                    Uri.decode(barcode)
                } else {
                    barcode
                }
            } catch (e: Exception) {
                Log.e(TAG, "URL 디코딩 실패", e)
                barcode
            }
            // Log.d(TAG, "Barcode (디코딩): ${decoded.take(100)}")
            Log.d(TAG, "Current scan target: ${viewModel.currentScanTarget.value}")

            // 중복 스캔 방지 (같은 데이터를 2초 이내에 다시 스캔하면 무시)
            val currentTime = System.currentTimeMillis()
            if (decoded == lastScannedData && (currentTime - lastScannedTime) < DUPLICATE_SCAN_THRESHOLD_MS) {
                Log.d(TAG, "⚠️ 중복 스캔 감지, 무시함 (${currentTime - lastScannedTime}ms 이내)")
                return@ScanReceiver
            }
            lastScannedData = decoded
            lastScannedTime = currentTime

            // External callback for monitoring sub-screens
            val externalCb = externalBarcodeCallback
            if (externalCb != null) {
                externalCb(decoded)
                runOnUiThread {
                    try { stopScan() } catch (e: Exception) { Log.e(TAG, "Failed to stop scan", e) }
                }
                return@ScanReceiver
            }

            // ⚠️ IMPORTANT: currentScanTarget을 미리 저장 (updateScanData 호출 시 NONE으로 초기화되기 때문)
            val scanTarget = viewModel.currentScanTarget.value

            // 물리적 스캔 시 타겟이 NONE이면 QR 데이터로 판단
            val isDeviceQr = decoded.contains("serial_number", ignoreCase = true)
            val shouldCallDeviceApi = if (scanTarget == kr.roopre.iringer_app.presentation.main.MainViewModel.ScanTarget.NONE) {
                // 물리적 스캔: QR 데이터에 serial_number가 있으면 기기 QR
                isDeviceQr && viewModel.scanData.value.patientQrCode.isNotEmpty()
            } else {
                // QR 스캔 버튼: 타겟이 DEVICE인 경우
                scanTarget == kr.roopre.iringer_app.presentation.main.MainViewModel.ScanTarget.DEVICE
            }

            // QR 코드 유효성 검사
            var validationErrorMessage: String? = null
            val isValidQr = try {
                when (scanTarget) {
                    kr.roopre.iringer_app.presentation.main.MainViewModel.ScanTarget.PATIENT -> {
                        // 환자 QR: bed_id 필수
                        val patientData = com.google.gson.Gson().fromJson(
                            decoded,
                            com.google.gson.JsonObject::class.java
                        )
                        val bedId = patientData.get("bed_id")?.asInt
                        if (bedId == null) {
                            Log.e(TAG, "✗ 올바른 환자 QR 코드가 아닙니다 (bed_id 없음)")
                            validationErrorMessage = "올바른 환자 QR 코드가 아닙니다."
                            false
                        } else {
                            true
                        }
                    }
                    kr.roopre.iringer_app.presentation.main.MainViewModel.ScanTarget.INFUSION -> {
                        // 수액 QR: assignment_id 필수
                        val infusionData = com.google.gson.Gson().fromJson(
                            decoded,
                            com.google.gson.JsonObject::class.java
                        )
                        val assignmentId = infusionData.get("assignment_id")?.asInt
                        if (assignmentId == null) {
                            Log.e(TAG, "✗ 올바른 수액 QR 코드가 아닙니다 (assignment_id 없음)")
                            validationErrorMessage = "올바른 수액 QR 코드가 아닙니다."
                            false
                        } else {
                            true
                        }
                    }
                    kr.roopre.iringer_app.presentation.main.MainViewModel.ScanTarget.DEVICE -> {
                        // 기기 QR: serial_number 필수
                        val regex = "serial_number\\s*:\\s*([^\\s]+)".toRegex(RegexOption.IGNORE_CASE)
                        val match = regex.find(decoded)
                        val serialNumber = match?.groupValues?.get(1)

                        if (serialNumber.isNullOrEmpty()) {
                            Log.e(TAG, "✗ 올바른 기기 QR 코드가 아닙니다 (serial_number 없음)")
                            validationErrorMessage = "올바른 기기 QR 코드가 아닙니다."
                            false
                        } else {
                            true
                        }
                    }
                    else -> true  // NONE은 별도 검증 없음
                }
            } catch (e: Exception) {
                Log.e(TAG, "✗ QR 코드 유효성 검사 실패", e)
                validationErrorMessage = "올바른 QR 코드가 아닙니다."
                false
            }

            // 유효하지 않은 QR 코드면 에러 전달 후 중단
            if (!isValidQr) {
                Log.e(TAG, "✗ 유효하지 않은 QR 코드, 스캔 무시")
                // ViewModel을 통해 에러 메시지 전달 (MainScreen의 커스텀 토스트로 표시)
                viewModel.setScanError(validationErrorMessage ?: "올바른 QR 코드가 아닙니다.")
                // QR 스캔 버튼으로 시작한 연속 스캔 모드는 중지하지 않음 (계속 스캔 가능)
                // 물리적 버튼으로 시작한 PULSE 모드는 자동으로 한 번만 스캔됨
                return@ScanReceiver
            }

            // 기기 QR 스캔인 경우 API 호출 (updateScanData 전에 실행)
            if (shouldCallDeviceApi) {
                Log.d(TAG, "===== 기기 QR 감지됨, API 호출 시작 =====")
                try {
                    // serial_number 파싱 (serial_number:iRinger-08Nw 형식)
                    var serialNumber: String? = null

                    val regex = "serial_number\\s*:\\s*([^\\s]+)".toRegex(RegexOption.IGNORE_CASE)
                    val match = regex.find(decoded)
                    serialNumber = match?.groupValues?.get(1)

                    if (!serialNumber.isNullOrEmpty()) {
                        Log.d(TAG, "✓ Serial Number 파싱 성공: $serialNumber")
                        Log.d(TAG, "✓ API 호출 시작: /api/devices?where=serial_number:$serialNumber")
                        viewModel.fetchDeviceInfo(serialNumber)
                    } else {
                        Log.e(TAG, "✗ Serial Number를 찾을 수 없음. QR 데이터: $decoded")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "✗ Serial Number 파싱 실패", e)
                }
            }

            // 환자 QR인 경우 할당 상태 확인 후 API에서 데이터 가져오기
            if (scanTarget == kr.roopre.iringer_app.presentation.main.MainViewModel.ScanTarget.PATIENT) {
                val patientData = com.google.gson.Gson().fromJson(
                    decoded,
                    com.google.gson.JsonObject::class.java
                )
                val bedId = patientData.get("bed_id")?.asInt
                if (bedId != null) {
                    viewModel.checkBedAssignmentStatus(
                        bedId = bedId,
                        onAlreadyAssigned = {
                            Log.d(TAG, "⚠️ 환자가 이미 다른 기기에 연결됨 - 스캔 데이터 업데이트 안함")
                            viewModel.setScanError("ALREADY_ASSIGNED")
                        },
                        onAvailable = {
                            val assignmentId = patientData.get("assignment_id")?.asInt
                            val patientId = patientData.get("patient_id")?.asInt
                            if (assignmentId != null) {
                                // 수액 QR → 환자+수액 정보 한번에 처리
                                viewModel.processInfusionQrWithPatient(bedId, assignmentId, patientId)
                                Log.d(TAG, "✓ 수액 QR로 환자+수액 통합 처리: assignment_id=$assignmentId")
                            } else {
                                // 환자 QR → 기존 처리
                                viewModel.updateScanData(decoded)
                                viewModel.fetchAndUpdatePatientInfo(bedId)
                                Log.d(TAG, "✓ 환자 QR 스캔 완료")
                            }
                        },
                        onError = { errorMsg ->
                            Log.e(TAG, "할당 상태 확인 실패: $errorMsg")
                            viewModel.setScanError(errorMsg)
                        }
                    )
                }
            } else if (scanTarget == kr.roopre.iringer_app.presentation.main.MainViewModel.ScanTarget.INFUSION) {
                // 수액 QR: 환자 정보가 없으면 환자 정보도 함께 처리
                try {
                    val infusionData = com.google.gson.Gson().fromJson(
                        decoded,
                        com.google.gson.JsonObject::class.java
                    )
                    val assignmentId = infusionData.get("assignment_id")?.asInt
                    val bedId = infusionData.get("bed_id")?.asInt
                    val patientId = infusionData.get("patient_id")?.asInt
                    if (assignmentId != null) {
                        viewModel.updateScanData(decoded)
                        if (bedId != null) {
                            viewModel.processInfusionQrWithPatient(bedId, assignmentId, patientId)
                        } else {
                            viewModel.fetchInfusionByAssignmentId(assignmentId)
                        }
                        Log.d(TAG, "✓ 수액 QR 스캔 완료: assignment_id=$assignmentId, bed_id=$bedId")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "수액 QR 파싱 실패", e)
                }
            } else {
                // 기기 QR 등 기타: 바로 업데이트
                viewModel.updateScanData(decoded)
            }

            // Log.d(TAG, "ViewModel 업데이트 완료")
            // Log.d(TAG, "Patient QR: ${viewModel.scanData.value.patientQrCode.take(100)}")
            // Log.d(TAG, "Infusion QR: ${viewModel.scanData.value.infusionQrCode.take(100)}")
            // Log.d(TAG, "Device QR: ${viewModel.scanData.value.deviceQrCode.take(100)}")

            // UI 피드백
            runOnUiThread {
                // 스캔 성공 시 자동으로 스캔 중지
                try {
                    stopScan()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to stop scan", e)
                }
            }
        })

        // 1차: Urovo SDK 초기화
        try {
            mScanManager = android.device.ScanManager()
            val opened = mScanManager?.openScanner()
            if (opened == true) {
                hasHardwareScanner = true
                mScanManager?.closeScanner()
                Log.d(TAG, "✓ Urovo 하드웨어 스캐너 감지됨")
            } else {
                hasHardwareScanner = false
                mScanManager = null
                Log.d(TAG, "Urovo 스캐너 없음 (openScanner 실패)")
            }
        } catch (e: Exception) {
            hasHardwareScanner = false
            mScanManager = null
            Log.d(TAG, "Urovo SDK 없음: ${e.message}")
        }

        // 2차: Urovo 실패 시 Point Mobile SDK 시도 (리플렉션)
        if (!hasHardwareScanner) {
            try {
                val pmClass = Class.forName("device.sdk.ScanManager")
                mPmScanManager = pmClass.getDeclaredConstructor().newInstance()
                pmTriggerMethod = pmClass.getMethod("aDecodeSetTriggerOn", Int::class.javaPrimitiveType)

                // 결과 타입을 USERMSG(2)로 설정 → 브로드캐스트로 결과 전달
                pmSetResultTypeMethod = pmClass.getMethod("aDecodeSetResultType", Int::class.javaPrimitiveType)
                pmSetResultTypeMethod?.invoke(mPmScanManager, 2) // ScanConst.ResultType.DCD_RESULT_USERMSG

                hasHardwareScanner = true
                isPointMobileDevice = true
                // ScanReceiver에 PM ScanManager 참조 전달
                scanReceiver.pmScanManagerRef = mPmScanManager
                Log.d(TAG, "✓ Point Mobile 하드웨어 스캐너 감지됨")
            } catch (e: Exception) {
                mPmScanManager = null
                pmTriggerMethod = null
                Log.d(TAG, "Point Mobile SDK 없음: ${e.message}")
            }
        }

        // 3차: SDK 없지만 제조사가 Point Mobile인 경우 (ScanSettings Intent Broadcast 모드 필요)
        if (!hasHardwareScanner) {
            val manufacturer = Build.MANUFACTURER?.lowercase() ?: ""
            if (manufacturer.contains("point") && manufacturer.contains("mobile") ||
                manufacturer.contains("pointmobile")) {
                hasHardwareScanner = false  // SDK 없이는 소프트웨어 트리거 불가 → 카메라 모드 사용
                isPointMobileDevice = true
                Log.d(TAG, "Point Mobile 기기 감지됨 (SDK 없음) - 물리 버튼만 사용 가능, 소프트웨어 트리거는 카메라 모드")
            }
        }

        if (!hasHardwareScanner && !isPointMobileDevice) {
            Log.d(TAG, "하드웨어 스캐너 없음, 카메라 스캔 모드 사용")
        }

        setContent {
            Iringer_appTheme {
                val navController = rememberNavController()
                AppNavigation(
                    navController = navController,
                    mainViewModel = viewModel,  // MainActivity의 viewModel 전달
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()

        // Log.d(TAG, "===== onResume 시작 =====")

        // BroadcastReceiver 등록
        val filter = IntentFilter().apply {
            addAction(ScanReceiver.ACTION_DECODE_DATA)
            addAction(ScanReceiver.ACTION_UROVO_MESSAGE)
            addAction("android.intent.ACTION_DECODE_DATA")  // 대문자 버전도 추가
            // Point Mobile USERMSG 브로드캐스트
            if (isPointMobileDevice) {
                addAction(ScanReceiver.ACTION_PM_USERMSG)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(scanReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(scanReceiver, filter)
        }
        // Log.d(TAG, "✓ BroadcastReceiver 등록됨 - Actions: ${ScanReceiver.ACTION_DECODE_DATA}, ${ScanReceiver.ACTION_UROVO_MESSAGE}")

        // 스캐너 전원 켜기 (하드웨어 스캐너가 있는 경우���만)
        if (hasHardwareScanner && mScanManager != null) {
            // Urovo 스캐너
            try {
                val powerOn = mScanManager?.openScanner()
                if (powerOn == false) {
                    Log.e(TAG, "openScanner failed")
                    return
                }
                mScanManager?.setTriggerMode(android.device.scanner.configuration.Triggering.PULSE)
                mScanManager?.unlockTrigger()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to open Urovo scanner", e)
            }
        }
        // Point Mobile 스캐너: 결과 수신 모드 재설정 (onPause에서 해제했으므로)
        if (isPointMobileDevice && pmSetResultTypeMethod != null) {
            try {
                pmSetResultTypeMethod?.invoke(mPmScanManager, 2) // USERMSG 모드 재연결
            } catch (e: Exception) {
                Log.e(TAG, "Failed to set PM result type", e)
            }
        }
    }

    override fun onPause() {
        super.onPause()

        // BroadcastReceiver 등록 해제
        try {
            unregisterReceiver(scanReceiver)
            // Log.d(TAG, "✓ BroadcastReceiver 등록 해제됨")
        } catch (e: IllegalArgumentException) {
            Log.e(TAG, "Receiver not registered", e)
        }

        // 스캐너 리소스 해제
        if (hasHardwareScanner && mScanManager != null) {
            // Urovo 스캐너
            try {
                mScanManager?.stopDecode()
                mScanManager?.closeScanner()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to close Urovo scanner", e)
            }
        } else if (isPointMobileDevice) {
            // Point Mobile 스캐너 - 트리거 중지 + 스캔 서비스 바인딩 해제
            if (pmTriggerMethod != null) {
                try {
                    pmTriggerMethod?.invoke(mPmScanManager, 0)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to stop PM scanner", e)
                }
            }
            if (pmSetResultTypeMethod != null) {
                try {
                    pmSetResultTypeMethod?.invoke(mPmScanManager, 0) // 결과 수신 해제 → EMR 스캐너 사용 가능
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to reset PM result type", e)
                }
            }
        }
    }

    /**
     * 스캔 시작 (MainScreen에서 호출)
     * Urovo: CONTINUOUS 모드 + startDecode
     * Point Mobile: aDecodeSetTriggerOn(1)
     */
    fun startScan() {
        if (!hasHardwareScanner) return

        if (mScanManager != null) {
            // Urovo 스캐너
            try {
                mScanManager?.setTriggerMode(android.device.scanner.configuration.Triggering.CONTINUOUS)
                mScanManager?.unlockTrigger()
                val result = mScanManager?.startDecode()
                if (result != true) {
                    Log.e(TAG, "Urovo startDecode failed")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start Urovo decode", e)
            }
        } else if (pmTriggerMethod != null) {
            // Point Mobile 스캐너
            try {
                pmTriggerMethod?.invoke(mPmScanManager, 1)
                Log.d(TAG, "✓ PM 스캔 트리거 시작")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start PM decode", e)
            }
        }
    }

    /**
     * 스캔 중지
     * Urovo: stopDecode + PULSE 모드
     * Point Mobile: aDecodeSetTriggerOn(0)
     */
    fun stopScan() {
        if (!hasHardwareScanner) return

        if (mScanManager != null) {
            // Urovo 스캐너
            try {
                mScanManager?.stopDecode()
                mScanManager?.setTriggerMode(android.device.scanner.configuration.Triggering.PULSE)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop Urovo decode", e)
            }
        } else if (pmTriggerMethod != null) {
            // Point Mobile 스캐너
            try {
                pmTriggerMethod?.invoke(mPmScanManager, 0)
                Log.d(TAG, "✓ PM 스캔 트리거 중지")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop PM decode", e)
            }
        }
    }
}
