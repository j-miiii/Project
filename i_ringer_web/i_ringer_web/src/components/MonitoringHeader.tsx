import React, { useState, useEffect, useMemo } from 'react'
import { Box, Typography, Modal, Button } from '@mui/material'
import { styled } from '@mui/material/styles'
import { alertCategoryColors, getAlertCategory, AlertCategory } from '../utils/statusUtils'

const drawerWidth = 240

const HeaderBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'sidebarCollapsed' && prop !== 'hasDrawer',
})<{ sidebarCollapsed?: boolean; hasDrawer?: boolean }>(({ theme, sidebarCollapsed, hasDrawer = true }) => ({
  position: 'fixed',
  top: 0,
  left: hasDrawer
    ? (sidebarCollapsed ? 0 : drawerWidth)
    : 0,
  right: 0,
  height: 56,
  backgroundColor: '#2A2F3A',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 16,
  paddingRight: 24,
  zIndex: 1100,
  transition: theme.transitions.create(['left'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}))

interface WardData {
  ward_id: number
  ward_name: string
  rooms: {
    room_id: number
    room_number: string
    beds: {
      bed_id: number
      bed_number: string
      bed_status: string
      patient_info?: { id: number; name: string; chart_number: string } | null
      assignments: {
        id: number
        alert_type: string | null
        alert_category: string | null
        status: string | null
        is_active: boolean | null
        [key: string]: any
      }[]
    }[]
  }[]
}

interface MonitoringHeaderProps {
  wardName: string
  monitoringData: WardData[]
  sidebarCollapsed?: boolean
  hasDrawer?: boolean
  onOpenSettings?: () => void
  onToggleSidebar?: () => void
}

const MonitoringHeader: React.FC<MonitoringHeaderProps> = ({
  wardName,
  monitoringData,
  sidebarCollapsed = false,
  hasDrawer = true,
  onOpenSettings,
  onToggleSidebar,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_info')
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_email')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_name')
    localStorage.removeItem('hospital_id')
    localStorage.removeItem('ward_id')
    localStorage.removeItem('user_setting')
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('session_id')
    window.dispatchEvent(new Event('logout'))
    window.location.href = '/login'
  }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = `${currentTime.getFullYear()}.${String(currentTime.getMonth() + 1).padStart(2, '0')}.${String(currentTime.getDate()).padStart(2, '0')}`
  const timeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}:${String(currentTime.getSeconds()).padStart(2, '0')}`

  // 통계 계산
  const stats = useMemo(() => {
    let critical = 0
    let caution = 0
    let systemError = 0
    let patientCount = 0
    let empty = 0

    monitoringData.forEach(ward => {
      ward.rooms.forEach(room => {
        // bed_id 기준 중복 제거 (수액이 여러 개면 같은 bed가 중복될 수 있음)
        const bedMap = new Map<number, typeof room.beds[0]>()
        room.beds.forEach(bed => {
          const existing = bedMap.get(bed.bed_id)
          if (existing) {
            // assignments 병합
            const existingIds = new Set(existing.assignments?.map(a => a.id) || [])
            const newAssignments = (bed.assignments || []).filter(a => !existingIds.has(a.id))
            existing.assignments = [...(existing.assignments || []), ...newAssignments]
          } else {
            bedMap.set(bed.bed_id, { ...bed, assignments: [...(bed.assignments || [])] })
          }
        })

        bedMap.forEach(bed => {
          const hasAssignment = bed.assignments && bed.assignments.length > 0
          if (hasAssignment) {
            // 각 카테고리 독립적으로 카운트 (같은 침상에 여러 알림 가능)
            let hasCritical = false
            let hasCaution = false
            let hasSystemError = false
            bed.assignments.forEach(a => {
              const alertType = a.alert_type?.toUpperCase()
              if (alertType) {
                const cat = getAlertCategory(alertType)
                if (cat === 'critical') hasCritical = true
                else if (cat === 'caution') hasCaution = true
                else if (cat === 'system_error') hasSystemError = true
              }
            })
            if (hasCritical) critical++
            if (hasCaution) caution++
            if (hasSystemError) systemError++
            patientCount++
          } else {
            empty++
          }
        })
      })
    })

    return { critical, caution, systemError, infusing: patientCount, empty }
  }, [monitoringData])

  return (
    <HeaderBar sidebarCollapsed={sidebarCollapsed} hasDrawer={hasDrawer}>
      {/* 좌측 영역: 사이드바 토글 + 병동 이름 + 알림 카드 */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {/* 사이드바 열기/닫기 토글 */}
        {hasDrawer && (
          <Box
            onClick={onToggleSidebar}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '8px',
              cursor: 'pointer',
              mr: 1.5,
              flexShrink: 0,
              bgcolor: 'rgba(255,255,255,0.10)',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.20)',
              },
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
            >
              {sidebarCollapsed ? (
                <>
                  {/* 사이드바 열기: 패널 + 오른쪽 화살표 */}
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" fill="none" />
                  <line x1="9" y1="3" x2="9" y2="21" stroke="white" strokeWidth="1.8" />
                  <path d="M14 9L17 12L14 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                <>
                  {/* 사이드바 닫기: 패널 + 왼쪽 화살표 */}
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" fill="none" />
                  <line x1="9" y1="3" x2="9" y2="21" stroke="white" strokeWidth="1.8" />
                  <path d="M17 9L14 12L17 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </>
              )}
            </svg>
          </Box>
        )}

        <Typography sx={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#FFFFFF',
          fontFamily: 'Pretendard',
          whiteSpace: 'nowrap',
          mr: 2,
        }}>
          {wardName || '전체 병동'}
        </Typography>

        {/* 세로 구분선 */}
        <Box sx={{ width: '1px', height: 22, bgcolor: 'rgba(255,255,255,0.15)', flexShrink: 0, mr: 2 }} />

        {/* 알림 카드들 */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* 위급 */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            bgcolor: alertCategoryColors.critical.bg,
            border: `1px solid ${alertCategoryColors.critical.border}`,
            borderRadius: '6px',
            px: 1.5,
            py: 0.5,
            height: 32,
          }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: alertCategoryColors.critical.text, whiteSpace: 'nowrap' }}>
              위급
            </Typography>
            <Typography sx={{ fontSize: '15px', fontWeight: 800, color: alertCategoryColors.critical.text }}>
              {stats.critical}
            </Typography>
          </Box>

          {/* 주의 */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            bgcolor: alertCategoryColors.caution.bg,
            border: `1px solid ${alertCategoryColors.caution.border}`,
            borderRadius: '6px',
            px: 1.5,
            py: 0.5,
            height: 32,
          }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: alertCategoryColors.caution.text, whiteSpace: 'nowrap' }}>
              주의
            </Typography>
            <Typography sx={{ fontSize: '15px', fontWeight: 800, color: alertCategoryColors.caution.text }}>
              {stats.caution}
            </Typography>
          </Box>

          {/* 시스템 오류 */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            bgcolor: alertCategoryColors.system_error.bg,
            border: `1px solid ${alertCategoryColors.system_error.border}`,
            borderRadius: '6px',
            px: 1.5,
            py: 0.5,
            height: 32,
          }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: alertCategoryColors.system_error.text, whiteSpace: 'nowrap' }}>
              시스템 오류
            </Typography>
            <Typography sx={{ fontSize: '15px', fontWeight: 800, color: alertCategoryColors.system_error.text }}>
              {stats.systemError}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 중앙 영역: 진행중 / 빈침상 */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {/* 진행중 (정상) */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          bgcolor: 'rgba(255,255,255,0.07)',
          borderRadius: '6px',
          px: 1.5,
          py: 0.5,
          height: 32,
        }}>
          <Box
            component="img"
            src="/icons/ic_web_normal.svg"
            sx={{ width: 18, height: 18 }}
          />
          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#CBD5E1' }}>
            {stats.infusing}
          </Typography>
          <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#94A3B8' }}>
            정상
          </Typography>
        </Box>

        {/* 빈침상 */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          bgcolor: 'rgba(255,255,255,0.06)',
          borderRadius: '6px',
          px: 1.5,
          py: 0.5,
          height: 32,
        }}>
          <Box
            component="img"
            src="/icons/ic_web_bed.svg"
            sx={{ width: 18, height: 18 }}
          />
          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#CBD5E1' }}>
            {stats.empty}
          </Typography>
          <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#94A3B8' }}>
            빈침상
          </Typography>
        </Box>
      </Box>

      {/* 우측 영역: 설정 + 날짜/시간 */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
        {/* 설정 버튼 */}
        <Box
          onClick={onOpenSettings}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            bgcolor: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px',
            px: 1.5,
            py: 0.5,
            height: 32,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.16)',
            },
          }}
        >
          <Box
            component="img"
            src="/icons/ic_web_setting.svg"
            sx={{ width: 15, height: 16 }}
          />
          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
            설정
          </Typography>
        </Box>

        {/* 날짜/시간 (더블클릭 → 로그아웃) */}
        <Box
          onDoubleClick={() => setShowLogoutModal(true)}
          sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'default', userSelect: 'none' }}
        >
          <Typography sx={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#FFFFFF',
            fontFamily: 'Pretendard',
            letterSpacing: '0.5px',
          }}>
            {dateStr}
          </Typography>

          <Box sx={{ width: '1px', height: 20, bgcolor: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />

          <Typography sx={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#FFFFFF',
            fontFamily: 'Pretendard',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.5px',
          }}>
            {timeStr}
          </Typography>
        </Box>
      </Box>

      {/* 로그아웃 확인 모달 */}
      <Modal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Box sx={{
          bgcolor: 'white',
          borderRadius: '16px',
          p: 3,
          minWidth: 320,
          outline: 'none',
          boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.16)',
          textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#1E293B', mb: 1 }}>
            로그아웃
          </Typography>
          <Typography sx={{ fontSize: '14px', color: '#64748B', mb: 3 }}>
            정말 로그아웃 하시겠습니까?
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button
              onClick={() => setShowLogoutModal(false)}
              sx={{
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#64748B',
                bgcolor: '#F1F5F9',
                px: 3,
                py: 1,
                textTransform: 'none',
                '&:hover': { bgcolor: '#E2E8F0' },
              }}
            >
              취소
            </Button>
            <Button
              onClick={handleLogout}
              sx={{
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                bgcolor: '#EF4444',
                px: 3,
                py: 1,
                textTransform: 'none',
                '&:hover': { bgcolor: '#DC2626' },
              }}
            >
              로그아웃
            </Button>
          </Box>
        </Box>
      </Modal>
    </HeaderBar>
  )
}

export default MonitoringHeader
