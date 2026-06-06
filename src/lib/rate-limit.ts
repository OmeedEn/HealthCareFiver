import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface RateLimitOptions {
  /** Identifier this bucket maps to (e.g. "login", "signup"). */
  bucket: string
  /** Max requests inside `windowSeconds`. */
  max: number
  /** Sliding window length, in seconds. */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // First entry is the original client IP per RFC 7239 convention.
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

/**
 * Check (and consume) the rate-limit bucket for this request. Returns
 * `{ allowed: false }` once the caller has exceeded `max` requests inside
 * `windowSeconds`.
 *
 * Buckets key off (bucket, IP, extraKey?). Extra keys let you also limit per
 * email so a botnet can't burn through one email by rotating IPs.
 */
export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions,
  extraKey?: string
): Promise<RateLimitResult> {
  // If the platform isn't configured (demo mode, or first-run), no-op rather
  // than 500. The /api/auth routes only matter once Supabase is set up.
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const key = [options.bucket, clientIp(request), extraKey ?? ''].join(':')
  const { data, error } = await admin.rpc('check_rate_limit', {
    p_key: key,
    p_max_requests: options.max,
    p_window_seconds: options.windowSeconds,
  })

  if (error) {
    // Fail open: a rate-limit outage shouldn't take down login. Log it so we
    // notice in production.
    console.error('Rate-limit RPC failed:', error)
    return { allowed: true, retryAfterSeconds: 0 }
  }

  return {
    allowed: Boolean(data),
    retryAfterSeconds: data ? 0 : options.windowSeconds,
  }
}
