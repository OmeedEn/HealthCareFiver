'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUser, requireRole } from '@/lib/auth/roles'
import { isDemoMode } from '@/lib/demo/data'
import { isValidNpiFormat } from '@/lib/integrations/npi-registry'
import { normalizeUsPhone, PHONE_ERROR } from '@/lib/phone'
import { normalizeLanguages } from '@/lib/profile/languages'
import { US_STATES } from '@/lib/utils/constants'
import { normalizeWebsiteUrl } from '@/lib/onboarding/questions/professional'
import { recordProgress } from '@/lib/onboarding/progress'
import { isProFinishItem } from '@/lib/onboarding/checklist-professional'
import type { ActionResult } from '@/app/onboarding/professional/shared'

/*
 * Saves for the dashboard's Finish your profile single-question screens
 * (/dashboard/finish/professional/[item]). Each writes only the caller's own
 * contractor_profiles row (or profiles.phone). Upload items use the
 * onboarding recordDocument action instead.
 */

const STATE_CODES = new Set(US_STATES.map((s) => s.value))
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const bad = (error: string): ActionResult => ({ ok: false, error })

export async function saveFinishItem(item: string, value: Record<string, unknown>): Promise<ActionResult> {
  if (!isProFinishItem(item)) return bad('Unknown item.')
  let user
  try {
    user = requireRole(await currentUser(), 'contractor')
  } catch {
    return bad('Your session has expired. Please sign in again.')
  }

  let columns: Record<string, unknown> | null = null
  let phone: string | null = null

  switch (item) {
    case 'years': {
      const n = Number(str(value.years))
      if (!/^\d{1,2}$/.test(str(value.years)) || n > 70) return bad('Enter a whole number of years between 0 and 70.')
      columns = { years_of_experience: n }
      break
    }
    case 'specialty': {
      const list = Array.isArray(value.specialties) ? value.specialties.map(str).filter(Boolean) : []
      const unique = [...new Set(list)].map((s) => s.slice(0, 100)).slice(0, 10)
      if (!unique.length) return bad('Add at least one specialty.')
      columns = { specialties: unique }
      break
    }
    case 'npi': {
      const npi = str(value.npi).replace(/\D/g, '')
      if (!isValidNpiFormat(npi)) return bad('Enter a valid 10-digit NPI number.')
      columns = { npi_number: npi }
      break
    }
    case 'license_dates': {
      const issue = str(value.issue)
      const expires = str(value.expires)
      if (!isRealDate(issue) || !isRealDate(expires)) return bad('Enter both dates.')
      if (expires <= issue) return bad('The expiration date must be after the issue date.')
      columns = { license_issue_date: issue, license_expiration_date: expires }
      break
    }
    case 'other_names': {
      // '' = "I haven't used other names" (answered).
      const names = value.none === true ? '' : str(value.names)
      if (value.none !== true && !names) return bad('Enter the names, or choose “I haven’t used other names”.')
      if (names.length > 300) return bad('Keep this under 300 characters.')
      columns = { other_names: names }
      break
    }
    case 'states': {
      const states = Array.isArray(value.states) ? [...new Set(value.states.map(str))] : []
      if (!states.length || states.length > 60 || !states.every((s) => STATE_CODES.has(s))) {
        return bad('Choose at least one state.')
      }
      columns = { telehealth_states: states }
      if (value.compact === 'yes' || value.compact === 'no') columns.has_compact_license = value.compact === 'yes'
      break
    }
    case 'languages': {
      const langs = normalizeLanguages(Array.isArray(value.languages) ? value.languages.map(str) : [])
      if (!langs.length) return bad('Add at least one language.')
      columns = { languages: langs }
      break
    }
    case 'phone': {
      phone = normalizeUsPhone(str(value.phone))
      if (!phone) return bad(`${PHONE_ERROR}.`)
      break
    }
    case 'website': {
      const url = normalizeWebsiteUrl(str(value.website))
      if (!url) return bad('Enter a link like linkedin.com/in/yourname.')
      columns = { website_url: url }
      break
    }
    default:
      return bad('Upload this from the upload screen.')
  }

  if (isDemoMode()) return { ok: true }
  const supabase = await createClient()
  const { error } = phone
    ? await supabase.from('profiles').update({ phone }).eq('id', user.id)
    : await supabase.from('contractor_profiles').update(columns!).eq('id', user.id)
  if (error) {
    console.error('[finish/professional] save failed', { item, code: error.code })
    return bad('We couldn’t save that. Please try again.')
  }
  if (item === 'website') await recordProgress(supabase, user.id, 'professional', { answered: ['website'] })
  revalidatePath('/dashboard')
  return { ok: true }
}
