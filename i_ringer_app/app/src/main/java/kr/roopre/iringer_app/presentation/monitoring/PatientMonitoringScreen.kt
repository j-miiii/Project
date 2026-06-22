package kr.roopre.iringer_app.presentation.monitoring

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import kr.roopre.iringer_app.di.totalProvider
import kr.roopre.iringer_app.R
import kr.roopre.iringer_app.data.manager.UserManager
import kr.roopre.iringer_app.data.mqtt.MqttManager
import kr.roopre.iringer_app.presentation.common.FormatUtils
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

// === Main Screen (Navigation 기반) ===
@Composable
fun PatientMonitoringScreen(
    modifier: Modifier = Modifier,
    viewModel: PatientMonitoringViewModel = viewModel(
        factory = PatientMonitoringViewModelFactory(
            monitoringRepository = totalProvider.monitoringRepository,
            notificationRepository = totalProvider.notificationRepository,
            userSettingsRepository = totalProvider.userSettingsRepository,
            deviceRepository = totalProvider.deviceRepository
        )
    ),
    onFullScreenChange: (Boolean) -> Unit = {}
) {
    MonitoringNavHost(
        modifier = modifier,
        viewModel = viewModel,
        onFullScreenChange = onFullScreenChange
    )
}

// === Monitoring Main Content (모니터링 메인 화면) ===
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun MonitoringMainContent(
    modifier: Modifier = Modifier,
    viewModel: PatientMonitoringViewModel,
    onNavigateToAddInfusion: (roomNumber: String, bedNumber: String, patientName: String, gender: String, age: String, bedId: Int, patientId: Int?) -> Unit,
    onNavigateToManagement: (room: RoomUiModel, bed: BedUiModel, assignmentId: Int?) -> Unit,
    onNavigateToNotifications: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()


    // 🌟 [여기 추가!] 화면이 켜지고 0.5초 동안은 잘못된 스크롤 신호를 무시하는 방어막
    var isInitialSetup by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(500)
        isInitialSetup = false
    }

    // 환자 추가 다이얼로그 상태
    var showAddPatientDialog by remember { mutableStateOf(false) }
    var addPatientRoomNumber by remember { mutableStateOf("") }
    var addPatientBedNumber by remember { mutableStateOf("") }
    var addPatientBedId by remember { mutableIntStateOf(0) }
    val wardName = uiState.wardName.ifEmpty {
        UserManager.currentUser?.nickname ?: "병동"
    }

    // MQTT connect on enter, load data, disconnect on leave
    DisposableEffect(Unit) {
        MqttManager.connect()
        viewModel.loadData()
        onDispose {
            viewModel.unsubscribeAllTopics()
            MqttManager.disconnect()
        }
    }

    // ON_RESUME: refresh data when returning from background
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.loadData()
                if (!MqttManager.isConnected.value) {
                    MqttManager.connect()
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // 로딩 팝업
    if (uiState.isLoading) {
        Dialog(
            onDismissRequest = {},
            properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)
        ) {
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .background(Color(0xCC000000), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 3.dp,
                        modifier = Modifier.size(36.dp)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "로딩 중",
                        color = Color.White,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = wardName,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                actions = {
                    IconButton(onClick = { viewModel.loadData() }) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_refresh),
                            contentDescription = "새로고침",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Box(modifier = Modifier.padding(end = 4.dp)) {
                        IconButton(onClick = { onNavigateToNotifications() }) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_alert_bell),
                                contentDescription = "알림",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        val unreadCount = uiState.unreadNotificationCount
                        if (unreadCount > 0) {
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = (-2).dp, y = 6.dp)
                                    .heightIn(min = 18.dp)
                                    .widthIn(min = 18.dp)
                                    .background(
                                        MonitoringColors.CriticalText,
                                        RoundedCornerShape(6.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (unreadCount > 99) "99+" else "$unreadCount",
                                    color = Color.White,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 4.dp)
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MonitoringColors.AppBarBg
                )
            )
        },
        containerColor = MonitoringColors.PageBg
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Filter bar
                MonitoringFilterBar(
                    totalCount = uiState.totalCount,
                    normalCount = uiState.normalCount,
                    alertCount = uiState.alertCount,
                    selectedFilter = uiState.selectedFilter,
                    onFilterSelect = { viewModel.selectFilter(it) }
                )

                if (uiState.isLoading) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Color(0xFF009EE6))
                    }
                } else if (uiState.errorMessage != null) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = uiState.errorMessage!!,
                                fontSize = 14.sp,
                                color = MonitoringColors.TextSecondary
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            TextButton(onClick = { viewModel.loadData() }) {
                                Text("다시 시도", color = Color(0xFF009EE6))
                            }
                        }
                    }
                } else if (uiState.filteredRooms.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "등록된 환자가 없습니다.",
                            fontSize = 14.sp,
                            color = MonitoringColors.TextSecondary
                        )
                    }
                } else {
                    // Sidebar + Content
                    Row(modifier = Modifier.fillMaxSize()) {
                        RoomSidebar(
                            items = uiState.roomSidebarItems,
                            selectedRoomId = uiState.selectedRoomId,
                            onRoomSelect = { viewModel.selectRoom(it) }
                        )
                        MonitoringContent(
                            rooms = uiState.filteredRooms,
                            selectedRoomId = uiState.selectedRoomId,
                            volumeDisplayMode = uiState.volumeDisplayMode,
                            //onVisibleRoomChange = { viewModel.selectRoom(it) },
                            // 🌟 [여기 수정!] 초기 0.5초 동안은 뷰모델의 기억을 덮어씌우지 않도록 보호합니다!
                            onVisibleRoomChange = { index ->
                                if (!isInitialSetup) {
                                    val actualRoomId = uiState.filteredRooms.getOrNull(index)?.roomId
                                    if (actualRoomId != null) {
                                        viewModel.selectRoom(actualRoomId)
                                    }
                                }
                            },
                            onAddInfusion = { room, bed ->
                                onNavigateToAddInfusion(
                                    room.roomNumber,
                                    bed.bedNumber,
                                    bed.patientName ?: "",
                                    FormatUtils.formatGender(bed.gender),
                                    bed.age?.toString() ?: "",
                                    bed.bedId,
                                    bed.patientId
                                )
                            },
                            onPatientClick = { room, bed, assignmentId ->
                                if (bed.patientName == null) {
                                    addPatientRoomNumber = room.roomNumber
                                    addPatientBedNumber = bed.bedNumber
                                    addPatientBedId = bed.bedId
                                    showAddPatientDialog = true
                                } else {
                                    onNavigateToManagement(room, bed, assignmentId)
                                }
                            }
                        )
                    }
                }
            }

            // 리프레시 인디케이터 (데이터 갱신 중)
            if (uiState.isRefreshing) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .background(Color(0x99000000), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.5.dp,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }
        }
    }

    // 환자 추가 팝업 다이얼로그
    if (showAddPatientDialog) {
        AddPatientDialog(
            roomNumber = addPatientRoomNumber,
            bedNumber = addPatientBedNumber,
            bedId = addPatientBedId,
            viewModel = viewModel,
            onDismiss = { showAddPatientDialog = false },
            onSuccess = {
                showAddPatientDialog = false
                viewModel.loadData()
            }
        )
    }
}
