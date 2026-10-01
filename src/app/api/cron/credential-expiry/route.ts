/**
 * Legacy path. Credential expiry (now 60/30-day reminders instead of
 * 90/60/30, plus lapse handling) moved into the daily compliance job at
 * /api/cron/compliance, which is what vercel.json schedules. This alias runs
 * the same idempotent job so any external scheduler still pointing here
 * keeps working without double-sending.
 */
export { GET } from '../compliance/route'

// Segment config must be declared literally (not re-exported).
export const maxDuration = 300
