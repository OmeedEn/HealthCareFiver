import posthog, { type CaptureResult } from 'posthog-js'

let initialized = false

/** URL-valued properties PostHog adds on its own (current page, referrer, initial page). */
const URL_PROPS = ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer', '$session_entry_url']

/** Keep origin + path only: query strings and fragments can carry search terms or health topics. */
function stripUrl(value: unknown): unknown {
  if (typeof value !== 'string' || !/[?#]/.test(value)) return value
  return value.split(/[?#]/)[0]
}

function scrubProps(props: Record<string, unknown> | undefined) {
  if (!props) return
  for (const key of URL_PROPS) if (key in props) props[key] = stripUrl(props[key])
  for (const key of Object.keys(props)) {
    if (key.startsWith('$initial_') || key.endsWith('_url')) props[key] = stripUrl(props[key])
  }
}

/** Last line of defense before anything leaves the browser. */
function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event
  scrubProps(event.properties)
  scrubProps(event.$set)
  scrubProps(event.$set_once)
  return event
}

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // we handle manually for SPAs
    // No-PHI boundary: only the explicit, fixed-key events in
    // src/components/auth/signup-tracking.tsx and page views. Autocapture
    // would record clicked element text (message bubbles, notes) and session
    // replay would record the screen, so both stay off regardless of the
    // PostHog project settings.
    autocapture: false,
    disable_session_recording: true,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    disable_surveys: true,
    before_send: scrubEvent,
    loaded: () => { initialized = true },
  })
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.identify(userId, properties)
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture(eventName, properties)
}

export function trackPageView(url?: string) {
  if (!initialized) return
  posthog.capture('$pageview', { $current_url: stripUrl(url || window.location.origin + window.location.pathname) })
}

export function resetUser() {
  if (!initialized) return
  posthog.reset()
}

export { posthog }
