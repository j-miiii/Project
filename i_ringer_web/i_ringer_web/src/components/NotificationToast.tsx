import React, { useEffect, useState } from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { alertCategoryColors, getAlertCategory } from '../utils/statusUtils'

export interface ToastNotification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info' | 'complete'
  title: string
  message: string
  duration: number // 초 단위
}

interface NotificationToastProps {
  notification: ToastNotification
  onClose: (id: string) => void
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const { isDarkMode } = useTheme()
  const [isExiting, setIsExiting] = useState(false)

  // alert_category 기반 색상 반환
  const getAlertColor = () => {
    const upperType = notification.type?.toUpperCase()
    const category = getAlertCategory(upperType || '')
    if (category && alertCategoryColors[category]) {
      return alertCategoryColors[category].text
    }
    // fallback
    if (upperType === 'COMPLETE' || upperType === 'DONE' || upperType === 'ALMOST_DONE') {
      return alertCategoryColors.caution.text
    }
    return alertCategoryColors.critical.text
  }

  const alertColor = getAlertColor()

  useEffect(() => {
    // duration 초 후에 자동으로 닫기
    const timer = setTimeout(() => {
      handleClose()
    }, notification.duration * 1000)

    return () => clearTimeout(timer)
  }, [notification.duration])

  const handleClose = () => {
    setIsExiting(true)
    // 애니메이션 후 실제 제거
    setTimeout(() => {
      onClose(notification.id)
    }, 600)
  }

  const getTypeIcon = (type: string) => {
    const upperType = type?.toUpperCase()
    switch (upperType) {
      case 'COMPLETE':
      case 'SUCCESS':
      case 'DONE':
      case 'ALMOST_DONE':
        return '/icons/ic_check_circle.svg'
      case 'FAST':
      case 'SLOW':
      case 'STOP':
      case 'WARNING':
      case 'ERROR':
        return '/icons/ic_warning.svg'
      case 'DISCONNECTED':
      case 'INFO':
        return '/icons/ic_warning.svg'
      default:
        return '/icons/ic_warning.svg'
    }
  }

  const getBackgroundColor = () => {
    if (isDarkMode) {
      return colors.gray.gray1000
    }
    return 'white'
  }

  return (
    <Box
      sx={{
        width: '360px',
        bgcolor: getBackgroundColor(),
        backdropFilter: 'blur(50px)',
        WebkitBackdropFilter: 'blur(50px)',
        borderRadius: '16px',
        boxShadow: isDarkMode
          ? '0px 2px 8px rgba(0, 0, 0, 0.2)'
          : '0px 2px 8px rgba(0, 0, 0, 0.08)',
        p: 2.5,
        mb: 2,
        animation: isExiting
          ? 'slideOut 0.6s ease-in-out forwards'
          : 'slideIn 0.3s ease-in-out',
        '@keyframes slideIn': {
          '0%': {
            transform: 'translateX(400px)',
            opacity: 0
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: 1
          }
        },
        '@keyframes slideOut': {
          '0%': {
            transform: 'translateX(0)',
            opacity: 1
          },
          '100%': {
            transform: 'translateX(400px)',
            opacity: 0
          }
        }
      }}
    >
      {/* 첫 줄: 타이틀 - X 버튼 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {/* 타입에 따른 아이콘 */}
        {getTypeIcon(notification.type) && (
          <Box
            sx={{
              width: 20,
              height: 20,
              flexShrink: 0,
              alignSelf: 'center',
              display: 'block',
              bgcolor: alertColor,
              mask: `url(${getTypeIcon(notification.type)}) no-repeat center / contain`,
              WebkitMask: `url(${getTypeIcon(notification.type)}) no-repeat center / contain`,
            }}
          />
        )}

        {/* 타이틀 */}
        <Typography
          sx={{
            fontSize: '16px',
            fontWeight: 700,
            color: alertColor,
            flexGrow: 1,
            minWidth: 0,
            lineHeight: '20px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {notification.title}
        </Typography>

        {/* 삭제 버튼 */}
        <IconButton
          onClick={handleClose}
          sx={{
            width: 16,
            height: 16,
            padding: 0,
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src="/icons/ic_close.svg"
            sx={{
              width: 16,
              height: 16,
              filter: isDarkMode
                ? 'brightness(0) saturate(100%) invert(47%) sepia(0%) saturate(0%) hue-rotate(207deg) brightness(92%) contrast(87%)' // gray500
                : 'brightness(0) saturate(100%) invert(54%) sepia(6%) saturate(352%) hue-rotate(202deg) brightness(92%) contrast(86%)',
            }}
          />
        </IconButton>
      </Box>

      {/* 메시지 */}
      <Box>
        <Typography
          sx={{
            fontSize: '16px',
            fontWeight: 500,
            color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900,
            lineHeight: 1.5,
            wordBreak: 'break-word'
          }}
        >
          {notification.message}
        </Typography>
      </Box>
    </Box>
  )
}

export default NotificationToast
