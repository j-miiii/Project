package kr.roopre.iringer_app.presentation.monitoring

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import kr.roopre.iringer_app.di.totalProvider

/**
 * Monitoring 탭 내부의 화면 전환을 관리하는 sealed class
 */
sealed class MonitoringDestination {
    data object Main : MonitoringDestination()

    data class InfusionManagement(
        val room: RoomUiModel,
        val bed: BedUiModel,
        val selectedAssignmentId: Int?
    ) : MonitoringDestination()

    data class AddInfusion(
        val roomNumber: String,
        val bedNumber: String,
        val patientName: String,
        val gender: String,
        val age: String,
        val bedId: Int,
        val patientId: Int?
    ) : MonitoringDestination()

    data class ChangeSpeed(
        val room: RoomUiModel,
        val bed: BedUiModel,
        val card: InfusionCardUiModel
    ) : MonitoringDestination()

    data class ChangeInfusion(
        val room: RoomUiModel,
        val bed: BedUiModel,
        val card: InfusionCardUiModel
    ) : MonitoringDestination()

    data class ChangeDevice(
        val room: RoomUiModel,
        val bed: BedUiModel,
        val card: InfusionCardUiModel
    ) : MonitoringDestination()

    data object Notifications : MonitoringDestination()
}

/**
 * Monitoring 탭의 Navigation 상태를 관리하는 State Holder
 */
class MonitoringNavigator {
    var currentDestination by mutableStateOf<MonitoringDestination>(MonitoringDestination.Main)
        private set

    private val backStack = mutableListOf<MonitoringDestination>()

    fun navigateTo(destination: MonitoringDestination) {
        backStack.add(currentDestination)
        currentDestination = destination
    }

    fun goBack(): Boolean {
        if (backStack.isEmpty()) return false
        currentDestination = backStack.removeAt(backStack.lastIndex)
        return true
    }

    fun goBackToMain() {
        backStack.clear()
        currentDestination = MonitoringDestination.Main
    }

    val isFullScreen: Boolean
        get() = currentDestination !is MonitoringDestination.Main
}

/**
 * Monitoring 탭의 Navigation Host
 */
@Composable
fun MonitoringNavHost(
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
    val navigator = remember { MonitoringNavigator() }

    // fullscreen 상태 변경 알림
    val isFullScreen = navigator.isFullScreen
    androidx.compose.runtime.LaunchedEffect(isFullScreen) {
        onFullScreenChange(isFullScreen)
    }

    BackHandler(enabled = navigator.isFullScreen) {
        navigator.goBack()
    }

    when (val destination = navigator.currentDestination) {
        is MonitoringDestination.Main -> {
            MonitoringMainContent(
                modifier = modifier,
                viewModel = viewModel,
                onNavigateToAddInfusion = { roomNumber, bedNumber, patientName, gender, age, bedId, patientId ->
                    navigator.navigateTo(
                        MonitoringDestination.AddInfusion(
                            roomNumber = roomNumber,
                            bedNumber = bedNumber,
                            patientName = patientName,
                            gender = gender,
                            age = age,
                            bedId = bedId,
                            patientId = patientId
                        )
                    )
                },
                onNavigateToManagement = { room, bed, assignmentId ->
                    navigator.navigateTo(
                        MonitoringDestination.InfusionManagement(
                            room = room,
                            bed = bed,
                            selectedAssignmentId = assignmentId
                        )
                    )
                },
                onNavigateToNotifications = {
                    navigator.navigateTo(MonitoringDestination.Notifications)
                }
            )
        }

        is MonitoringDestination.InfusionManagement -> {
            PatientInfusionManagementScreen(
                room = destination.room,
                bed = destination.bed,
                selectedAssignmentId = destination.selectedAssignmentId,
                viewModel = viewModel,
                onDismiss = { navigator.goBackToMain() },
                onNavigateToChangeSpeed = { room, bed, card ->
                    navigator.navigateTo(
                        MonitoringDestination.ChangeSpeed(room, bed, card)
                    )
                },
                onNavigateToChangeInfusion = { room, bed, card ->
                    navigator.navigateTo(
                        MonitoringDestination.ChangeInfusion(room, bed, card)
                    )
                },
                onNavigateToChangeDevice = { room, bed, card ->
                    navigator.navigateTo(
                        MonitoringDestination.ChangeDevice(room, bed, card)
                    )
                }
            )
        }

        is MonitoringDestination.AddInfusion -> {
            AddInfusionDialog(
                roomNumber = destination.roomNumber,
                bedNumber = destination.bedNumber,
                patientName = destination.patientName,
                gender = destination.gender,
                age = destination.age,
                bedId = destination.bedId,
                patientId = destination.patientId,
                viewModel = viewModel,
                onDismiss = { navigator.goBack() },
                onSuccess = {
                    navigator.goBackToMain()
                    viewModel.loadData()
                }
            )
        }

        is MonitoringDestination.ChangeSpeed -> {
            ChangeSpeedScreen(
                room = destination.room,
                bed = destination.bed,
                card = destination.card,
                viewModel = viewModel,
                onDismiss = { navigator.goBack() },
                onSuccess = {
                    navigator.goBackToMain()
                    viewModel.loadData()
                }
            )
        }

        is MonitoringDestination.ChangeInfusion -> {
            ChangeInfusionScreen(
                room = destination.room,
                bed = destination.bed,
                card = destination.card,
                viewModel = viewModel,
                onDismiss = { navigator.goBack() },
                onSuccess = {
                    navigator.goBackToMain()
                    viewModel.loadData()
                }
            )
        }

        is MonitoringDestination.ChangeDevice -> {
            ChangeDeviceScreen(
                room = destination.room,
                bed = destination.bed,
                card = destination.card,
                bedId = destination.bed.bedId,
                isRegistration = destination.card.deviceId == null,
                viewModel = viewModel,
                onDismiss = { navigator.goBack() },
                onSuccess = {
                    navigator.goBackToMain()
                    viewModel.loadData()
                }
            )
        }

        is MonitoringDestination.Notifications -> {
            NotificationScreen(
                viewModel = viewModel,
                onDismiss = {
                    navigator.goBack()
                    viewModel.refreshUnreadCount()
                }
            )
        }
    }
}
