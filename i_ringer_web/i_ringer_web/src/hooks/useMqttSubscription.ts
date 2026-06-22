import { useEffect, useState } from 'react'
import { useMqtt } from '../contexts/MqttContext'

interface MqttMessage {
  type: string
  data: any
  topic?: string
  timestamp?: string
}

interface UseMqttSubscriptionOptions {
  type?: string // 특정 타입의 메시지만 필터링
  onMessage?: (message: MqttMessage) => void
}

export const useMqttSubscription = (options?: UseMqttSubscriptionOptions) => {
  const { lastMessage, isConnected, messages } = useMqtt()
  const [filteredMessages, setFilteredMessages] = useState<MqttMessage[]>([])

  useEffect(() => {
    if (lastMessage) {
      // 타입 필터링
      if (options?.type && lastMessage.type !== options.type) {
        return
      }

      // 콜백 실행
      if (options?.onMessage) {
        options.onMessage(lastMessage)
      }

      // 필터링된 메시지 저장
      setFilteredMessages(prev => [lastMessage, ...prev].slice(0, 50))
    }
  }, [lastMessage, options?.type])

  return {
    lastMessage,
    messages: options?.type
      ? messages.filter(msg => msg.type === options.type)
      : messages,
    filteredMessages,
    isConnected
  }
}
