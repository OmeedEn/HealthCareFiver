/**
 * Provider vs browse mode for professionals (Provider Onboarding spec: "One
 * account, two modes. Use the switch in the navigation to move between
 * them."). Stored in a cookie so shared pages (/messages, /events) keep the
 * mode the professional picked.
 */
export type AppMode = 'provider' | 'browse'
export const MODE_COOKIE = 'sanus_mode'

export function readModeCookie(cookie: string): AppMode {
  return /(?:^|;\s*)sanus_mode=browse(?:;|$)/.test(cookie) ? 'browse' : 'provider'
}

export function writeModeCookie(mode: AppMode) {
  document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}
