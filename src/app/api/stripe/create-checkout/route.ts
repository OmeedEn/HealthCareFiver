import { NextResponse } from 'next/server'

// The $29/mo professional subscription was dropped. Sanus is free to join and a
// small service fee applies to each booking, so there is nothing to check out.
// Kept (instead of deleted) so stale clients get a clear answer, not a 404.
const GONE_MESSAGE =
  'Professional subscriptions are no longer offered. Sanus is free to join; a small service fee applies to each booking. Visit /go-live to accept the contractor agreement and set up payouts.'

export async function POST() {
  return NextResponse.json({ error: GONE_MESSAGE }, { status: 410 })
}
