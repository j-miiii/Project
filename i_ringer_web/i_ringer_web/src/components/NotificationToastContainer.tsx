import React, { useState, useEffect, useCallback } from 'react'
import { Box } from '@mui/material'
import NotificationToast, { ToastNotification } from './NotificationToast'
import { useMqtt } from '../contexts/MqttContext'
import { dataProvider } from '../providers/dataProvider'
import { getAlertTypeLabel } from '../utils/statusUtils'

const NotificationToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const { lastMessage, isConnected } = useMqtt()

  // localStorage에서 alert_display_time 가져오는 함수
  const getAlertDisplayTime = useCallback((): number => {
    const userSettingStr = localStorage.getItem('user_setting')
    if (userSettingStr) {
      try {
        const userSetting = JSON.parse(userSettingStr)
        return userSetting.alert_display_time || 50
      } catch (error) {
        console.error('Failed to parse user_setting:', error)
      }
    }
    return 50 // 기본값
  }, [])

  // MQTT 메시지 감지
  useEffect(() => {
    if (!lastMessage) {
      return
    }

    // notification 토픽인 경우에만 처리
    if (lastMessage.topic && lastMessage.topic.includes('/notification')) {
      const notificationData = lastMessage.data
      const alertType = notificationData.type?.toUpperCase()

      // console.log('🔔 [ToastContainer] Notification received:', {
      //   type: alertType,
      //   bedId: notificationData.bed_id,
      //   message: notificationData.message
      // })

      // SLOW, STOP, FAST, DONE, ALMOST_DONE, DISCONNECTED 알림만 처리
      if (!alertType || !['SLOW', 'STOP', 'FAST', 'DONE', 'ALMOST_DONE', 'DISCONNECTED'].includes(alertType)) {
        return
      }

      // 토스트 생성 시점에 최신 alert_display_time 가져오기
      const currentDisplayTime = getAlertDisplayTime()

      // 토스트 타입 결정
      const toastType = (alertType === 'DONE' || alertType === 'ALMOST_DONE') ? 'complete' : alertType === 'DISCONNECTED' ? 'info' : 'error'

      // 새로운 토스트 생성
      const newToast: ToastNotification = {
        id: `toast_${Date.now()}_${Math.random()}`,
        type: toastType,
        title: notificationData.title || '알림',
        message: notificationData.message || `${getAlertTypeLabel(alertType)} 알림`,
        duration: currentDisplayTime
      }

      // console.log('🔔 [ToastContainer] Adding toast:', newToast)
      setToasts(prev => [...prev, newToast])
    }
  }, [lastMessage, getAlertDisplayTime])

  const handleCloseToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  // 로그아웃 시 모든 토스트 제거
  useEffect(() => {
    const handleLogout = () => {
      // console.log('🔔 Logout detected in ToastContainer - clearing all toasts')
      setToasts([])
    }

    window.addEventListener('logout', handleLogout)

    return () => {
      window.removeEventListener('logout', handleLogout)
    }
  }, [])

  // MQTT 연결이 끊어지면 토스트 제거
  useEffect(() => {
    if (!isConnected) {
      // console.log('⚠️ MQTT disconnected - clearing all toasts')
      setToasts([])
    }
  }, [isConnected])

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none', // 컨테이너는 클릭 이벤트 무시
        '& > *': {
          pointerEvents: 'auto' // 자식 요소(토스트)는 클릭 가능
        }
      }}
    >
      {toasts.map(toast => (
        <NotificationToast
          key={toast.id}
          notification={toast}
          onClose={handleCloseToast}
        />
      ))}
    </Box>
  )
}

export default NotificationToastContainer
