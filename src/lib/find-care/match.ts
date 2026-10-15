import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClientInterestKey } from '@/lib/onboarding/client-interests'
import { normalizeClientInterests } from '@/lib/onboarding/client-interests'
import { getLiveProviders, getReadClient } from './providers'
import { MAX_MATCHES, type MatchedProvider } from './match-shared'
import type { ProfessionalCategory, PublicProvider } from './types'
import { stateForZip } from './zip-state'

/*
 * Client results screen matcher (Single-Question Onboarding, client screen 5).
 * Deliberately simple and explainable, on top of getLiveProviders() (only
 * live, approved, no-hold professionals):
 *
 * 1. Interest → professional. Each of the 11 tiles maps to professional
 *    categories, contractor_type / license codes, listing kinds, and
 *    keywords searched in specialties, headline, profession and published
 *    listing titles. A professional must match at least one picked tile
 *    ("Not sure yet" matches everyone, weakly).
 * 2. Format. Formats come from their published listings
 *    (professional_offerings.format). If the client picked formats (not
 *    "No preference") and the professional's known formats don't overlap,
 *    they're out; no listings with a format = unknown, kept unranked.
 * 3. State. The ZIP's state (zip-state.ts, no geocoding). In-person / home
 *    visit only → a professional in another state is out; otherwise same
 *    state ranks higher. No ZIP → location is skipped.
 *
 * Ranked by score (interest strength, format overlap, same state, then
 * available, insured, rating) and capped at MAX_MATCHES.
 */

type Rule = {
  categories?: ProfessionalCategory[]
  /** contractor_type enum values. */
  types?: string[]
  /** contractor_profiles.license_type codes, compared uppercased without dots/spaces. */
  licenses?: string[]
  /** professional_offerings.kind values. */
  kinds?: string[]
  /** Lowercase substrings searched in the professional's text. */
  terms: string[]
}

export const INTEREST_RULES: Record<Exclude<ClientInterestKey, 'not_sure'>, Rule> = {
  clinical: {
    categories: ['clinical'],
    types: ['md', 'do', 'np', 'pa', 'rn', 'lpn'],
    terms: ['primary care', 'telehealth', 'urgent care', 'family medicine', 'internal medicine', 'nurse practitioner'],
  },
  mental_health: {
    types: ['sw'],
    licenses: ['LCSW', 'LMSW', 'LMFT', 'LPC', 'LPCC', 'LMHC', 'PSYD', 'PSYCHOLOGIST', 'PMHNP'],
    terms: ['mental health', 'counsel', 'psychotherap', 'psycholog', 'psychiatr', 'anxiety', 'depression', 'trauma', 'grief'],
  },
  nutrition: {
    licenses: ['RD', 'RDN', 'LD', 'LDN', 'CNS'],
    terms: ['nutrition', 'dietit', 'dietetic', 'meal plan', 'weight management'],
  },
  coaching: {
    terms: ['coach', 'wellness', 'lifestyle', 'longevity', 'behavior change', 'habit'],
  },
  physical_therapy: {
    types: ['pt', 'ot', 'slp'],
    licenses: ['PT', 'DPT', 'PTA', 'OT', 'OTR', 'OTRL', 'COTA', 'SLP'],
    terms: ['physical therap', 'occupational therap', 'rehab', 'orthoped', 'sports medicine', 'injury'],
  },
  fitness: {
    terms: ['personal train', 'fitness', 'strength', 'conditioning', 'yoga', 'pilates', 'exercise'],
  },
  bodywork: {
    licenses: ['LMT', 'CMT', 'LAC', 'DC'],
    terms: ['massage', 'bodywork', 'acupunct', 'myofascial', 'reflexolog', 'reiki', 'chiropract', 'stretch'],
  },
  birth_family: {
    licenses: ['IBCLC', 'CNM', 'CPM', 'CLC'],
    terms: ['doula', 'lactation', 'breastfeed', 'postpartum', 'prenatal', 'birth', 'midwi', 'newborn', 'fertility', 'pediatric'],
  },
  advice_advocacy: {
    categories: ['consultant'],
    kinds: ['consulting'],
    terms: ['advoca', 'navigat', 'billing', 'insurance', 'legal', 'attorney', 'medicare'],
  },
  events_education: {
    categories: ['educator'],
    kinds: ['event'],
    terms: ['workshop', 'class', 'course', 'support group', 'education', 'continuing ed'],
  },
}

/** Private, server-only facts used for matching. Never sent to the browser. */
export interface MatchExtras {
  licenseType: string | null
  profession: string | null
  /** Published listings visible to the public (malpractice rule applied). */
  offerings: { kind: string; format: string | null; title: string }[]
}

export interface MatchAnswers {
  interests: readonly string[]
  meeting_formats: readonly string[]
  zip_code: string | null
}

const STRONG = 10
const KEYWORD = 6

function code(v: string | null): string {
  return (v ?? '').toUpperCase().replace(/[.\s-]/g, '')
}

