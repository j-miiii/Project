package kr.roopre.iringer_app.presentation.monitoring

import kr.roopre.iringer_app.data.remote.dto.MonitoringAssignment
import kr.roopre.iringer_app.data.remote.dto.MonitoringRoomData
import kr.roopre.iringer_app.presentation.common.FormatUtils

/**
 * 모니터링 서버 DTO -> UI Model 매핑을 담당하는 Mapper
 */
object MonitoringMapper {

    /** Regex 캐싱: 매 호출마다 재컴파일 방지 */
    private val PAREN_CODE_REGEX = Regex("\\(([A-Z]+)\\)")
    private val ALERT_CATEGORIES = setOf("critical", "caution", "system_error")

    fun mapRoomToUiModel(
        room: MonitoringRoomData,
        infusionOptions: List<InfusionOption> = emptyList()
    ): RoomUiModel {
        val beds = room.beds
            .groupBy { it.bed_id }
            .map { (_, bedsGroup) ->
                val first = bedsGroup.first()
                val patient = bedsGroup.firstNotNullOfOrNull { it.patient_info }
                val allAssignments = bedsGroup.flatMap { it.assignments }
                    .distinctBy { it.id }
                // 수액 데이터가 있는 assignment만 카드로 표시 (빈 assignment는 "추가" 슬롯으로)
                val validAssignments = allAssignments.filter { a ->
                    (a.infusion_total_volume != null && a.infusion_total_volume > 0) || !a.infusion_type.isNullOrEmpty()
                }
                val cards = validAssignments.map { mapAssignmentToCard(it, infusionOptions) }
                val hasAlert = cards.any { it.hasAlert }
                val worstBedCategory = resolveBedWorstCategory(cards)
                BedUiModel(
                    bedId = first.bed_id,
                    bedNumber = first.bed_number,
                    patientId = patient?.id,
                    patientName = patient?.name,
                    chartNumber = patient?.chart_number,
                    gender = patient?.gender,
                    age = patient?.age,
                    infusionCards = cards,
                    allAssignmentIds = allAssignments.map { it.id },
                    hasAlert = hasAlert,
                    worstAlertCategory = worstBedCategory,
                    subText = FormatUtils.formatGenderAge(patient?.gender, patient?.age)
                )
            }
        val hasAlert = beds.any { it.hasAlert }
        val worstCategory = resolveWorstCategory(beds)
        return RoomUiModel(
            roomId = room.room_id,
            roomNumber = room.room_number,
            nurseName = room.nurse?.name ?: room.nurse?.nickname,
            beds = beds,
            hasAlert = hasAlert,
            worstAlertCategory = worstCategory
        )
    }

    fun mapAssignmentToCard(
        a: MonitoringAssignment,
        infusionOptions: List<InfusionOption> = emptyList()
    ): InfusionCardUiModel {
        val category = resolveAlertCategory(a.alert_type) ?: a.alert_category
        val hasAlert = category in ALERT_CATEGORIES
        return InfusionCardUiModel(
            assignmentId = a.id,
            infusionType = a.infusion_type,
            infusionCode = resolveInfusionCode(a.infusion_type, infusionOptions),
            totalVolume = a.infusion_total_volume,
            currentVolume = a.infusion_current_volume,
            percentage = a.infusion_percentage,
            ccHr = a.infusion_cchr,
            measuredCchr = a.measured_cchr,
            alertType = a.alert_type,
            alertCategory = category,
            alertLabel = if (hasAlert) mapAlertLabel(a.alert_type) else null,
            hasAlert = hasAlert,
            status = a.status,
            deviceId = a.device_id,
            deviceName = a.device_name,
            batteryPercent = a.battery_percent
        )
    }

    /** infusionType → 코드 해석 (캐싱된 Regex 사용) */
    fun resolveInfusionCode(infusionType: String?, options: List<InfusionOption>): String {
        if (infusionType.isNullOrEmpty()) return "-"
        options.find { it.name == infusionType }?.let { return it.code }
        options.find { it.code == infusionType }?.let { return it.code }
        options.find { it.label == infusionType }?.let { return it.code }
        val parenCode = PAREN_CODE_REGEX.find(infusionType)?.groupValues?.get(1)
        if (parenCode != null) {
            options.find { it.code == parenCode }?.let { return it.code }
            return parenCode
        }
        options.find { infusionType.contains(it.name) || it.name.contains(infusionType) }?.let { return it.code }
        return infusionType
    }

    /** infusionType → "한글이름(코드)" 형식 해석 */
    fun resolveInfusionLabel(infusionType: String?, options: List<InfusionOption>): String {
        if (infusionType.isNullOrEmpty()) return "-"
        options.find { it.name == infusionType }?.let { return it.label }
        options.find { it.code == infusionType }?.let { return it.label }
        options.find { it.label == infusionType }?.let { return it.label }
        val parenCode = PAREN_CODE_REGEX.find(infusionType)?.groupValues?.get(1)
        if (parenCode != null) {
            options.find { it.code == parenCode }?.let { return it.label }
            return parenCode
        }
        options.find { infusionType.contains(it.name) || it.name.contains(infusionType) }?.let { return it.label }
        return infusionType
    }

    fun resolveAlertCategory(alertType: String?): String? {
        if (alertType == null) return null
        return when (alertType.uppercase()) {
            "STOP", "DONE", "FAST" -> "critical"
            "SLOW", "ALMOST_DONE" -> "caution"
            "DISCONNECTED" -> "system_error"
            else -> null
        }
    }

    fun mapAlertLabel(alertType: String?): String {
        if (alertType == null) return ""
        return when (alertType.uppercase()) {
            "STOP", "STOPPED" -> "정지"
            "FAST" -> "빠름"
            "SLOW" -> "느림"
            "ALMOST_DONE" -> "완료 임박"
            "DONE" -> "완료"
            "EMPTY" -> "소진"
            "DISCONNECTED" -> "연결끊김"
            "LOW_BATTERY" -> "배터리"
            else -> alertType
        }
    }

    /** 침상(bed) 단위 worst category 계산 */
    private fun resolveBedWorstCategory(cards: List<InfusionCardUiModel>): String? {
        return when {
            cards.any { it.alertCategory == "critical" } -> "critical"
            cards.any { it.alertCategory == "caution" } -> "caution"
            cards.any { it.alertCategory == "system_error" } -> "system_error"
            else -> null
        }
    }

    private fun resolveWorstCategory(beds: List<BedUiModel>): String? {
        return when {
            beds.any { it.worstAlertCategory == "critical" } -> "critical"
            beds.any { it.worstAlertCategory == "caution" } -> "caution"
            beds.any { it.worstAlertCategory == "system_error" } -> "system_error"
            else -> null
        }
    }
}
