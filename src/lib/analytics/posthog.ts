import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // we handle manually for SPAs
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
  posthog.capture('$pageview', { $current_url: url || window.location.href })
}

export function resetUser() {
  if (!initialized) return
  posthog.reset()
}

export { posthog }
