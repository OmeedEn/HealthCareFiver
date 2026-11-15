import * as Sentry from '@sentry/nextjs'
import { scrubBreadcrumb, scrubSentryEvent } from '@/lib/telemetry/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // No request bodies, cookies or query strings (may contain health info).
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubBreadcrumb,
})
