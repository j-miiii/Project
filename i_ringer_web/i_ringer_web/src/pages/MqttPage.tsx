import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Button
} from '@mui/material'
import { dataProvider } from '../providers/dataProvider'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { useMqtt } from '../contexts/MqttContext'
import { useGlobalContext } from '../contexts/GlobalContext'

interface Device {
  id: number
  device_code: string
  device_name: string
  serial_number: string
  battery_percent?: number
  bed_id?: number
  bed_number?: string
  room_id?: number
  bed?: { id: number; bed_number: string }
  hospital?: { id: number; name: string }
  ward?: { id: number; name: string }
  room?: { id: number; name: string; room_number?: string }
}

interface MqttMessage {
  timestamp: string
  topic: string
  message: string
}

const MqttPage: React.FC = () => {
  const { isDarkMode } = useTheme()
  const [searchParams] = useSearchParams()
  const [device, setDevice] = useState<Device | null>(null)
  const [mqttMessages, setMqttMessages] = useState<MqttMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const subscribedRef = useRef(false) // 구독 상태 추적
  const { lastMessage, messages: contextMessages, isConnected, subscribe, unsubscribe } = useMqtt()
  const { rooms, loadRooms } = useGlobalContext()

  // H/W 기기 MQTT 토픽 구독 (/iringer_data + /iringer_emergency)
  useEffect(() => {
    if (!isConnected || !device || subscribedRef.current) {
      return
    }

    subscribe('/iringer_data')
    subscribe('/iringer_emergency')
    subscribedRef.current = true
    console.log('🔌 MqttPage: Subscribed to /iringer_data, /iringer_emergency')

    return () => {
      unsubscribe('/iringer_data')
      unsubscribe('/iringer_emergency')
      subscribedRef.current = false
    }
  }, [isConnected, device])

  useEffect(() => {
    const deviceId = searchParams.get('deviceId')
    // console.log('MqttPage - deviceId from URL:', deviceId)
    if (deviceId) {
      loadDevice(parseInt(deviceId))
      loadRooms() // rooms 데이터 로드
      // 더미 데이터는 제거하고 실시간 데이터 사용
      // loadDummyData()
    }

    // HTML 초기 로더 제거
    setTimeout(() => {
      const loader = document.getElementById('initial-loader')
      if (loader) {
        loader.classList.add('initial-loader--fade-out')
        setTimeout(() => {
          loader.remove()
        }, 300)
      }
    }, 500)
  }, [searchParams])

  // 실시간 MQTT 메시지 수신 - H/W 기기 데이터만 처리
  useEffect(() => {
    if (!lastMessage || !device) {
      return
    }

    const topic = lastMessage.topic || ''

    // /iringer_data 또는 /iringer_emergency 토픽만 처리
    if (topic !== 'iringer_data' && topic !== 'iringer_emergency' &&
        topic !== '/iringer_data' && topic !== '/iringer_emergency') {
      return
    }

    // 메시지 데이터 파싱
    let messageData: any = lastMessage.data
    if (typeof messageData === 'string') {
      try {
        messageData = JSON.parse(messageData)
      } catch (e) {
        // JSON 파싱 실패 시 원본 문자열 사용
      }
    }

    // sn 필드로 기기 필터링
    if (messageData && typeof messageData === 'object' && messageData.sn) {
      if (messageData.sn !== device.serial_number) {
        return
      }

      // 배터리 값이 있으면 device 상태 업데이트
      if (messageData.battery !== undefined && messageData.battery !== null) {
        setDevice(prev => prev ? { ...prev, battery_percent: messageData.battery } : prev)
      }

      // 로그에 추가
      const newMessage: MqttMessage = {
        timestamp: lastMessage.timestamp || new Date().toLocaleTimeString('ko-KR'),
        topic: topic,
        message: typeof lastMessage.data === 'string'
          ? lastMessage.data
          : JSON.stringify(lastMessage.data, null, 2)
      }

      setMqttMessages(prev => [...prev, newMessage].slice(-100))
    }
  }, [lastMessage])

  // 메시지가 추가될 때 자동 스크롤
  useEffect(() => {
    scrollToBottom()
  }, [mqttMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadDevice = async (deviceId: number) => {
    try {
      console.log('🔍 MqttPage: Loading device ID:', deviceId)
      const response = await dataProvider.getOne('devices', deviceId)
      console.log('🔍 MqttPage: getOne response:', response)
      if (response) {
        setDevice(response as Device)
      }
    } catch (error) {
      console.error('Failed to load device:', error)
    }
  }

  const handleClearMessages = () => {
    setMqttMessages([])
  }

  const loadDummyData = () => {
    // 더미 데이터 추가
    const dummyMessages: MqttMessage[] = [
      { timestamp: '14:30:09', topic: 'MQTT', message: 'Connection established to broker' },
      { timestamp: '14:30:13', topic: 'topic/iringer/0001/fluid', message: '{"level": 750, "unit": "ml"}' },
      { timestamp: '14:30:14', topic: 'topic/iringer/0001/temperature', message: '{"value": 23.5, "unit": "celsius"}' },
      { timestamp: '14:30:15', topic: 'topic/iringer/0001/battery', message: '{"level": 85, "status": "normal"}' },
      { timestamp: '14:30:16', topic: 'topic/iringer/0001/network', message: '{"signal": -45, "quality": "strong"}' },
      { timestamp: '00:01:07', topic: 'topic/iringer/0001/sensor', message: '{"accelerometer": [0.1, 0.2, 9.8]}' },
      { timestamp: '00:01:09', topic: 'topic/iringer/0001/pressure', message: '{"value": 120, "unit": "mmHg"}' },
      { timestamp: '00:01:12', topic: 'topic/iringer/0001/pressure', message: '{"value": 120, "unit": "mmHg"}' },
      { timestamp: '00:01:14', topic: 'topic/iringer/0001/flow', message: '{"rate": 50, "unit": "ml/h"}' },
      { timestamp: '00:01:17', topic: 'topic/iringer/0001/pressure', message: '{"value": 120, "unit": "mmHg"}' },
      { timestamp: '00:01:20', topic: 'topic/iringer/0001/pressure', message: '{"value": 120, "unit": "mmHg"}' },
      { timestamp: '00:01:22', topic: 'topic/iringer/0001/network', message: '{"signal": -45, "quality": "strong"}' },
      { timestamp: '00:01:25', topic: 'topic/iringer/0001/sensor', message: '{"accelerometer": [0.1, 0.2, 9.8]}' },
      { timestamp: '00:01:27', topic: 'topic/iringer/0001/flow', message: '{"rate": 50, "unit": "ml/h"}' },
      { timestamp: '00:01:30', topic: 'topic/iringer/0001/fluid', message: '{"level": 750, "unit": "ml"}' },
      { timestamp: '00:01:32', topic: 'topic/iringer/0001/battery', message: '{"level": 85, "status": "normal"}' },
      { timestamp: '00:01:35', topic: 'topic/iringer/0001/battery', message: '{"level": 85, "status": "normal"}' },
    ]
    setMqttMessages(dummyMessages.reverse())
  }

  const getLocationString = (device: Device) => {
    // bed_id가 없으면 연결된 병상 없음
    if (!device.bed_id) {
      return '-'
    }

    // bed_number 가져오기
    const bedNumber = device.bed_number || device.bed?.bed_number

    // 병실 정보 - rooms 배열에서 찾기
    const roomId = device.room_id || device.room?.id
    if (roomId) {
      const room = rooms.find(r => r.id === roomId)
      if (room && bedNumber) {
        return `${room.room_number}-${bedNumber}`
      }
    }

    return '-'
  }

  if (!device) {
    return (
      <Box sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: isDarkMode ? colors.gray.gray800 : 'white'
      }}>
        <Typography sx={{ color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600 }}>
          기기 정보를 불러오는 중...
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
      p: 3,
      gap: 3
    }}>
      {/* 좌측: 기기 정보 */}
      <Box sx={{
        width: '220px',
        minWidth: '220px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {/* 헤더 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography sx={{
            fontSize: '18px',
            fontWeight: 700,
            color: colors.mainColor.blue
          }}>
            &gt;_
          </Typography>
          <Typography sx={{
            fontSize: '18px',
            fontWeight: 700,
            color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900
          }}>
            MQTT 데이터 스트림
          </Typography>
        </Box>

        {/* 기기명 카드 */}
        <Box sx={{
          bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
          borderRadius: '16px',
          p: 2.5
        }}>
          <Typography sx={{
            fontSize: '18px',
            fontWeight: 600,
            color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900,
            mb: 0.5
          }}>
            {device.device_name}
          </Typography>
          <Typography sx={{
            fontSize: '14px',
            color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600
          }}>
            기기명
          </Typography>
        </Box>

        {/* 배터리 카드 - null일 때도 항상 표시 */}
        <Box sx={{
          bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
          borderRadius: '16px',
          p: 2.5
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography sx={{
              fontSize: '18px',
              fontWeight: 600,
              color: (device.battery_percent !== undefined && device.battery_percent !== null && device.battery_percent <= 24)
                ? colors.mainColor.red
                : (isDarkMode ? colors.gray.gray100 : colors.gray.gray900),
              minWidth: '50px'
            }}>
              {(device.battery_percent !== undefined && device.battery_percent !== null) ? `${device.battery_percent}%` : '-%'}
            </Typography>
            <Box sx={{
              flex: 1,
              height: '18px',
              bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
              borderRadius: '9px',
              overflow: 'hidden'
            }}>
              <Box sx={{
                width: (device.battery_percent !== undefined && device.battery_percent !== null) ? `${device.battery_percent}%` : '0%',
                height: '100%',
                bgcolor: (device.battery_percent !== undefined && device.battery_percent !== null && device.battery_percent <= 24)
                  ? colors.mainColor.red
                  : colors.mainColor.green,
                transition: 'width 0.3s'
              }} />
            </Box>
          </Box>
          <Typography sx={{
            fontSize: '12px',
            color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600
          }}>
            배터리
          </Typography>
        </Box>

        {/* 병상 카드 */}
        <Box sx={{
          bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
          borderRadius: '16px',
          p: 2.5
        }}>
          <Typography sx={{
            fontSize: '16px',
            fontWeight: 600,
            color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
            mb: 0.5
          }}>
            {getLocationString(device)}
          </Typography>
          <Typography sx={{
            fontSize: '12px',
            color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600
          }}>
            병상
          </Typography>
        </Box>

        {/* 시리얼 넘버 카드 */}
        <Box sx={{
          bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
          borderRadius: '16px',
          p: 2.5
        }}>
          <Typography sx={{
            fontSize: '16px',
            fontWeight: 600,
            color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
            mb: 0.5
          }}>
            {device.serial_number}
          </Typography>
          <Typography sx={{
            fontSize: '12px',
            color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600
          }}>
            시리얼 넘버
          </Typography>
        </Box>
      </Box>

      {/* 우측: MQTT 로그 */}
      <Box sx={{
        flex: 1,
        bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
        borderRadius: '16px',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        mt: '46px'
      }}>
        {/* 헤더 */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: isConnected ? colors.mainColor.green : colors.mainColor.red,
              animation: isConnected ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 }
              }
            }} />
            <Typography sx={{
              fontSize: '18px',
              fontWeight: 600,
              color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900
            }}>
              실시간 로그
            </Typography>
            <Typography sx={{
              fontSize: '14px',
              color: isConnected ? colors.mainColor.green : colors.mainColor.red,
              fontWeight: 500
            }}>
              {isConnected ? '연결됨' : '연결 끊김'}
            </Typography>
            <Typography sx={{
              fontSize: '16px',
              color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600
            }}>
              {mqttMessages.length}개
            </Typography>
          </Box>
          <Button
            onClick={handleClearMessages}
            variant="outlined"
            sx={{
              bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
              borderColor: colors.mainColor.red,
              color: colors.mainColor.red,
              fontSize: '14px',
              textTransform: 'none',
              px: 2,
              py: 0.5,
              borderRadius: '8px',
              '&:hover': {
                bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                borderColor: colors.mainColor.red,
                opacity: 0.8
              }
            }}
          >
            지우기
          </Button>
        </Box>

        {/* 로그 영역 */}
        <Box sx={{
          flex: 1,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '14px',
          lineHeight: 1.8
        }}>
          {mqttMessages.length === 0 ? (
            <Typography sx={{
              color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600,
              textAlign: 'center',
              mt: 4
            }}>
              MQTT 데이터 스트림이 시작되면 로그가 표시됩니다.
            </Typography>
          ) : (
            mqttMessages.map((msg, index) => {
              const isSystemMessage = msg.topic === 'SYSTEM'
              return (
                <Box key={index} sx={{ mb: 0.5, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray700 }}>
                  <Typography component="span" sx={{ color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500, fontFamily: 'monospace', fontSize: '14px' }}>
                    [{msg.timestamp}]
                  </Typography>
                  {' '}
                  <Typography component="span" sx={{ color: isSystemMessage ? colors.mainColor.green : colors.mainColor.blue, fontFamily: 'monospace', fontSize: '14px', fontWeight: 600 }}>
                    {isSystemMessage ? 'SYSTEM:' : 'MQTT:'}
                  </Typography>
                  {' '}
                  {!isSystemMessage && (
                    <>
                      <Typography component="span" sx={{ color: colors.mainColor.blue, fontFamily: 'monospace', fontSize: '14px' }}>
                        {msg.topic}
                      </Typography>
                      {' → '}
                    </>
                  )}
                  <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: '14px', color: isSystemMessage ? colors.mainColor.green : (isDarkMode ? colors.gray.gray300 : colors.gray.gray700) }}>
                    {msg.message}
                  </Typography>
                </Box>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </Box>
      </Box>
    </Box>
  )
}

export default MqttPage
