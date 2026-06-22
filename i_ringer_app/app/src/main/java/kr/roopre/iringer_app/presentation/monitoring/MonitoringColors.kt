package kr.roopre.iringer_app.presentation.monitoring

import androidx.compose.ui.graphics.Color
import kr.roopre.iringer_app.ui.theme.AppColors

internal object MonitoringColors {
    val SidebarBg = AppColors.SidebarBg
    val SidebarDefaultBg = AppColors.SidebarBg
    val SidebarDefaultBorder = Color(0xFFE5E7EB)
    val SidebarDefaultText = AppColors.IconDefault
    val SidebarCriticalBg = AppColors.CriticalBg
    val SidebarCriticalText = AppColors.CriticalText
    val SidebarCautionBg = Color(0xFFFEFCE8)
    val SidebarCautionText = AppColors.CautionText
    val SidebarSystemErrorBg = AppColors.SystemErrorBg
    val SidebarSystemErrorText = Color(0xFF1E40AF)
    val SidebarAlertBorder = Color(0x0D000000)

    val CriticalBg = AppColors.CriticalBg
    val CriticalText = AppColors.CriticalText
    val CriticalBorder = AppColors.CriticalBorder
    val CautionBg = AppColors.CautionBg
    val CautionText = AppColors.CautionText
    val CautionBorder = AppColors.CautionBorder
    val SystemErrorBg = AppColors.SystemErrorBg
    val SystemErrorText = AppColors.SystemErrorText
    val SystemErrorBorder = AppColors.SystemErrorBorder

    val CardDefaultBg = AppColors.CardDefaultBg
    val CardDefaultBorder = AppColors.Divider
    val Divider = AppColors.Divider

    val FilterSelected = AppColors.FilterSelected
    val FilterAlert = AppColors.FilterAlert
    val FilterInactive = AppColors.FilterInactive
    val FilterInactiveText = AppColors.FilterInactiveText
    val FilterBorder = AppColors.InputBorder

    val HeaderDefaultBg = AppColors.SidebarBg
    val HeaderCriticalBg = Color(0xFFFECACA)
    val HeaderCautionBg = Color(0xFFFEF08A)
    val HeaderSystemErrorBg = Color(0xFFBFDBFE)
    val HeaderCriticalBorder = Color(0xFFEF4444)
    val HeaderCautionBorder = Color(0xFFEAB308)
    val HeaderSystemErrorBorder = Color(0xFF3B82F6)

    val ProgressEmpty = AppColors.ProgressEmpty
    val ProgressNormal = AppColors.ProgressNormal

    val TextPrimary = AppColors.TextPrimary
    val TextSecondary = AppColors.TextSecondary
    val TextTertiary = AppColors.TextTertiary

    val AppBarBg = AppColors.AppBarBg
    val PageBg = AppColors.PageBg

    // Form / Input
    val FormLabel = AppColors.FormLabel
    val PlaceholderText = AppColors.PlaceholderText
    val InputBorderDisabled = AppColors.InputBorderDisabled
    val IconDisabled = AppColors.IconDisabled
    val BorderLight = AppColors.BorderLight

    // Status accent colors
    val GreenAccent = Color(0xFF16A34A)
    val GreenBg = Color(0xFFF0FDF4)
    val GreenBorder = Color(0xFF86EFAC)
    val GreenLightBorder = Color(0xFFBBF7D0)
    val CautionYellow = Color(0xFFFDE047)

    // 미연결 (기기 미연결 상태)
    val DisconnectedBg = Color(0xFFF1F5F9)
    val DisconnectedBorder = Color(0xFFCBD5E1)
    val DisconnectedText = Color(0xFF64748B)

    // QR scan
    val QrCornerBracket = Color(0xFF1F2937)
    val QrScanLine = Color(0xFF38BDF8)
    val QrDashBorder = AppColors.BorderLight
}
