package kr.roopre.iringer_app.presentation.monitoring

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import kr.roopre.iringer_app.data.repository.DeviceRepository
import kr.roopre.iringer_app.data.repository.MonitoringRepository
import kr.roopre.iringer_app.data.repository.NotificationRepository
import kr.roopre.iringer_app.data.repository.UserSettingsRepository

class PatientMonitoringViewModelFactory(
    private val monitoringRepository: MonitoringRepository,
    private val notificationRepository: NotificationRepository,
    private val userSettingsRepository: UserSettingsRepository,
    private val deviceRepository: DeviceRepository
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(PatientMonitoringViewModel::class.java)) {
            return PatientMonitoringViewModel(
                monitoringRepository = monitoringRepository,
                notificationRepository = notificationRepository,
                userSettingsRepository = userSettingsRepository,
                deviceRepository = deviceRepository
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
