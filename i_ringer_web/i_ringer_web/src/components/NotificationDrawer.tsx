import React, { useEffect } from 'react'
import { Drawer, Box, Typography, IconButton, Button } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { dataProvider } from '../providers/dataProvider'
import { getAlertTypeLabel, getAlertCategory, alertCategoryColors } from '../utils/statusUtils'

interface Notification {
  id: number
  user_id: number
  type: 'success' | 'warning' | 'error' | 'info' | 'complete'
  title: string
  message: string
  is_read: boolean
  created_at: string
  updated_at?: string
}

interface NotificationDrawerProps {
  open: boolean
  onClose: () => void
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ open, onClose }) => {
  const { isDarkMode } = useTheme()
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(false)

  // 로그인한 사용자 정보 가져오기
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const userId = userInfo.user_id || userInfo.id

  // alert_category 기반 색상 반환
  const getAlertColorByType = (type: string) => {
    const upperType = type?.toUpperCase()
    const category = getAlertCategory(upperType || '')
    if (category && alertCategoryColors[category]) {
      return alertCategoryColors[category].text
    }
    return alertCategoryColors.critical.text
  }

  // 알림 목록 불러오기
  const loadNotifications = async () => {
    if (!userId) return

    setLoading(true)
    try {
      const response = await dataProvider.getList('notifications', {
        page: 1,
        limit: 10,
        where: `user_id:${userId},is_read:0`,
        order: 'id:desc'
      })

      if (response.data && Array.isArray(response.data)) {
        setNotifications(response.data as Notification[])
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // drawer가 열릴 때마다 알림 목록 새로고침
  useEffect(() => {
    if (open) {
      loadNotifications()
    }
  }, [open, userId])

  const handleDeleteNotification = async (id: number) => {
    try {
      // 알림을 읽음 처리
      await dataProvider.update('notifications', id, {
        is_read: true,
        read_at: new Date().toISOString()
      })
      // 목록에서 제거
      setNotifications(notifications.filter(n => n.id !== id))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleClearAll = async () => {
    try {
      // 모든 알림을 읽음 처리
      const now = new Date().toISOString()
      const updatePromises = notifications.map(n =>
        dataProvider.update('notifications', n.id, {
          is_read: true,
          read_at: now
        })
      )
      await Promise.all(updatePromises)
      setNotifications([])
      // 알림창 닫기
      onClose()
    } catch (error) {
      console.error('Failed to clear all notifications:', error)
    }
  }

  // 시간 포맷팅 (예: "2분 전", "1시간 전")
  const formatTime = (createdAt: string) => {
    const now = new Date()
    const created = new Date(createdAt)
    const diffMs = now.getTime() - created.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    // 7일 이상이면 날짜 표시
    return `${created.getMonth() + 1}월 ${created.getDate()}일`
  }

  // 메시지에서 강조할 부분(병상 정보, 상태값)을 찾아서 볼드 처리
  const formatMessage = (message: string) => {
    // 먼저 영어 상태값을 한글로 변환
    let convertedMessage = message
      .replace(/\bFAST\b/gi, getAlertTypeLabel('FAST'))
      .replace(/\bSLOW\b/gi, getAlertTypeLabel('SLOW'))
      .replace(/\bSTOP\b/gi, getAlertTypeLabel('STOP'))
      .replace(/\bALMOST_DONE\b/gi, getAlertTypeLabel('ALMOST_DONE'))
      .replace(/\bDONE\b/gi, getAlertTypeLabel('DONE'))
      .replace(/\bDISCONNECTED\b/gi, getAlertTypeLabel('DISCONNECTED'))

    // 병상 정보 패턴: 101호-3번 침대
    const bedPattern = /(\d+호-\d+번 침대)/g
    // 상태값 패턴: 한글 상태값 포함
    const statusPattern = /(완료|완료 임박|오류|시작|종료|경고|알림|속도빠름|속도느림|정지|연결 끊김)/g

    const parts: Array<{ text: string; bold: boolean }> = []
    let lastIndex = 0

    // 모든 매치 찾기
    const matches: Array<{ index: number; text: string }> = []

    let match
    while ((match = bedPattern.exec(convertedMessage)) !== null) {
      matches.push({ index: match.index, text: match[0] })
    }

    bedPattern.lastIndex = 0

    while ((match = statusPattern.exec(convertedMessage)) !== null) {
      matches.push({ index: match.index, text: match[0] })
    }

    // 인덱스 순으로 정렬
    matches.sort((a, b) => a.index - b.index)

    // 텍스트 분할
    matches.forEach((match) => {
      if (match.index > lastIndex) {
        parts.push({ text: convertedMessage.substring(lastIndex, match.index), bold: false })
      }
      parts.push({ text: match.text, bold: true })
      lastIndex = match.index + match.text.length
    })

    // 나머지 텍스트
    if (lastIndex < convertedMessage.length) {
      parts.push({ text: convertedMessage.substring(lastIndex), bold: false })
    }

    return parts
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
        return '/icons/ic_warning.svg'
      default:
        return '/icons/ic_warning.svg'
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{
        BackdropProps: {
          sx: {
            backgroundColor: 'transparent',
          }
        }
      }}
      sx={{
        '& .MuiDrawer-paper': {
          width: 400,
          height: 'auto',
          maxHeight: 'calc(100vh - 64px)',
          margin: '32px 24px',
          bgcolor: isDarkMode ? 'rgba(17, 18, 20, 0.7)' : 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          boxShadow: '-4px 0px 20px rgba(0, 0, 0, 0.1)',
          borderRadius: '18px',
          overflow: 'hidden',
        }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
        {/* 헤더 */}
        <Box
          sx={{
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${isDarkMode ? colors.gray.gray700 : colors.gray.gray200}`,
          }}
        >
          <Typography
            sx={{
              fontSize: '18px',
              fontWeight: 700,
              color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900,
            }}
          >
            알림 목록
          </Typography>
          <Button
            onClick={handleClearAll}
            sx={{
              bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
              color: colors.mainColor.red,
              fontSize: '14px',
              fontWeight: 500,
              textTransform: 'none',
              px: 2,
              py: 0.5,
              borderRadius: '20px',
              border: `1px solid ${colors.mainColor.red}`,
              '&:hover': {
                bgcolor: isDarkMode ? colors.gray.gray900 : 'rgba(255, 107, 107, 0.08)',
              }
            }}
          >
            전체 지우기
          </Button>
        </Box>

        {/* 알림 목록 */}
        <Box
          sx={{
            overflow: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 'calc(90vh - 100px)',
            '&::-webkit-scrollbar': {
              width: '6px'
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: isDarkMode ? colors.gray.gray600 : colors.gray.gray300,
              borderRadius: '3px',
              '&:hover': {
                bgcolor: isDarkMode ? colors.gray.gray500 : colors.gray.gray400
              }
            }
          }}
        >
          {loading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '200px',
              }}
            >
              <Typography
                sx={{
                  fontSize: '16px',
                  color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600,
                }}
              >
                로딩 중...
              </Typography>
            </Box>
          ) : notifications.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '200px',
                gap: 2,
              }}
            >
              <Box
                component="img"
                src="/icons/ic_bell.svg"
                sx={{
                  width: 64,
                  height: 64,
                  opacity: 0.3,
                  filter: isDarkMode ? 'invert(1)' : 'none',
                }}
              />
              <Typography
                sx={{
                  fontSize: '16px',
                  color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600,
                }}
              >
                알림이 없습니다
              </Typography>
            </Box>
          ) : (
            notifications.map((notification) => (
              <Box
                key={notification.id}
                sx={{
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  borderRadius: '16px',
                  p: 2.5,
                  boxShadow: isDarkMode
                    ? '0px 2px 8px rgba(0, 0, 0, 0.2)'
                    : '0px 2px 8px rgba(0, 0, 0, 0.08)',
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
                        bgcolor: getAlertColorByType(notification.type), // type에 따라 고정 색상 적용
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
                      color: getAlertColorByType(notification.type), // type에 따라 고정 색상 적용
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
                    onClick={() => handleDeleteNotification(notification.id)}
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

                {/* 메시지와 시간 */}
                <Box>
                  <Typography
                    sx={{
                      fontSize: '16px',
                      fontWeight: 500,
                      color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900,
                      mb: 1,
                      lineHeight: 1.5,
                    }}
                  >
                    {formatMessage(notification.message).map((part, index) => (
                      <Typography
                        key={index}
                        component="span"
                        sx={{
                          fontWeight: part.bold ? 600 : 500,
                        }}
                      >
                        {part.text}
                      </Typography>
                    ))}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
                    }}
                  >
                    {formatTime(notification.created_at)}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Drawer>
  )
}

export default NotificationDrawer
