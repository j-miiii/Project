package kr.roopre.iringer_app.presentation.monitoring

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.JsonObject
import kr.roopre.iringer_app.data.common.ApiResult
import kr.roopre.iringer_app.data.manager.UserManager
import kr.roopre.iringer_app.data.mqtt.MqttManager
import kr.roopre.iringer_app.data.mqtt.MqttTopics
import kr.roopre.iringer_app.data.remote.dto.DeviceResponse
import kr.roopre.iringer_app.data.remote.dto.NotificationResponse
import kr.roopre.iringer_app.data.repository.DeviceRepository
import kr.roopre.iringer_app.data.repository.InfusionOptionDto
import kr.roopre.iringer_app.data.repository.MonitoringRepository
import kr.roopre.iringer_app.data.repository.NotificationRepository
import kr.roopre.iringer_app.data.repository.UserSettingsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// === Filter ===
enum class MonitoringFilter { ALL, NORMAL, ALERT }

// === Infusion Preset (서버 infusions 테이블) ===
data class InfusionOption(
    val id: Int,
    val code: String,
    val name: String,
    val defaultVolume: Int,
    val defaultCchr: Int
) {
    val label: String get() = "$name ($code)"
}

// === UI Models ===
data class InfusionCardUiModel(
    val assignmentId: Int,
    val infusionType: String?,
    val infusionCode: String = "-",
    val totalVolume: Int?,
    val currentVolume: Int?,
    val percentage: Double?,
    val ccHr: Double?,
    val measuredCchr: Double?,
    val alertType: String?,
    val alertCategory: String?,
    val alertLabel: String? = null,   // 사전 계산된 알림 라벨 ("정지", "빠름" 등)
    val hasAlert: Boolean = false,    // alertCategory in ALERT_CATEGORIES
    val status: String,
    val deviceId: Int?,
    val deviceName: String?,
    val batteryPercent: Int?
)

data class DeviceInfo(
    val id: Int,
    val name: String,
    val serialNumber: String,
    val batteryPercent: Int?,
    val bedId: Int? = null
)

data class BedUiModel(
    val bedId: Int,
    val bedNumber: String,
    val patientId: Int? = null,
    val patientName: String?,
    val chartNumber: String?,
    val gender: String?,
    val age: Int?,
    val infusionCards: List<InfusionCardUiModel>,
    val allAssignmentIds: List<Int> = emptyList(),  // 전체 종료 시 모든 assignment 해제용
    val hasAlert: Boolean,
    val worstAlertCategory: String? = null,  // "critical", "caution", "system_error", null
    val subText: String = ""  // 성별/나이 문자열 (사전 계산)
)

data class RoomUiModel(
    val roomId: Int,
    val roomNumber: String,
    val nurseName: String?,
    val beds: List<BedUiModel>,
    val hasAlert: Boolean,
    val worstAlertCategory: String?
)

data class RoomSidebarItem(
    val roomId: Int,
    val roomNumber: String,
    val hasAlert: Boolean,
    val worstAlertCategory: String?,  // "critical", "caution", "system_error", null
    val patientCount: Int = 0,
    val totalBedCount: Int = 0
)

// === UI State ===
data class MonitoringUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val wardName: String = "",
    val allRooms: List<RoomUiModel> = emptyList(),
    val filteredRooms: List<RoomUiModel> = emptyList(),
    val roomSidebarItems: List<RoomSidebarItem> = emptyList(),
    val selectedFilter: MonitoringFilter = MonitoringFilter.ALL,
    val selectedRoomId: Int? = null,
    val totalCount: Int = 0,
    val normalCount: Int = 0,
    val alertCount: Int = 0,
    val errorMessage: String? = null,
    val unreadNotificationCount: Int = 0,
    val volumeDisplayMode: String = "percentage", // "percentage" or "ml"
    val notifications: List<NotificationResponse> = emptyList(),
    val isLoadingNotifications: Boolean = false,
    val isLoadingMoreNotifications: Boolean = false,
    val hasMoreNotifications: Boolean = true,
    val notificationPage: Int = 1,
    val isMarkingAllRead: Boolean = false,
    val mqttConnected: Boolean = false
)