function interestScore(p: PublicProvider, x: MatchExtras, haystack: string, rule: Rule): number {
  if (rule.categories && p.professional_category && rule.categories.includes(p.professional_category)) return STRONG
  if (rule.types?.includes(p.contractor_type)) return STRONG
  if (rule.licenses && x.licenseType && rule.licenses.includes(code(x.licenseType))) return STRONG
  if (rule.kinds && x.offerings.some((o) => rule.kinds!.includes(o.kind))) return STRONG
  if (rule.terms.some((t) => haystack.includes(t))) return KEYWORD
  return 0
}

/** Pure ranking step (exported for tests). */
export function rankMatches(
  providers: PublicProvider[],
  extras: Map<string, MatchExtras>,
  answers: MatchAnswers,
  limit = MAX_MATCHES
): MatchedProvider[] {
  const interests = normalizeClientInterests(answers.interests)
  const specific = interests.filter((k): k is Exclude<ClientInterestKey, 'not_sure'> => k !== 'not_sure')
  const anyInterest = interests.includes('not_sure') || interests.length === 0
  const wanted = answers.meeting_formats.filter((f) => f !== 'no_preference')
  const localOnly = wanted.length > 0 && !wanted.includes('virtual')
  const clientState = stateForZip(answers.zip_code)

  const scored: { p: MatchedProvider; score: number }[] = []
  for (const p of providers) {
    const x = extras.get(p.id) ?? { licenseType: null, profession: null, offerings: [] }
    const haystack = [p.specialty, p.headline, ...p.specialties, x.profession ?? '', ...x.offerings.map((o) => o.title)]
      .join(' ')
      .toLowerCase()

    let score = 0
    const matched: string[] = []
    for (const key of specific) {
      const s = interestScore(p, x, haystack, INTEREST_RULES[key])
      if (s) {
        score += s
        matched.push(key)
      }
    }
    if (!matched.length) {
      if (!anyInterest) continue
      score += 1
    }

    const formats = Array.from(new Set(x.offerings.map((o) => o.format).filter((f): f is string => !!f)))
    if (wanted.length && formats.length) {
      const overlap = formats.filter((f) => wanted.includes(f)).length
      if (!overlap) continue
      score += 5
    }

    const sameState = !!clientState && p.state === clientState
    if (clientState && localOnly && p.state && !sameState) continue
    if (sameState) score += localOnly ? 6 : 3

    if (p.is_available) score += 1
    if (p.insured) score += 1
    score += Math.min(5, p.average_rating) * 0.2

    scored.push({ p: { ...p, matched_interests: matched, formats, same_state: sameState }, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || b.p.total_reviews - a.p.total_reviews)
    .slice(0, limit)
    .map((s) => s.p)
}

/** License type, profession and published listings for the given professionals. */
async function loadExtras(
  db: SupabaseClient,
  providers: PublicProvider[]
): Promise<Map<string, MatchExtras>> {
  const out = new Map<string, MatchExtras>()
  const ids = providers.map((p) => p.id)
  if (!ids.length) return out
  const insured = new Map(providers.map((p) => [p.id, p.insured]))

  const [profiles, offerings] = await Promise.all([
    db.from('contractor_profiles').select('id, license_type, other_profession').in('id', ids),
    db
      .from('professional_offerings')
      .select('contractor_id, kind, format, title, requires_malpractice')
      .eq('status', 'published')
      .in('contractor_id', ids),
  ])
  if (profiles.error) console.error('[find-care/match] profiles query failed', { code: profiles.error.code })
  if (offerings.error) console.error('[find-care/match] offerings query failed', { code: offerings.error.code })

  for (const r of (profiles.data ?? []) as Record<string, unknown>[]) {
    out.set(r.id as string, {
      licenseType: typeof r.license_type === 'string' ? r.license_type : null,
      profession: typeof r.other_profession === 'string' ? r.other_profession : null,
      offerings: [],
    })
  }
  for (const o of (offerings.data ?? []) as Record<string, unknown>[]) {
    const id = o.contractor_id as string
    // Same rule as the public listings policy: malpractice-required
    // listings show only for insured professionals.
    if (o.requires_malpractice === true && !insured.get(id)) continue
    const entry = out.get(id) ?? { licenseType: null, profession: null, offerings: [] }
    entry.offerings.push({
      kind: String(o.kind ?? ''),
      format: typeof o.format === 'string' ? o.format : null,
      title: typeof o.title === 'string' ? o.title : '',
    })
    out.set(id, entry)
  }
  return out
}

/** Live professionals ranked for a client's answers (up to MAX_MATCHES). */
export async function findMatches(answers: MatchAnswers): Promise<MatchedProvider[]> {
  const providers = await getLiveProviders()
  if (!providers.length) return []
  try {
    const extras = await loadExtras(await getReadClient(), providers)
    return rankMatches(providers, extras, answers)
  } catch (err) {
    console.error('[find-care/match] failed', err instanceof Error ? err.message : 'unknown')
    return rankMatches(providers, new Map(), answers)
  }
}
