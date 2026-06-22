import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import mqtt from 'mqtt'

interface MqttMessage {
  type: string
  data: any
  topic?: string
  timestamp?: string
}

interface MqttContextType {
  isConnected: boolean
  messages: MqttMessage[]
  lastMessage: MqttMessage | null
  clearMessages: () => void
  subscribe: (topic: string) => void
  unsubscribe: (topic: string) => void
}

const MqttContext = createContext<MqttContextType | undefined>(undefined)

interface MqttProviderProps {
  children: React.ReactNode
}

export const MqttProvider: React.FC<MqttProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<MqttMessage[]>([])
  const [lastMessage, setLastMessage] = useState<MqttMessage | null>(null)
  const clientRef = useRef<mqtt.MqttClient | null>(null)
  const currentNotificationTopicRef = useRef<string | null>(null)
  const currentAssignmentRefreshTopicRef = useRef<string | null>(null)
  const subscribedTopicsRef = useRef<Set<string>>(new Set()) // 모든 구독 토픽 추적
  const isLoggedOutRef = useRef<boolean>(false) // 로그아웃 상태 추적

  useEffect(() => {
    // MQTT over WebSocket 연결 (환경 변수 사용)
    const mqttUrl = import.meta.env.VITE_MQTT_URL || 'wss://iringer.kr/mqtt'
    const client = mqtt.connect(mqttUrl, {
      clientId: 'react_client_' + Math.random().toString(16).substring(2, 10),
      clean: true, // 세션 초기화 (이전 메시지 큐 삭제)
      reconnectPeriod: 5000, // 5초마다 재연결 시도
      keepalive: 60, // 60초마다 핑
      connectTimeout: 30 * 1000, // 30초 타임아웃
    })

    clientRef.current = client

    // 사용자별 토픽 구독 함수 (notification + assignment/refresh)
    const subscribeToUserTopics = () => {
      const userId = localStorage.getItem('user_id')

      if (!userId) {
        return
      }

      if (!client.connected) {
        console.warn('⚠️ MQTT not connected - cannot subscribe to user topics')
        return
      }

      // 1. Notification 토픽 구독
      const notificationTopic = `user/${userId}/notification`
      if (currentNotificationTopicRef.current !== notificationTopic || !subscribedTopicsRef.current.has(notificationTopic)) {
        // 기존 notification 토픽 구독 해제 (있는 경우)
        if (currentNotificationTopicRef.current) {
          const oldTopic = currentNotificationTopicRef.current
          client.unsubscribe(oldTopic)
        }

        // 새로운 notification 토픽 구독 (QoS 1로 메시지 전달 보장)
        client.subscribe(notificationTopic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`❌ Failed to subscribe to ${notificationTopic}:`, err)
          } else {
            console.log(`✅ Successfully subscribed to ${notificationTopic}`)
            currentNotificationTopicRef.current = notificationTopic
            subscribedTopicsRef.current.add(notificationTopic)
          }
        })
      }

      // 2. Assignment Refresh 토픽 구독
      const assignmentRefreshTopic = `user/${userId}/assignment/refresh`
      if (currentAssignmentRefreshTopicRef.current !== assignmentRefreshTopic || !subscribedTopicsRef.current.has(assignmentRefreshTopic)) {
        // 기존 assignment/refresh 토픽 구독 해제 (있는 경우)
        if (currentAssignmentRefreshTopicRef.current) {
          const oldTopic = currentAssignmentRefreshTopicRef.current
          client.unsubscribe(oldTopic)
        }

        // 새로운 assignment/refresh 토픽 구독 (QoS 1로 메시지 전달 보장)
        client.subscribe(assignmentRefreshTopic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`❌ Failed to subscribe to ${assignmentRefreshTopic}:`, err)
          } else {
            console.log(`✅ Successfully subscribed to ${assignmentRefreshTopic}`)
            currentAssignmentRefreshTopicRef.current = assignmentRefreshTopic
            subscribedTopicsRef.current.add(assignmentRefreshTopic)
          }
        })
      }
    }

    client.on('connect', () => {
      // 로그아웃 상태면 연결하지 않음
      if (isLoggedOutRef.current) {
        // console.log('⚠️ MQTT Connected but user is logged out - disconnecting')
        client.end(true)
        return
      }

      console.log('✅ MQTT Connected')
      setIsConnected(true)

      // 자동으로 사용자 토픽 구독 (notification + assignment/refresh)
      subscribeToUserTopics()
    })

    // 로그인 이벤트 감지 - 로그인 후 user 토픽 구독
    const handleLogin = () => {
      // 로그아웃 상태 해제
      isLoggedOutRef.current = false

      // MQTT가 연결되어 있지 않으면 재연결
      if (!client.connected) {
        client.reconnect()
      } else {
        // 이미 연결되어 있으면 바로 구독
        subscribeToUserTopics()
      }
    }

    // 로그아웃 이벤트 감지
    const handleLogout = () => {
      // 로그아웃 상태 설정
      isLoggedOutRef.current = true

      // 구독 목록 초기화
      subscribedTopicsRef.current.clear()
      currentNotificationTopicRef.current = null
      currentAssignmentRefreshTopicRef.current = null

      // MQTT 연결 완전히 종료 (unsubscribe 없이 바로 end - 서버가 자동 정리)
      if (client.connected) {
        client.end(true, () => {
          setIsConnected(false)
        })
      }
    }

    window.addEventListener('login', handleLogin)
    window.addEventListener('logout', handleLogout)

    client.on('message', (topic, payload) => {
      try {
        const messageStr = payload.toString()
        let parsedData: any

        try {
          parsedData = JSON.parse(messageStr)
        } catch {
          parsedData = messageStr
        }

        console.log(`📩 MQTT 수신 [${topic}]`, parsedData)

        const mqttMessage: MqttMessage = {
          type: topic.split('/').pop() || 'unknown',
          data: parsedData,
          topic: topic,
          timestamp: new Date().toLocaleTimeString('ko-KR')
        }

        setLastMessage(mqttMessage)
        setMessages(prev => [mqttMessage, ...prev].slice(0, 100)) // 최근 100개만 유지
      } catch (error) {
        console.error('❌ Failed to parse MQTT message:', error)
      }
    })

    client.on('error', (error) => {
      console.error('❌ MQTT Error:', error)
      setIsConnected(false)
    })

    client.on('close', () => {
      // console.log('⚠️ MQTT Connection closed')
      // console.log('📊 Connection state:', {
      //   connected: client.connected,
      //   reconnecting: client.reconnecting,
      //   isLoggedOut: isLoggedOutRef.current
      // })
      setIsConnected(false)
    })

    client.on('offline', () => {
      // console.log('📴 MQTT Client went offline')
    })

    client.on('reconnect', () => {
      // console.log('🔄 MQTT Reconnecting...')
    })

    client.on('disconnect', (packet) => {
      // console.log('🔌 MQTT Disconnected:', packet)
    })

    // Cleanup
    return () => {
      // console.log('Disconnecting MQTT client')
      window.removeEventListener('login', handleLogin)
      window.removeEventListener('logout', handleLogout)
      if (client.connected) {
        client.end()
      }
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setLastMessage(null)
  }, [])

  const subscribe = useCallback((topic: string) => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err)
        } else {
          console.log(`✅ Successfully subscribed to ${topic}`)
          subscribedTopicsRef.current.add(topic) // 구독 목록에 추가
        }
      })
    } else {
      console.warn('⚠️ MQTT client is not connected')
    }
  }, [])

  const unsubscribe = useCallback((topic: string) => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.unsubscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Failed to unsubscribe from ${topic}:`, err)
        } else {
          subscribedTopicsRef.current.delete(topic) // 구독 목록에서 제거
        }
      })
    }
  }, [])

  return (
    <MqttContext.Provider value={{ isConnected, messages, lastMessage, clearMessages, subscribe, unsubscribe }}>
      {children}
    </MqttContext.Provider>
  )
}

export const useMqtt = () => {
  const context = useContext(MqttContext)
  if (context === undefined) {
    throw new Error('useMqtt must be used within a MqttProvider')
  }
  return context
}
