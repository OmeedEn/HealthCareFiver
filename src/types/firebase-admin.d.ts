declare module 'firebase-admin' {
  interface App {
    name: string
  }

  interface Credential {
    cert(serviceAccount: Record<string, unknown>): unknown
  }

  const apps: App[]
  const credential: Credential

  function initializeApp(config: {
    credential: unknown
  }): App

  export { apps, credential, initializeApp, App }
}

declare module 'firebase-admin/messaging' {
  interface Message {
    notification?: {
      title?: string
      body?: string
    }
    token?: string
    topic?: string
    data?: Record<string, string>
  }

  interface Messaging {
    send(message: Message): Promise<string>
    sendEachForMulticast(message: {
      tokens: string[]
      notification?: { title?: string; body?: string }
      data?: Record<string, string>
    }): Promise<{ successCount: number; failureCount: number }>
  }

  function getMessaging(): Messaging

  export { getMessaging, Messaging, Message }
}
