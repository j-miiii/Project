import React, { useState, useEffect } from 'react'
import { AppBar, Toolbar, Typography, IconButton, Badge, Menu, MenuItem, Box, Avatar, Divider } from '@mui/material'
import {
  Notifications as NotificationsIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { colors } from '../styles/colors'
import NotificationDrawer from './NotificationDrawer'
import { dataProvider } from '../providers/dataProvider'
import { useMqtt } from '../contexts/MqttContext'

const drawerWidth = 240
const drawerWidthCollapsed = 64

const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'sidebarCollapsed' && prop !== 'hasDrawer',
})<{ sidebarCollapsed?: boolean; hasDrawer?: boolean }>(({ theme, sidebarCollapsed, hasDrawer = true }) => ({
  backgroundColor: 'transparent',
  borderBottom: 'none',
  boxShadow: 'none',
  zIndex: 1100,
  top: '24px',
  left: hasDrawer
    ? (sidebarCollapsed ? `calc(${drawerWidthCollapsed}px + 24px)` : `calc(${drawerWidth}px + 24px)`)
    : '24px',
  width: hasDrawer
    ? `calc(100% - ${sidebarCollapsed ? drawerWidthCollapsed : drawerWidth}px - 48px)`
    : 'calc(100% - 48px)',
  transition: theme.transitions.create(['left', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}))

interface HeaderProps {
  onOpenSettings?: () => void
  sidebarCollapsed?: boolean
  hasDrawer?: boolean
}

const Header: React.FC<HeaderProps> = ({
  onOpenSettings = () => {},
  sidebarCollapsed = false,
  hasDrawer = true
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDarkMode, toggleTheme } = useTheme()
  const { lastMessage } = useMqtt()
  const [notificationCount, setNotificationCount] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false)
  const [selectedHospitalName, setSelectedHospitalName] = useState<string>('')

  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const userName = userInfo.nickname || '사용자'
  const userRole = userInfo.role || 'super_admin'
  const userId = userInfo.user_id || userInfo.id

  // 닉네임 기반으로 일관된 색상 생성
  const getAvatarColor = (name: string) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
      '#E63946', '#F77F00', '#06AED5', '#9D4EDD', '#2A9D8F'
    ]

    // 문자열을 해시하여 일관된 인덱스 생성
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }

    return colors[Math.abs(hash) % colors.length]
  }

  const avatarColor = getAvatarColor(userName)
  const firstLetter = userName.charAt(0).toUpperCase()

  // 알림 개수 불러오기
  const loadNotificationCount = async () => {
    if (!userId) return

    try {
      const response = await dataProvider.getList('notifications', {
        page: 1,
        limit: 1,
        where: `user_id:${userId},is_read:0`,
        order: 'id:desc'
      })

      if (response.pagination && response.pagination.total !== undefined) {
        setNotificationCount(response.pagination.total)
      }
    } catch (error) {
      console.error('Failed to load notification count:', error)
    }
  }

  // 컴포넌트 마운트 시 및 주기적으로 알림 개수 업데이트
  useEffect(() => {
    loadNotificationCount()

    // 30초마다 알림 개수 새로고침
    const interval = setInterval(() => {
      loadNotificationCount()
    }, 30000)

    return () => clearInterval(interval)
  }, [userId])

  // MQTT 알림 메시지 감지하여 실시간 카운트 증가
  useEffect(() => {
    if (!lastMessage) return

    // notification 토픽인 경우에만 처리
    if (lastMessage.topic && lastMessage.topic.includes('/notification')) {
      setNotificationCount(prev => prev + 1)
    }
  }, [lastMessage])

  // 선택된 병원 이름 가져오기
  useEffect(() => {
    const loadSelectedHospitalName = async () => {
      const selectedHospitalId = localStorage.getItem('monitoring_hospital')
      if (!selectedHospitalId) {
        setSelectedHospitalName('')
        return
      }

      try {
        const response = await dataProvider.getList('hospitals', {
          page: 1,
          limit: 100
        })

        if (response.data) {
          const hospital = response.data.find((h: any) => String(h.id) === selectedHospitalId)
          if (hospital) {
            setSelectedHospitalName((hospital as any).name)
          }
        }
      } catch (error) {
        console.error('Failed to load hospital name:', error)
      }
    }

    loadSelectedHospitalName()

    // localStorage 변경 감지 (다른 탭에서의 변경)
    const handleStorageChange = () => {
      loadSelectedHospitalName()
    }
    window.addEventListener('storage', handleStorageChange)

    // 같은 탭에서의 병원 선택 변경 감지 (커스텀 이벤트)
    const handleHospitalChange = () => {
      loadSelectedHospitalName()
    }
    window.addEventListener('monitoring_hospital_changed', handleHospitalChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('monitoring_hospital_changed', handleHospitalChange)
    }
  }, [])

  // role 한글 변환
  const getRoleDisplayName = (role: string) => {
    switch(role) {
      case 'super_admin': return '최고관리자'
      case 'admin': return '병원관리자'
      case 'nurse': return '간호사'
      default: return role
    }
  }
  
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  
  const handleUserMenuClose = () => {
    setAnchorEl(null)
  }
  
  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_info')
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('user_setting') // 사용자 설정 제거
    // 모니터링 페이지 선택값 초기화
    localStorage.removeItem('monitoring_hospital')
    localStorage.removeItem('monitoring_ward')
    localStorage.removeItem('monitoring_rooms')
    localStorage.removeItem('monitoring_bedsPerRow')
    navigate('/login')
  }
  
  return (
    <StyledAppBar position="fixed" sidebarCollapsed={sidebarCollapsed} hasDrawer={hasDrawer}>
      <Toolbar sx={{
        backgroundColor: isDarkMode ? colors.gray.gray1000 : 'var(--bg-primary)',
        borderRadius: '32px',
        transition: 'background-color 0.3s ease'
      }}>
        {/* Page Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Typography variant="h6" sx={{ color: 'var(--text-primary)', fontFamily: 'Pretendard', fontWeight: 700, fontSize: '20px' }}>
            {selectedHospitalName ? `${selectedHospitalName} 수액 모니터링 시스템` : '수액 모니터링 시스템'}
          </Typography>
        </Box>

        {/* Right side icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Notifications */}
          <IconButton onClick={() => setNotificationDrawerOpen(true)}>
            <Badge badgeContent={notificationCount} color="error">
              <Box
                component="img"
                src="/icons/ic_bell.svg"
                sx={{
                  width: 24,
                  height: 24,
                  filter: 'brightness(0) saturate(100%) invert(35%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(90%)',
                }}
              />
            </Badge>
          </IconButton>
          
          {/* Dark/Light mode toggle */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray200,
              borderRadius: '32px',
              padding: '4px',
            }}
          >
            <IconButton
              onClick={() => isDarkMode && toggleTheme()}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: !isDarkMode ? colors.mainColor.blue : 'transparent',
                color: !isDarkMode ? 'white' : colors.gray.gray400,
                '&:hover': {
                  backgroundColor: !isDarkMode ? colors.mainColor.blue : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <Box
                component="img"
                src="/icons/ic_light_mode.svg"
                sx={{
                  width: 24,
                  height: 24,
                  filter: !isDarkMode
                    ? 'brightness(0) invert(1)'
                    : 'brightness(0) saturate(100%) invert(35%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(90%)',
                }}
              />
            </IconButton>
            <IconButton
              onClick={() => !isDarkMode && toggleTheme()}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: isDarkMode ? colors.mainColor.blue : 'transparent',
                color: isDarkMode ? 'white' : colors.gray.gray400,
                '&:hover': {
                  backgroundColor: isDarkMode ? colors.mainColor.blue : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <Box
                component="img"
                src="/icons/ic_dark_mode.svg"
                sx={{
                  width: 24,
                  height: 24,
                  filter: isDarkMode
                    ? 'brightness(0) invert(1)'
                    : 'brightness(0) saturate(100%) invert(35%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(90%)',
                }}
              />
            </IconButton>
          </Box>
          
          {/* Settings */}
          <IconButton onClick={onOpenSettings}>
            <Box
              component="img"
              src="/icons/ic_setting.svg"
              sx={{
                width: 24,
                height: 24,
                filter: 'brightness(0) saturate(100%) invert(35%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(90%)',
              }}
            />
          </IconButton>
          
          {/* User Profile - Avatar with dropdown arrow */}
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
            <IconButton
              onClick={handleUserMenuOpen}
              sx={{
                borderRadius: '24px',
                padding: '4px 8px 4px 4px',
                '&:hover': { backgroundColor: 'var(--bg-tertiary)' },
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor: avatarColor,
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'Pretendard'
                }}
              >
                {firstLetter}
              </Avatar>
              <ExpandMoreIcon sx={{ color: 'var(--text-secondary)', fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>
        
        {/* User Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleUserMenuClose}
          disableScrollLock={true}
          slotProps={{
            paper: {
              elevation: 3,
              sx: {
                mt: 1.5,
                minWidth: 120,
                borderRadius: '12px',
                bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                '& .MuiMenuItem-root': {
                  px: 2,
                  py: 1,
                }
              }
            }
          }}
        >
          <MenuItem disabled>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PersonIcon sx={{ mr: 1, fontSize: 20, color: 'var(--text-secondary)' }} />
                <Typography variant="body2" sx={{ fontSize: '18px', color: isDarkMode ? colors.gray.gray200 : 'inherit' }}>{userName}</Typography>
              </Box>
              <Typography variant="caption" sx={{ fontSize: '14px', ml: '28px', color: isDarkMode ? colors.gray.gray200 : 'text.secondary' }}>{getRoleDisplayName(userRole)}</Typography>
            </Box>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ color: colors.mainColor.red, fontSize: '18px' }}>
            <LogoutIcon sx={{ mr: 1.5, fontSize: 20, color: colors.mainColor.red }} />
            로그아웃
          </MenuItem>
        </Menu>

        {/* Notification Drawer */}
        <NotificationDrawer
          open={notificationDrawerOpen}
          onClose={() => {
            setNotificationDrawerOpen(false)
            // Drawer 닫을 때 알림 개수 다시 로드
            loadNotificationCount()
          }}
        />
      </Toolbar>
    </StyledAppBar>
  )
}

export default Header