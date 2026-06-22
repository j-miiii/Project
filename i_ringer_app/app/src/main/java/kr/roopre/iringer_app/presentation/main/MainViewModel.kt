package kr.roopre.iringer_app.presentation.main

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.common.ApiResult
import kr.roopre.iringer_app.data.remote.dto.DeviceResponse
import kr.roopre.iringer_app.data.repository.DeviceRepository
import kr.roopre.iringer_app.data.repository.PatientRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ScanData(
    val patientQrCode: String = "",
    val infusionQrCode: String = "",
    val deviceQrCode: String = "",
    val deviceInfo: DeviceResponse? = null
)

data class ScanError(
    val message: String = "",
    val timestamp: Long = 0L
)

data class InfusionAutoFill(
    val infusionType: String = "",
    val infusionVolume: Int = 0,
    val infusionCchr: Int = 0,
    val timestamp: Long = 0L
)

class MainViewModel(
    private val patientRepository: PatientRepository,
    private val deviceRepository: DeviceRepository,
    private val userSettingsRepository: kr.roopre.iringer_app.data.repository.UserSettingsRepository? = null
) : ViewModel() {

    private val _infusionOptions = MutableStateFlow<List<kr.roopre.iringer_app.presentation.monitoring.InfusionOption>>(emptyList())
    val infusionOptions: StateFlow<List<kr.roopre.iringer_app.presentation.monitoring.InfusionOption>> = _infusionOptions.asStateFlow()

    private val _infusionOptionsLoading = MutableStateFlow(false)
    val infusionOptionsLoading: StateFlow<Boolean> = _infusionOptionsLoading.asStateFlow()

    fun loadInfusionOptions() {
        if (_infusionOptions.value.isNotEmpty()) return
        val repo = userSettingsRepository ?: return
        viewModelScope.launch {
            _infusionOptionsLoading.value = true
            when (val result = repo.getInfusionOptions()) {
                is kr.roopre.iringer_app.data.common.ApiResult.Success -> {
                    _infusionOptions.value = result.data.map { dto ->
                        kr.roopre.iringer_app.presentation.monitoring.InfusionOption(
                            id = dto.id,
                            code = dto.code,
                            name = dto.name,
                            defaultVolume = dto.defaultVolume,
                            defaultCchr = dto.defaultCchr
                        )
                    }
                }
                is kr.roopre.iringer_app.data.common.ApiResult.Error -> {
                    Log.e(TAG, "수액 프리셋 로드 실패: ${result.message}")
                }
            }
            _infusionOptionsLoading.value = false
        }
    }

    private val _scanData = MutableStateFlow(ScanData())
    val scanData: StateFlow<ScanData> = _scanData.asStateFlow()

    private val _currentScanTarget = MutableStateFlow<ScanTarget>(ScanTarget.NONE)
    val currentScanTarget: StateFlow<ScanTarget> = _currentScanTarget.asStateFlow()

    private val _scanError = MutableStateFlow(ScanError())
    val scanError: StateFlow<ScanError> = _scanError.asStateFlow()

    private val _infusionAutoFill = MutableStateFlow(InfusionAutoFill())
    val infusionAutoFill: StateFlow<InfusionAutoFill> = _infusionAutoFill.asStateFlow()

    // 중복 스캔 방지를 위한 마지막 스캔 데이터 및 시간
    private var lastScannedBarcode: String = ""
    private var lastScannedTime: Long = 0L
    private val DUPLICATE_SCAN_THRESHOLD_MS = 1000L // 1초 이내 중복 무시

    companion object {
        private const val TAG = "MainViewModel"
    }

    enum class ScanTarget {
        NONE,
        PATIENT,
        INFUSION,
        DEVICE
    }

    fun setCurrentScanTarget(target: ScanTarget) {
        _currentScanTarget.value = target
    }

    fun setScanError(message: String) {
        _scanError.value = ScanError(message = message, timestamp = System.currentTimeMillis())
    }

    fun setInfusionAutoFill(type: String, volume: Int, cchr: Int) {
        _infusionAutoFill.value = InfusionAutoFill(type, volume, cchr, System.currentTimeMillis())
    }

    fun clearInfusionAutoFill() {
        _infusionAutoFill.value = InfusionAutoFill()
    }

    @Synchronized
    fun updateScanData(barcode: String) {
        lastScannedBarcode = barcode
        lastScannedTime = System.currentTimeMillis()

        val targetToUse = _currentScanTarget.value

        Log.d(TAG, "스캔 타겟: $targetToUse (바코드: ${barcode.take(50)})")

        when (targetToUse) {
            ScanTarget.PATIENT -> {
                _scanData.value = _scanData.value.copy(patientQrCode = barcode)
                Log.d(TAG, "PATIENT QR 저장 완료 (덮어쓰기)")
            }
            ScanTarget.INFUSION -> {
                _scanData.value = _scanData.value.copy(infusionQrCode = barcode)
                Log.d(TAG, "INFUSION QR 저장 완료 (덮어쓰기)")
            }
            ScanTarget.DEVICE -> {
                _scanData.value = _scanData.value.copy(deviceQrCode = barcode)
                Log.d(TAG, "DEVICE QR 저장 완료 (덮어쓰기)")
            }
            ScanTarget.NONE -> {
                Log.d(TAG, "스캔 타겟이 설정되지 않음, 스캔 무시")
            }
        }
    }

    fun isPatientScanned(): Boolean = _scanData.value.patientQrCode.isNotEmpty()
    fun isInfusionScanned(): Boolean = _scanData.value.infusionQrCode.isNotEmpty()
    fun isDeviceScanned(): Boolean = _scanData.value.deviceQrCode.isNotEmpty()

    fun fetchDeviceInfo(serialNumber: String) {
        viewModelScope.launch {
            when (val result = deviceRepository.getDeviceBySerialNumber(serialNumber)) {
                is ApiResult.Success -> {
                    val device = result.data
                    // 이미 다른 침상에서 사용 중인 기기인지 체크
                    if (device.bed_id != null) {
                        Log.e(TAG, "기기 이미 사용 중: ${device.device_name} (bed_id=${device.bed_id})")
                        _scanError.value = ScanError("DEVICE_ALREADY_IN_USE", System.currentTimeMillis())
                        _scanData.value = _scanData.value.copy(deviceQrCode = "", deviceInfo = null)
                        return@launch
                    }
                    _scanData.value = _scanData.value.copy(deviceInfo = device)
                    Log.d(TAG, "기기 정보 로드 성공: $device")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "기기 정보 로드 실패: ${result.message}")
                    _scanError.value = ScanError(result.message, System.currentTimeMillis())
                }
            }
        }
    }

    fun clearPatientQr() {
        _scanData.value = _scanData.value.copy(patientQrCode = "")
        Log.d(TAG, "환자 QR 코드 초기화됨")
    }

    fun clearInfusionQr() {
        _scanData.value = _scanData.value.copy(infusionQrCode = "")
        Log.d(TAG, "수액 QR 코드 초기화됨")
    }

    fun clearDeviceQr() {
        _scanData.value = _scanData.value.copy(deviceQrCode = "", deviceInfo = null)
        Log.d(TAG, "기기 QR 코드 및 기기 정보 초기화됨")
    }

    fun fetchAndUpdatePatientInfo(bedId: Int) {
        viewModelScope.launch {
            Log.d(TAG, "환자 정보 API 조회 시작: bed_id=$bedId")
            when (val result = patientRepository.getAssignmentsByBedId(bedId)) {
                is ApiResult.Success -> {
                    val assignments = result.data
                    if (assignments.isNotEmpty()) {
                        val a = assignments.first()

                        val existingQr = try {
                            Gson().fromJson(_scanData.value.patientQrCode, JsonObject::class.java)
                        } catch (e: Exception) { JsonObject() }

                        val cleanData = JsonObject().apply {
                            existingQr.entrySet().forEach { (key, value) ->
                                add(key, value)
                            }
                            if (!a.patient_name.isNullOrEmpty()) {
                                addProperty("patient_name", a.patient_name)
                                addProperty("name", a.patient_name)
                            }
                            if (!a.chart_number.isNullOrEmpty()) addProperty("chart_number", a.chart_number)
                            if (!a.sex.isNullOrEmpty()) addProperty("sex", a.sex)
                            a.age?.let { addProperty("age", it) }
                            if (!a.hospital_name.isNullOrEmpty()) addProperty("hospital_name", a.hospital_name)
                            if (!a.ward_name.isNullOrEmpty()) addProperty("ward_name", a.ward_name)
                            val roomNum = a.room_number ?: a.room_name
                            if (!roomNum.isNullOrEmpty()) addProperty("room_number", roomNum)
                            if (!a.bed_number.isNullOrEmpty()) addProperty("bed_number", a.bed_number)
                            if (!a.infusion_type.isNullOrEmpty()) addProperty("infusion_type", a.infusion_type)
                            a.infusion_total_volume?.let { addProperty("infusion_total_volume", it) }
                            a.infusion_cchr?.let { addProperty("infusion_cchr", it) }
                        }

                        _scanData.value = _scanData.value.copy(patientQrCode = cleanData.toString())
                        Log.d(TAG, "환자 정보 API 업데이트 완료: ${a.patient_name}")

                        if (!a.infusion_type.isNullOrEmpty()) {
                            setInfusionAutoFill(
                                a.infusion_type!!,
                                a.infusion_total_volume ?: 0,
                                a.infusion_cchr?.toInt() ?: 0
                            )
                            Log.d(TAG, "수액 자동 입력 (API): ${a.infusion_type}")
                        }
                    } else {
                        Log.d(TAG, "bed_id=$bedId 에 대한 할당 정보 없음, QR 데이터 유지")
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "환자 정보 API 조회 실패: ${result.message}")
                }
            }
        }
    }

    fun processInfusionQrWithPatient(bedId: Int, assignmentId: Int, patientId: Int? = null) {
        viewModelScope.launch {
            Log.d(TAG, "수액 QR 통합 처리 시작: assignment_id=$assignmentId, bed_id=$bedId, patient_id=$patientId")
            when (val result = patientRepository.getAssignmentById(assignmentId)) {
                is ApiResult.Success -> {
                    val a = result.data

                    // 1. 환자 정보 채우기
                    if (_scanData.value.patientQrCode.isEmpty()) {
                        val patientJson = JsonObject().apply {
                            addProperty("type", "patient")
                            addProperty("bed_id", bedId)
                            patientId?.let { addProperty("patient_id", it) }
                            if (!a.patient_name.isNullOrEmpty()) {
                                addProperty("patient_name", a.patient_name)
                                addProperty("name", a.patient_name)
                            }
                            if (!a.chart_number.isNullOrEmpty()) addProperty("chart_number", a.chart_number)
                            if (!a.sex.isNullOrEmpty()) addProperty("sex", a.sex)
                            a.age?.let { addProperty("age", it) }
                            if (!a.hospital_name.isNullOrEmpty()) addProperty("hospital_name", a.hospital_name)
                            if (!a.ward_name.isNullOrEmpty()) addProperty("ward_name", a.ward_name)
                            val roomNum = a.room_number ?: a.room_name
                            if (!roomNum.isNullOrEmpty()) addProperty("room_number", roomNum)
                            if (!a.bed_number.isNullOrEmpty()) addProperty("bed_number", a.bed_number)
                            if (!a.infusion_type.isNullOrEmpty()) addProperty("infusion_type", a.infusion_type)
                            a.infusion_total_volume?.let { addProperty("infusion_total_volume", it) }
                            a.infusion_cchr?.let { addProperty("infusion_cchr", it) }
                        }
                        _scanData.value = _scanData.value.copy(patientQrCode = patientJson.toString())
                        Log.d(TAG, "환자 정보 설정 완료: ${a.patient_name}")
                    }

                    // 2. 수액 정보 자동 입력
                    val infType = a.infusion_type ?: ""
                    val infVol = a.infusion_total_volume ?: 0
                    val infCchr = a.infusion_cchr?.toInt() ?: 0
                    if (infType.isNotEmpty()) {
                        setInfusionAutoFill(infType, infVol, infCchr)
                        Log.d(TAG, "수액 자동 입력: $infType / ${infVol}ml / ${infCchr}cc/hr")
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 QR 통합 처리 실패: ${result.message}")
                    _scanError.value = ScanError(result.message, System.currentTimeMillis())
                }
            }
        }
    }

    fun fetchInfusionByAssignmentId(assignmentId: Int) {
        viewModelScope.launch {
            Log.d(TAG, "수액 정보 API 조회 시작: assignment_id=$assignmentId")
            when (val result = patientRepository.getAssignmentById(assignmentId)) {
                is ApiResult.Success -> {
                    val a = result.data
                    val infType = a.infusion_type ?: ""
                    val infVol = a.infusion_total_volume ?: 0
                    val infCchr = a.infusion_cchr?.toInt() ?: 0

                    if (infType.isNotEmpty()) {
                        setInfusionAutoFill(infType, infVol, infCchr)
                        Log.d(TAG, "수액 자동 입력 (API): $infType / ${infVol}ml / ${infCchr}cc/hr")
                    } else {
                        Log.d(TAG, "assignment_id=$assignmentId 의 수액 종류가 비어있음")
                        _scanError.value = ScanError("수액 정보를 찾을 수 없습니다.", System.currentTimeMillis())
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 정보 API 조회 실패: ${result.message}")
                    _scanError.value = ScanError(result.message, System.currentTimeMillis())
                }
            }
        }
    }

    fun insertData(
        tableName: String,
        data: JsonObject,
        onSuccess: (JsonObject) -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "데이터 삽입 시작: $tableName")
            when (val result = patientRepository.insertData(tableName, data)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "데이터 삽입 성공: ${result.data}")
                    onSuccess(result.data)
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "데이터 삽입 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun checkBedAssignmentStatus(
        bedId: Int,
        onAlreadyAssigned: () -> Unit,
        onAvailable: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "병상 할당 상태 확인 시작: bed_id=$bedId")
            when (val result = patientRepository.checkBedAssignmentStatus(bedId)) {
                is ApiResult.Success -> {
                    val body = result.data
                    val dataArray = body.getAsJsonArray("data")

                    if (dataArray != null && dataArray.size() > 0) {
                        val activeCount = dataArray.count { item ->
                            val obj = item.asJsonObject
                            val deviceId = obj.get("device_id")
                            val releasedAt = obj.get("released_at")
                            val hasDevice = deviceId != null && !deviceId.isJsonNull
                            val isReleased = releasedAt != null && !releasedAt.isJsonNull
                            hasDevice && !isReleased
                        }

                        Log.d(TAG, "활성 기기 연결 수: $activeCount / 최대 3개")

                        if (activeCount >= 3) {
                            Log.d(TAG, "최대 기기 연결 수(3개) 초과")
                            onAlreadyAssigned()
                        } else {
                            Log.d(TAG, "할당 가능 ($activeCount/3 사용중)")
                            onAvailable()
                        }
                    } else {
                        Log.d(TAG, "할당 가능 (기존 할당 정보 없음)")
                        onAvailable()
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "할당 상태 확인 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun upsertPatientBedAssignment(
        data: JsonObject,
        onSuccess: (JsonObject) -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "환자 병상 할당 Upsert 시작")
            when (val result = patientRepository.upsertAssignment(data)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "Upsert 성공: ${result.data}")
                    onSuccess(result.data)
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "Upsert 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

}

class MainViewModelFactory(
    private val patientRepository: PatientRepository,
    private val deviceRepository: DeviceRepository,
    private val userSettingsRepository: kr.roopre.iringer_app.data.repository.UserSettingsRepository? = null
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MainViewModel::class.java)) {
            return MainViewModel(patientRepository, deviceRepository, userSettingsRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