data class MappingResult(
    val roomUiModels: List<RoomUiModel>,
    val filtered: List<RoomUiModel>,
    val sidebarItems: List<RoomSidebarItem>,
    val totalCount: Int,
    val normalCount: Int,
    val alertCount: Int,
    val selectedRoom: Int?
)

class PatientMonitoringViewModel(
    private val monitoringRepository: MonitoringRepository,
    private val notificationRepository: NotificationRepository,
    private val userSettingsRepository: UserSettingsRepository,
    private val deviceRepository: DeviceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MonitoringUiState())
    val uiState: StateFlow<MonitoringUiState> = _uiState.asStateFlow()

    private val _infusionOptions = MutableStateFlow<List<InfusionOption>>(emptyList())
    val infusionOptions: StateFlow<List<InfusionOption>> = _infusionOptions.asStateFlow()

    private val _infusionOptionsLoading = MutableStateFlow(false)
    val infusionOptionsLoading: StateFlow<Boolean> = _infusionOptionsLoading.asStateFlow()

    private val _wardDevices = MutableStateFlow<List<DeviceInfo>>(emptyList())
    val wardDevices: StateFlow<List<DeviceInfo>> = _wardDevices.asStateFlow()

    private val _wardDevicesLoading = MutableStateFlow(false)
    val wardDevicesLoading: StateFlow<Boolean> = _wardDevicesLoading.asStateFlow()

    private val _wardDevicesError = MutableStateFlow<String?>(null)
    val wardDevicesError: StateFlow<String?> = _wardDevicesError.asStateFlow()

    private var loadDataJob: Job? = null
    private var loadMonitoringJob: Job? = null
    private var pollingJob: Job? = null

    companion object {
        private const val TAG = "MonitoringVM"
        private const val POLLING_INTERVAL_MS = 10_000L // 10초 주기 폴링

        // 마지막으로 선택된 방 ID를 기억할 정적 변수 추가
        //var lastSelectedRoomId : Int? = null
    }

    init {
        // Collect MQTT connection state
        viewModelScope.launch {
            MqttManager.isConnected.collect { connected ->
                _uiState.value = _uiState.value.copy(mqttConnected = connected)
                if (connected) {
                    subscribeUserTopics()
                }
            }
        }

        // Collect MQTT messages (refresh 신호 + 알림만 처리)
        viewModelScope.launch {
            MqttManager.messageFlow.collect { (topic, _) ->
                handleMqttMessage(topic)
            }
        }

        // 주기적 폴링으로 실시간 데이터(퍼센트 등) 갱신
        startPolling()
    }

    private fun subscribeUserTopics() {
        val userId = UserManager.userId ?: return
        MqttManager.subscribe(MqttTopics.userNotification(userId))
        MqttManager.subscribe(MqttTopics.userAssignmentRefresh(userId))
        Log.d(TAG, "MQTT: subscribed user topics (userId=$userId)")
    }

    fun unsubscribeAllTopics() {
        MqttManager.unsubscribeAll()
    }

    private fun handleMqttMessage(topic: String) {
        // 1. user/{userId}/assignment/refresh → 전체 새로고침
        if (topic.endsWith("/assignment/refresh")) {
            Log.d(TAG, "MQTT: assignment refresh → loadData()")
            loadData()
            return
        }

        // 2. user/{userId}/notification → badge +1
        if (topic.endsWith("/notification")) {
            Log.d(TAG, "MQTT: notification received")
            _uiState.value = _uiState.value.copy(
                unreadNotificationCount = _uiState.value.unreadNotificationCount + 1
            )
            return
        }
    }

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(POLLING_INTERVAL_MS)
                if (_uiState.value.allRooms.isNotEmpty()) {
                    loadMonitoringData()
                }
            }
        }
    }

    fun loadData() {
        // 디바운싱: 짧은 시간 내 중복 호출 방지 (MQTT refresh 등)
        loadDataJob?.cancel()
        loadDataJob = viewModelScope.launch {
            delay(300) // 300ms 디바운스
            loadMonitoringData()
            loadUnreadNotificationCount()
            loadUserSettings()
            loadInfusionOptions()
        }
    }

    fun resolveInfusionCode(infusionType: String?): String {
        return MonitoringMapper.resolveInfusionCode(infusionType, _infusionOptions.value)
    }

    fun loadInfusionOptions() {
        if (_infusionOptions.value.isNotEmpty()) return
        viewModelScope.launch {
            _infusionOptionsLoading.value = true
            when (val result = userSettingsRepository.getInfusionOptions()) {
                is ApiResult.Success -> {
                    _infusionOptions.value = result.data.map { it.toUiModel() }
                    Log.d(TAG, "수액 프리셋 로드 성공: ${result.data.size}개")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 프리셋 로드 실패: ${result.message}")
                }
            }
            _infusionOptionsLoading.value = false
        }
    }

    private fun loadUserSettings() {
        viewModelScope.launch {
            val userId = UserManager.userId ?: return@launch
            when (val result = userSettingsRepository.getVolumeDisplayMode(userId)) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(volumeDisplayMode = result.data)
                    Log.d(TAG, "사용자 설정 로드: volume_display_mode=${result.data}")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "사용자 설정 로드 실패: ${result.message}")
                }
            }
        }
    }

    private fun loadUnreadNotificationCount() {
        viewModelScope.launch {
            val userId = UserManager.userId ?: return@launch
            when (val result = notificationRepository.getUnreadCount(userId)) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(unreadNotificationCount = result.data)
                    Log.d(TAG, "미확인 알림: ${result.data}건")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "알림 수 로드 실패: ${result.message}")
                }
            }
        }
    }

    fun loadNotifications() {
        viewModelScope.launch {
            val userId = UserManager.userId ?: return@launch
            _uiState.value = _uiState.value.copy(
                isLoadingNotifications = true,
                notificationPage = 1,
                hasMoreNotifications = true
            )
            when (val result = notificationRepository.getNotifications(userId, page = 1)) {
                is ApiResult.Success -> {
                    val data = result.data.data
                    val total = result.data.pagination.total
                    _uiState.value = _uiState.value.copy(
                        notifications = data,
                        isLoadingNotifications = false,
                        notificationPage = 1,
                        hasMoreNotifications = data.size < total
                    )
                    Log.d(TAG, "알림 목록 로드 성공: ${data.size}건 / 전체 ${total}건")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "알림 목록 로드 실패: ${result.message}")
                    _uiState.value = _uiState.value.copy(isLoadingNotifications = false)
                }
            }
        }
    }

    fun loadMoreNotifications() {
        val state = _uiState.value
        if (state.isLoadingMoreNotifications || !state.hasMoreNotifications) return
        viewModelScope.launch {
            val userId = UserManager.userId ?: return@launch
            val nextPage = state.notificationPage + 1
            _uiState.value = state.copy(isLoadingMoreNotifications = true)
            when (val result = notificationRepository.getNotifications(userId, page = nextPage)) {
                is ApiResult.Success -> {
                    val newData = result.data.data
                    val total = result.data.pagination.total
                    val merged = _uiState.value.notifications + newData
                    _uiState.value = _uiState.value.copy(
                        notifications = merged,
                        isLoadingMoreNotifications = false,
                        notificationPage = nextPage,
                        hasMoreNotifications = merged.size < total
                    )
                    Log.d(TAG, "알림 추가 로드: +${newData.size}건 (총 ${merged.size}/${total})")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "알림 추가 로드 실패: ${result.message}")
                    _uiState.value = _uiState.value.copy(isLoadingMoreNotifications = false)
                }
            }
        }
    }

    fun markNotificationAsRead(notificationId: Int) {
        viewModelScope.launch {
            when (val result = notificationRepository.markAsRead(notificationId)) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        notifications = _uiState.value.notifications.map {
                            if (it.id == notificationId) it.copy(is_read = 1) else it
                        }
                    )
                    loadUnreadNotificationCount()
                    Log.d(TAG, "알림 읽음 처리 성공: id=$notificationId")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "알림 읽음 처리 실패: ${result.message}")
                }
            }
        }
    }

    fun markAllNotificationsAsRead() {
        if (_uiState.value.isMarkingAllRead) return // 중복 클릭 방지
        viewModelScope.launch {
            val userId = UserManager.userId ?: return@launch
            _uiState.value = _uiState.value.copy(isMarkingAllRead = true)
            when (val result = notificationRepository.markAllAsRead(userId)) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        notifications = _uiState.value.notifications.map { it.copy(is_read = 1) },
                        isMarkingAllRead = false
                    )
                    loadUnreadNotificationCount()
                    Log.d(TAG, "전체 알림 읽음 처리 성공")
                }
                is ApiResult.Error -> {
                    _uiState.value = _uiState.value.copy(isMarkingAllRead = false)
                    Log.e(TAG, "전체 알림 읽음 처리 실패: ${result.message}")
                }
            }
        }
    }

    fun refreshUnreadCount() {
        loadUnreadNotificationCount()
    }

    private fun loadMonitoringData() {
        // 중복 실행 방지
        loadMonitoringJob?.cancel()
        loadMonitoringJob = viewModelScope.launch {
            val isInitialLoad = _uiState.value.allRooms.isEmpty()
            if (isInitialLoad) {
                _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            } else {
                _uiState.value = _uiState.value.copy(isRefreshing = true)
            }

            val hospitalId = UserManager.hospitalId ?: return@launch
            val wardId = UserManager.wardId ?: return@launch

            when (val result = monitoringRepository.getMonitoringData(hospitalId, wardId)) {
                is ApiResult.Success -> {
                    val wardData = result.data.data.firstOrNull()
                        ?: run {
                            if (isInitialLoad) {
                                _uiState.value = _uiState.value.copy(isLoading = false)
                            }
                            return@launch
                        }

                    // 무거운 mapping/필터링을 Default 스레드에서 처리
                    val infOptions = _infusionOptions.value
                    val (roomUiModels, filtered, sidebarItems, totalCount, normalCount, alertCount, selectedRoom) =
                        withContext(Dispatchers.Default) {
                            // 단일 패스: Mapper에서 infusionCode까지 한번에 해석
                            val rooms = wardData.rooms.map { MonitoringMapper.mapRoomToUiModel(it, infOptions) }
                            val allBeds = rooms.flatMap { it.beds }
                            val patientBeds = allBeds.filter { it.patientName != null }
                            val total = patientBeds.size
                            val alert = patientBeds.count { it.hasAlert }
                            val normal = total - alert

                            val currentFilter = _uiState.value.selectedFilter
                            // 🌟 [수정 포인트 1] 여기서 뷰모델이 새로 생성되어 null이더라도, 정적 변수에 저장된 이전 방 ID를 가져옵니다. 0622
                            val currentRoomId = _uiState.value.selectedRoomId


                            //val currentRoomId = _uiState.value.selectedRoomId ?: lastSelectedRoomId


                            val filt = applyFilter(rooms, currentFilter)
                            val sidebar = filt.map {
                                RoomSidebarItem(
                                    roomId = it.roomId,
                                    roomNumber = it.roomNumber,
                                    hasAlert = it.hasAlert,
                                    worstAlertCategory = it.worstAlertCategory,
                                    patientCount = it.beds.count { b -> b.patientName != null },
                                    totalBedCount = it.beds.size
                                )
                            }
                            val selRoom = if (currentRoomId != null && filt.any { it.roomId == currentRoomId }) {
                                currentRoomId
                            } else {
                                filt.firstOrNull()?.roomId
                            }

                            MappingResult(rooms, filt, sidebar, total, normal, alert, selRoom)
                        }

                    // 데이터 변경 없으면 리컴포지션 스킵 (저사양 PDA 최적화)
                    val currentState = _uiState.value
                    if (!isInitialLoad && roomUiModels == currentState.allRooms) {
                        _uiState.value = currentState.copy(isRefreshing = false)
                        Log.d(TAG, "모니터링 데이터 변경 없음 → 스킵")
                    } else {
                        _uiState.value = currentState.copy(
                            isLoading = false,
                            isRefreshing = false,
                            wardName = wardData.ward_name,
                            allRooms = roomUiModels,
                            filteredRooms = filtered,
                            roomSidebarItems = sidebarItems,
                            selectedFilter = currentState.selectedFilter,
                            selectedRoomId = selectedRoom,
                            totalCount = totalCount,
                            normalCount = normalCount,
                            alertCount = alertCount
                        )

                        Log.d(TAG, "모니터링 데이터 로드 성공: ${roomUiModels.size}개 병실 (리프레시: ${!isInitialLoad})")
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "모니터링 데이터 로드 실패: ${result.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isRefreshing = false,
                        errorMessage = if (isInitialLoad) result.message else _uiState.value.errorMessage
                    )
                }
            }
        }
    }

    fun selectFilter(filter: MonitoringFilter) {
        val current = _uiState.value
        if (current.selectedFilter == filter) return

        val filtered = applyFilter(current.allRooms, filter)

        val allRooms = current.allRooms
        val sidebarItems = filtered.map { room ->
            val allRoom = allRooms.find { it.roomId == room.roomId }
            RoomSidebarItem(
                roomId = room.roomId,
                roomNumber = room.roomNumber,
                hasAlert = room.hasAlert,
                worstAlertCategory = room.worstAlertCategory,
                patientCount = (allRoom ?: room).beds.count { b -> b.patientName != null },
                totalBedCount = (allRoom ?: room).beds.size
            )
        }

        _uiState.value = current.copy(
            selectedFilter = filter,
            filteredRooms = filtered,
            roomSidebarItems = sidebarItems,
            selectedRoomId = filtered.firstOrNull()?.roomId
        )
    }

    fun selectRoom(roomId: Int) {
        if (_uiState.value.selectedRoomId == roomId) return
        _uiState.value = _uiState.value.copy(selectedRoomId = roomId)

    }

    fun changeSpeed(
        assignmentId: Int,
        newSpeed: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "속도 변경 시작: assignmentId=$assignmentId, newSpeed=$newSpeed")
            val data = JsonObject().apply {
                addProperty("infusion_cchr", newSpeed)
            }
            when (val result = monitoringRepository.updateAssignment(assignmentId, data)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "속도 변경 성공: assignmentId=$assignmentId")
                    loadMonitoringData()
                    onSuccess()
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "속도 변경 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun deleteInfusion(
        assignmentId: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "수액 삭제 시작: assignmentId=$assignmentId")
            when (val result = monitoringRepository.deleteAssignment(assignmentId)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "수액 삭제 성공: assignmentId=$assignmentId")
                    loadMonitoringData()
                    onSuccess()
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 삭제 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    /**
     * 수액 카드 삭제: 수액 필드만 클리어하여 환자-침상 연결은 유지
     * (release와 달리 released_at을 설정하지 않아 서버가 patient_info 계속 반환)
     */
    fun clearInfusion(
        assignmentId: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "수액 클리어 시작: assignmentId=$assignmentId")
            when (val result = monitoringRepository.clearInfusion(assignmentId)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "수액 클리어 성공: assignmentId=$assignmentId")
                    loadMonitoringData()
                    onSuccess()
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 클리어 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun releaseAssignment(
        assignmentId: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "수액 해제(release) 시작: assignmentId=$assignmentId")
            when (val result = monitoringRepository.releaseAssignment(assignmentId)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "수액 해제 성공: assignmentId=$assignmentId")
                    loadMonitoringData()
                    onSuccess()
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 해제 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun insertInfusion(
        data: JsonObject,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "수액 추가 시작: $data")
            when (val result = monitoringRepository.addInfusion(data)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "수액 추가 성공: ${result.data}")
                    loadMonitoringData()
                    onSuccess()
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 추가 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun loadWardDevices() {
        viewModelScope.launch {
            val wardId = UserManager.wardId ?: return@launch
            _wardDevicesLoading.value = true
            _wardDevicesError.value = null
            when (val result = deviceRepository.getDevicesByWard(wardId)) {
                is ApiResult.Success -> {
                    _wardDevices.value = result.data.map { it.toDeviceInfo() }
                    Log.d(TAG, "병동 기기 목록 로드 성공: ${result.data.size}개")
                }
                is ApiResult.Error -> {
                    _wardDevicesError.value = result.message
                    Log.e(TAG, "병동 기기 목록 로드 실패: ${result.message}")
                }
            }
            _wardDevicesLoading.value = false
        }
    }

    fun lookupDeviceById(
        deviceId: Int,
        onSuccess: (DeviceInfo) -> Unit,
        onError: (String) -> Unit,
        checkAvailability: Boolean = true
    ) {
        viewModelScope.launch {
            when (val result = deviceRepository.getDeviceById(deviceId)) {
                is ApiResult.Success -> {
                    val device = result.data
                    if (checkAvailability && device.bed_id != null) {
                        Log.e(TAG, "기기 이미 사용 중: ${device.device_name} (bed_id=${device.bed_id})")
                        onError("이미 등록된 기기입니다.\n다른 기기를 사용해주세요.")
                        return@launch
                    }
                    onSuccess(device.toDeviceInfo())
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "기기 조회 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun lookupDeviceBySerial(
        serialNumber: String,
        onSuccess: (DeviceInfo) -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            when (val result = deviceRepository.getDeviceBySerialNumber(serialNumber)) {
                is ApiResult.Success -> {
                    val device = result.data
                    if (device.bed_id != null) {
                        Log.e(TAG, "기기 이미 사용 중: ${device.serial_number} (bed_id=${device.bed_id})")
                        onError("이미 등록된 기기입니다.\n다른 기기를 사용해주세요.")
                        return@launch
                    }
                    onSuccess(device.toDeviceInfo())
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "기기 시리얼 조회 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun changeDevice(
        assignmentId: Int,
        deviceId: Int,
        oldDeviceId: Int? = null,
        bedId: Int? = null,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "기기 교체 시작: assignmentId=$assignmentId, deviceId=$deviceId, oldDeviceId=$oldDeviceId, bedId=$bedId")
            val data = JsonObject().apply {
                addProperty("device_id", deviceId)
            }
            when (val result = monitoringRepository.updateAssignment(assignmentId, data)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "기기 교체 성공: assignmentId=$assignmentId")

                    // 이전 기기 위치정보 초기화
                    if (oldDeviceId != null && oldDeviceId != deviceId) {
                        val oldDeviceData = JsonObject().apply {
                            add("bed_id", com.google.gson.JsonNull.INSTANCE)
                            add("room_id", com.google.gson.JsonNull.INSTANCE)
                        }
                        when (val oldResult = deviceRepository.updateDevice(oldDeviceId, oldDeviceData)) {
                            is ApiResult.Success -> Log.d(TAG, "이전 기기 위치정보 초기화 성공: oldDeviceId=$oldDeviceId")
                            is ApiResult.Error -> Log.e(TAG, "이전 기기 위치정보 초기화 실패: ${oldResult.message}")
                        }
                    }

                    // 새 기기의 위치정보 업데이트 (bed_id, room_id, ward_id, hospital_id)
                    if (bedId != null) {
                        // bedId로부터 roomId 조회
                        val roomId = _uiState.value.allRooms
                            .firstOrNull { room -> room.beds.any { it.bedId == bedId } }
                            ?.roomId
                        val hospitalId = UserManager.hospitalId
                        val wardId = UserManager.wardId

                        val deviceData = JsonObject().apply {
                            addProperty("bed_id", bedId)
                            if (roomId != null) addProperty("room_id", roomId)
                            if (wardId != null) addProperty("ward_id", wardId)
                            if (hospitalId != null) addProperty("hospital_id", hospitalId)
                        }
                        when (val deviceResult = deviceRepository.updateDevice(deviceId, deviceData)) {
                            is ApiResult.Success -> Log.d(TAG, "기기 위치정보 업데이트 성공: deviceId=$deviceId, bedId=$bedId, roomId=$roomId")
                            is ApiResult.Error -> Log.e(TAG, "기기 위치정보 업데이트 실패: ${deviceResult.message}")
                        }
                    }
                    loadMonitoringData()
                    onSuccess()
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "기기 교체 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun completeInfusion(
        assignmentId: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "투여 완료 처리 (release): assignmentId=$assignmentId")
            when (val result = monitoringRepository.releaseAssignment(assignmentId)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "투여 완료 성공: assignmentId=$assignmentId")
                    loadMonitoringData()
                    onSuccess()
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "투여 완료 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun endAllMonitoring(
        assignmentIds: List<Int>,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "전체 모니터링 종료 (release): ids=$assignmentIds")
            var failed = false
            for (id in assignmentIds) {
                when (val result = monitoringRepository.releaseAssignment(id)) {
                    is ApiResult.Success -> {
                        Log.d(TAG, "모니터링 종료 성공: id=$id")
                    }
                    is ApiResult.Error -> {
                        Log.e(TAG, "모니터링 종료 실패: id=$id, ${result.message}")
                        failed = true
                    }
                }
            }
            loadMonitoringData()
            if (failed) onError("일부 수액 종료에 실패했습니다.") else onSuccess()
        }
    }

    fun addPatient(
        name: String,
        chartNumber: String,
        gender: String,
        age: Int,
        bedId: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "환자 추가 시작: name=$name, bedId=$bedId")
            // Step 1: 환자 생성
            val patientData = JsonObject().apply {
                addProperty("name", name)
                addProperty("chart_number", chartNumber)
                addProperty("sex", gender)
                addProperty("age", age)
            }
            when (val result = monitoringRepository.insertPatient(patientData)) {
                is ApiResult.Success -> {
                    val patientId = result.data.get("id")?.asInt
                    if (patientId == null) {
                        onError("환자 생성 실패: ID를 받지 못했습니다.")
                        return@launch
                    }
                    Log.d(TAG, "환자 생성 성공: patientId=$patientId")
                    // Step 2: 침상 배정
                    val assignmentData = JsonObject().apply {
                        addProperty("patient_id", patientId)
                        addProperty("bed_id", bedId)
                    }
                    when (val assignResult = monitoringRepository.insertAssignment(assignmentData)) {
                        is ApiResult.Success -> {
                            Log.d(TAG, "침상 배정 성공: patientId=$patientId, bedId=$bedId")
                            loadMonitoringData()
                            onSuccess()
                        }
                        is ApiResult.Error -> {
                            Log.e(TAG, "침상 배정 실패: ${assignResult.message}")
                            onError(assignResult.message)
                        }
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "환자 생성 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun changeInfusion(
        assignmentId: Int,
        infusionType: String,
        volume: Int,
        gtt: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "수액 교체 시작: assignmentId=$assignmentId, type=$infusionType, vol=$volume, ccHr=$gtt")
            val data = JsonObject().apply {
                addProperty("infusion_type", infusionType)
                addProperty("infusion_total_volume", volume)
                addProperty("infusion_cchr", gtt)

                // 현재 투여량을 0으로 초기화해줘 0619
                addProperty("infusion_current_volume", 0)
            }
            when (val result = monitoringRepository.updateAssignment(assignmentId, data)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "수액 교체 성공: assignmentId=$assignmentId")
                    loadMonitoringData()
                    onSuccess()
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 교체 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    fun fetchInfusionByAssignmentId(
        assignmentId: Int,
        onSuccess: (infusionType: String, volume: Int, gtt: Int) -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            Log.d(TAG, "수액 정보 API 조회: assignment_id=$assignmentId")
            when (val result = monitoringRepository.fetchAssignmentInfo(assignmentId)) {
                is ApiResult.Success -> {
                    val a = result.data
                    val infType = a.infusion_type ?: ""
                    val infVol = a.infusion_total_volume ?: 0
                    val infCchr = a.infusion_cchr?.toInt() ?: 0
                    if (infType.isNotEmpty()) {
                        Log.d(TAG, "수액 정보 조회 성공: $infType / ${infVol}ml / ${infCchr}cc/hr")
                        onSuccess(infType, infVol, infCchr)
                    } else {
                        onError("수액 정보를 찾을 수 없습니다.")
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "수액 정보 API 조회 실패: ${result.message}")
                    onError(result.message)
                }
            }
        }
    }

    private fun applyFilter(rooms: List<RoomUiModel>, filter: MonitoringFilter): List<RoomUiModel> {
        return when (filter) {
            MonitoringFilter.ALL -> rooms
            MonitoringFilter.NORMAL -> rooms
                .map { room -> room.copy(beds = room.beds.filter { it.patientName != null && !it.hasAlert }) }
                .filter { it.beds.isNotEmpty() }
            MonitoringFilter.ALERT -> rooms
                .map { room -> room.copy(beds = room.beds.filter { it.hasAlert }) }
                .filter { it.beds.isNotEmpty() }
        }
    }
}

private fun InfusionOptionDto.toUiModel() = InfusionOption(
    id = id,
    code = code,
    name = name,
    defaultVolume = defaultVolume,
    defaultCchr = defaultCchr
)

private fun DeviceResponse.toDeviceInfo() = DeviceInfo(
    id = id,
    name = device_name,
    serialNumber = serial_number,
    batteryPercent = battery_percent,
    bedId = bed_id
)
