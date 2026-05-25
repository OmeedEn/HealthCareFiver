/**
 * Firebase Cloud Messaging (FCM) Integration
 * Docs: https://firebase.google.com/docs/cloud-messaging
 *
 * Sends push notifications to contractor and facility mobile/web apps.
 * Topics allow targeting groups (e.g., "contractors-ca" for California).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  /** Notification title shown to the user */
  title: string
  /** Notification body text */
  body: string
  /** Optional image URL displayed in the notification */
  imageUrl?: string
}

export interface DataPayload {
  /** Arbitrary key-value pairs sent with the notification */
  [key: string]: string
}

export interface SendNotificationRequest {
  /** FCM device registration token */
  token: string
  notification: NotificationPayload
  /** Optional data payload for client-side handling */
  data?: DataPayload
}

export interface SendToTopicRequest {
  /** Topic name (e.g., "contractors-ca", "facilities-new-shifts") */
  topic: string
  notification: NotificationPayload
  data?: DataPayload
}

export interface SendMulticastRequest {
  /** List of FCM device registration tokens */
  tokens: string[]
  notification: NotificationPayload
  data?: DataPayload
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface MulticastResult {
  successCount: number
  failureCount: number
  results: SendResult[]
}

// ---------------------------------------------------------------------------
// Firebase Admin initialization
// ---------------------------------------------------------------------------

/**
 * Lazily-loaded Firebase Admin SDK.
 *
 * We use dynamic import to avoid loading Firebase Admin in environments
 * where it isn't needed (e.g., client-side builds, edge functions).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseAdmin: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messagingInstance: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMessaging(): Promise<any> {
  if (messagingInstance) return messagingInstance

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccount) {
    console.warn(
      '[Firebase] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled'
    )
    return null
  }

  try {
    if (!firebaseAdmin) {
      firebaseAdmin = await import('firebase-admin')
    }

    // Initialize only once
    if (firebaseAdmin.apps.length === 0) {
      const credential = JSON.parse(serviceAccount)
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(credential),
      })
    }

    const { getMessaging: getMsg } = await import('firebase-admin/messaging')
    messagingInstance = getMsg()
    return messagingInstance
  } catch (error) {
    console.error('[Firebase] Failed to initialize:', error)
    return null
  }
}

function isConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMessage(notification: NotificationPayload, data?: DataPayload) {
  return {
    notification: {
      title: notification.title,
      body: notification.body,
      ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
    },
    ...(data ? { data } : {}),
  }
}

function skipResult(): SendResult {
  return { success: false, error: 'Firebase not configured — notification skipped' }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a push notification to a single device token.
 */
export async function sendNotification(
  request: SendNotificationRequest
): Promise<SendResult> {
  if (!isConfigured()) {
    console.warn('[Firebase] Skipping notification — not configured')
    return skipResult()
  }

  const messaging = await getMessaging()
  if (!messaging) return skipResult()

  try {
    const messageId = await messaging.send({
      token: request.token,
      ...buildMessage(request.notification, request.data),
    })
    return { success: true, messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Firebase] Send failed:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Send a push notification to all devices subscribed to a topic.
 *
 * Example topics:
 * - "contractors-ca" — all contractors in California
 * - "facilities-new-shifts" — facilities with new shift postings
 * - "urgent-alerts" — high-priority system alerts
 */
export async function sendToTopic(
  request: SendToTopicRequest
): Promise<SendResult> {
  if (!isConfigured()) {
    console.warn('[Firebase] Skipping topic notification — not configured')
    return skipResult()
  }

  const messaging = await getMessaging()
  if (!messaging) return skipResult()

  try {
    const messageId = await messaging.send({
      topic: request.topic,
      ...buildMessage(request.notification, request.data),
    })
    return { success: true, messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Firebase] Topic send failed:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Send a push notification to multiple device tokens at once.
 *
 * Uses FCM's `sendEachForMulticast` for efficient batching.
 * Returns per-token results so you can handle individual failures
 * (e.g., remove stale tokens).
 */
export async function sendMulticast(
  request: SendMulticastRequest
): Promise<MulticastResult> {
  if (!isConfigured()) {
    console.warn('[Firebase] Skipping multicast — not configured')
    return {
      successCount: 0,
      failureCount: request.tokens.length,
      results: request.tokens.map(() => skipResult()),
    }
  }

  const messaging = await getMessaging()
  if (!messaging) {
    return {
      successCount: 0,
      failureCount: request.tokens.length,
      results: request.tokens.map(() => skipResult()),
    }
  }

  try {
    const response = await messaging.sendEachForMulticast({
      tokens: request.tokens,
      ...buildMessage(request.notification, request.data),
    })

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: response.responses.map((r: any) => ({
        success: r.success,
        messageId: r.messageId,
        error: r.error?.message,
      })),
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Firebase] Multicast send failed:', msg)
    return {
      successCount: 0,
      failureCount: request.tokens.length,
      results: request.tokens.map(() => ({ success: false, error: msg })),
    }
  }
}
