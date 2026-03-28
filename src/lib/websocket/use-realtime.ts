import { useEffect, useRef, useState } from 'react'
import type { StompSubscription } from '@stomp/stompjs'
import { useAuthStore } from '@/app/store/auth-store'
import { chronelisStompClient } from '@/lib/websocket/stomp-client'

export function useRealtimeConnection() {
  const accessToken = useAuthStore((state) => state.accessToken)

  useEffect(() => {
    if (!accessToken) {
      chronelisStompClient.disconnect()
      return
    }

    chronelisStompClient.connect(accessToken)

    return () => {
      chronelisStompClient.disconnect()
    }
  }, [accessToken])
}

export function useRealtimeSubscription(destination: string | null, onMessage: (rawBody: string) => void) {
  const subscriptionRef = useRef<StompSubscription | null>(null)
  const [isConnected, setIsConnected] = useState(chronelisStompClient.isConnected())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsConnected(chronelisStompClient.isConnected())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!destination || !isConnected) {
      return
    }

    subscriptionRef.current = chronelisStompClient.subscribe(destination, (message) => {
      onMessage(message.body)
    })

    return () => {
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
  }, [destination, isConnected, onMessage])
}
