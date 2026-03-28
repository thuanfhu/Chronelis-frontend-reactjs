import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { env } from '@/lib/constants/env'

type MessageHandler = (message: IMessage) => void

class ChronelisStompClient {
  private client: Client | null = null

  connect(accessToken: string, onConnected?: () => void) {
    if (this.client?.active) {
      return
    }

    this.client = new Client({
      brokerURL: env.wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        onConnected?.()
      },
      onStompError: (frame) => {
        console.error('STOMP broker error', frame.headers['message'], frame.body)
      },
      onWebSocketError: (event) => {
        console.error('WebSocket error', event)
      },
    })

    this.client.activate()
  }

  disconnect() {
    if (!this.client) {
      return
    }

    void this.client.deactivate()
    this.client = null
  }

  subscribe(destination: string, handler: MessageHandler): StompSubscription | null {
    if (!this.client?.connected) {
      return null
    }

    return this.client.subscribe(destination, handler)
  }

  isConnected() {
    return Boolean(this.client?.connected)
  }
}

export const chronelisStompClient = new ChronelisStompClient()
