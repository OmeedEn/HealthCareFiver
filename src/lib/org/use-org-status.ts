'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { isOrgStatus, type OrgStatus } from './review'

/**
 * The signed-in organization's verification status, for disabling actions in
 * the UI. `undefined` while loading, `null` if the user isn't an organization.
 * The database enforces the same rules; this only explains them up front.
 */
export function useOrgStatus(): OrgStatus | null | undefined {
  const [status, setStatus] = useState<OrgStatus | null | undefined>(
    isDemoMode() ? 'approved' : undefined
  )

  useEffect(() => {
    if (isDemoMode()) return
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setStatus(null)
        return
      }
      const { data } = await supabase
        .from('facility_profiles')
        .select('verification_status')
        .eq('id', user.id)
        .maybeSingle()
      if (!cancelled) {
        setStatus(isOrgStatus(data?.verification_status) ? data.verification_status : null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
