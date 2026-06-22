/**
 * 상태값 한글화 유틸리티
 * 서버/DB에서는 영어로 저장하고, UI에서만 한글로 표시
 */

export type AlertType = 'stop' | 'done' | 'fast' | 'slow' | 'almost_done' | 'disconnected'
export type AlertCategory = 'critical' | 'caution' | 'system_error'
export type InfusionStatus = 'pending' | 'infusing' | 'paused' | 'completed' | 'canceled'

export const getAlertTypeLabel = (alertType: string | null | undefined): string => {
  if (!alertType) return ''
  switch (alertType.toUpperCase()) {
    case 'FAST': return '빠름'
    case 'SLOW': return '느림'
    case 'STOP': return '정지'
    case 'DONE': return '완료'
    case 'ALMOST_DONE': return '완료 임박'
    case 'DISCONNECTED': return '연결 끊김'
    default: return alertType
  }
}

export const getAlertCategory = (alertType: string | null | undefined): AlertCategory | null => {
  if (!alertType) return null
  switch (alertType.toUpperCase()) {
    case 'STOP':
    case 'DONE':
    case 'FAST':
      return 'critical'
    case 'SLOW':
    case 'ALMOST_DONE':
      return 'caution'
    case 'DISCONNECTED':
      return 'system_error'
    default:
      return null
  }
}

export const getAlertCategoryLabel = (category: AlertCategory | string | null | undefined): string => {
  if (!category) return ''
  switch (category) {
    case 'critical': return '위급'
    case 'caution': return '주의'
    case 'system_error': return '시스템 오류'
    default: return category
  }
}

// alert_category별 색상 정의
export const alertCategoryColors = {
  critical: {
    text: '#F87171',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: '#EF4444',
  },
  caution: {
    text: '#FACC15',
    bg: 'rgba(234, 179, 8, 0.12)',
    border: '#EAB308',
  },
  system_error: {
    text: '#60A5FA',
    bg: 'rgba(59, 130, 246, 0.15)',
    border: '#3B82F6',
  },
} as const

export const getAlertCategoryColor = (alertType: string | null | undefined) => {
  const category = getAlertCategory(alertType)
  if (!category) return null
  return alertCategoryColors[category]
}

export const getInfusionStatusLabel = (status: string | null | undefined): string => {
  if (!status) return ''
  switch (status) {
    case 'pending': return '대기'
    case 'infusing': return '투여중'
    case 'paused': return '일시정지'
    case 'completed': return '완료'
    case 'canceled': return '취소'
    default: return status
  }
}
