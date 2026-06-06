import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// This endpoint is called by Vercel Cron daily
// vercel.json: { "crons": [{ "path": "/api/cron/credential-expiry", "schedule": "0 8 * * *" }] }

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const results = { alerts_30: 0, alerts_60: 0, alerts_90: 0, expired: 0 }

    // Mark expired credentials
    const { data: expired, error: expiredError } = await supabase
      .from('credentials')
      .update({ status: 'expired' })
      .eq('status', 'verified')
      .lt('expiration_date', now.toISOString().split('T')[0])
      .select('id, contractor_id, name')

    if (expiredError) throw expiredError

    if (expired) {
      results.expired = expired.length
      for (const cred of expired) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: cred.contractor_id,
            type: 'credential_expiring',
            title: 'Credential Expired',
            body: `Your credential "${cred.name}" has expired. Please upload an updated version.`,
            data: { credential_id: cred.id },
          })
        if (notifError) console.error('Failed to insert expired notification', notifError)
      }
    }

    // 30-day expiration alerts
    const in30Days = new Date(now)
    in30Days.setDate(in30Days.getDate() + 30)

    const { data: expiring30 } = await supabase
      .from('credentials')
      .select('id, contractor_id, name, expiration_date')
      .eq('status', 'verified')
      .eq('expiry_alert_30_sent', false)
      .lte('expiration_date', in30Days.toISOString().split('T')[0])
      .gt('expiration_date', now.toISOString().split('T')[0])

    if (expiring30) {
      results.alerts_30 = expiring30.length
      for (const cred of expiring30) {
        const { error: updateError } = await supabase
          .from('credentials')
          .update({
            status: 'expiring_soon',
            expiry_alert_30_sent: true,
          })
          .eq('id', cred.id)
        if (updateError) {
          console.error('Failed to mark 30d alert sent', updateError)
          continue
        }

        await supabase.from('notifications').insert({
          user_id: cred.contractor_id,
          type: 'credential_expiring',
          title: 'Credential Expiring Soon',
          body: `Your credential "${cred.name}" expires on ${cred.expiration_date}. Please renew it.`,
          data: { credential_id: cred.id },
        })
      }
    }

    // 60-day alerts
    const in60Days = new Date(now)
    in60Days.setDate(in60Days.getDate() + 60)

    const { data: expiring60 } = await supabase
      .from('credentials')
      .select('id, contractor_id, name, expiration_date')
      .eq('status', 'verified')
      .eq('expiry_alert_60_sent', false)
      .lte('expiration_date', in60Days.toISOString().split('T')[0])
      .gt('expiration_date', in30Days.toISOString().split('T')[0])

    if (expiring60) {
      results.alerts_60 = expiring60.length
      for (const cred of expiring60) {
        const { error: updateError } = await supabase
          .from('credentials')
          .update({ expiry_alert_60_sent: true })
          .eq('id', cred.id)
        if (updateError) {
          console.error('Failed to mark 60d alert sent', updateError)
          continue
        }

        await supabase.from('notifications').insert({
          user_id: cred.contractor_id,
          type: 'credential_expiring',
          title: 'Credential Expiring in 60 Days',
          body: `Your credential "${cred.name}" expires on ${cred.expiration_date}. Consider renewing it soon.`,
          data: { credential_id: cred.id },
        })
      }
    }

    // 90-day alerts
    const in90Days = new Date(now)
    in90Days.setDate(in90Days.getDate() + 90)

    const { data: expiring90 } = await supabase
      .from('credentials')
      .select('id, contractor_id, name, expiration_date')
      .eq('status', 'verified')
      .eq('expiry_alert_90_sent', false)
      .lte('expiration_date', in90Days.toISOString().split('T')[0])
      .gt('expiration_date', in60Days.toISOString().split('T')[0])

    if (expiring90) {
      results.alerts_90 = expiring90.length
      for (const cred of expiring90) {
        const { error: updateError } = await supabase
          .from('credentials')
          .update({ expiry_alert_90_sent: true })
          .eq('id', cred.id)
        if (updateError) {
          console.error('Failed to mark 90d alert sent', updateError)
          continue
        }

        await supabase.from('notifications').insert({
          user_id: cred.contractor_id,
          type: 'credential_expiring',
          title: 'Credential Expiring in 90 Days',
          body: `Your credential "${cred.name}" expires on ${cred.expiration_date}.`,
          data: { credential_id: cred.id },
        })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    console.error('Credential expiry cron failed:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
