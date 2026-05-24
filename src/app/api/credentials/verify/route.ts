import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lookupNPI } from '@/lib/integrations/npi-registry'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { credential_id, npi_number } = body

  const adminSupabase = createAdminClient()

  // NPI verification
  if (npi_number) {
    const result = await lookupNPI(npi_number)

    if (result.valid && result.data) {
      // Update the credential status
      if (credential_id) {
        await adminSupabase
          .from('credentials')
          .update({
            status: 'verified',
            auto_verified: true,
            verified_at: new Date().toISOString(),
            verification_notes: `Auto-verified via NPPES. Name: ${result.data.basic.first_name} ${result.data.basic.last_name}`,
          })
          .eq('id', credential_id)
          .eq('contractor_id', user.id)
      }

      return NextResponse.json({
        valid: true,
        data: {
          name: `${result.data.basic.first_name} ${result.data.basic.last_name}`,
          credential: result.data.basic.credential,
          taxonomies: result.data.taxonomies,
          status: result.data.basic.status,
        },
      })
    }

    return NextResponse.json({
      valid: false,
      error: result.error || 'NPI not found',
    })
  }

  return NextResponse.json(
    { error: 'No verification method specified' },
    { status: 400 }
  )
}
