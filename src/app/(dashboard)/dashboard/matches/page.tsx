import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/server'
import { EmergencyNotice } from '@/components/emergency-notice'
import { MatchCard } from '@/components/find-care/match-card'
import { findMatches, rankMatches } from '@/lib/find-care/match'
import { getDemoProviders } from '@/lib/find-care/providers'
import { MIN_MATCHES, type MatchedProvider } from '@/lib/find-care/match-shared'
import { loadClientProfile } from '@/lib/onboarding/client-profile'
import {
  CLIENT_INTEREST_LABELS,
  HELP_TIMELINES,
  MEETING_FORMATS,
} from '@/lib/onboarding/client-interests'
import { CLIENT_RESULTS_TITLE } from '@/lib/onboarding/questions/client'
import { RequestHelpForm } from './request-help-form'

export const metadata: Metadata = { title: 'Your matches — Sanus' }
export const dynamic = 'force-dynamic'

/**
 * Client results (Single-Question Onboarding, client screen 5): right after
 * signup, and from the dashboard. Matches come from src/lib/find-care/match.ts;
 * fewer than 3 → a fallback and "Request help finding someone".
 */
export default async function ClientMatchesPage() {
  let matches: MatchedProvider[]
  let summary: string[] = []
  let alreadyRequested = false

  if (isDemoMode()) {
    matches = rankMatches(getDemoProviders(), new Map(), {
      interests: ['clinical'],
      meeting_formats: [],
      zip_code: null,
    })
  } else {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login?redirectTo=/dashboard/matches')

    const { data: role } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (role?.role !== 'client') redirect('/dashboard')

    const profile = await loadClientProfile(supabase, user.id)
    if (!profile) redirect('/dashboard')

    const [found, open] = await Promise.all([
      findMatches({
        interests: profile.interests,
        meeting_formats: profile.meeting_formats,
        zip_code: profile.zip_code,
      }),
      // Errors (e.g. table not migrated yet) just mean "not requested".
      supabase.from('care_requests').select('id').eq('user_id', user.id).eq('status', 'open').limit(1),
    ])
    matches = found
    alreadyRequested = !open.error && (open.data?.length ?? 0) > 0

    const timeline = HELP_TIMELINES.find((t) => t.value === profile.help_timeline)?.label
    const formats = profile.meeting_formats
      .filter((f) => f !== 'no_preference')
      .map((f) => MEETING_FORMATS.find((m) => m.value === f)?.label ?? f)
    summary = [
      ...profile.interests.filter((k) => k !== 'not_sure').map((k) => CLIENT_INTEREST_LABELS[k] ?? k),
      ...formats,
      ...(timeline ? [timeline] : []),
      ...(profile.zip_code ? [`Near ${profile.zip_code}`] : []),
    ]
  }

  const enough = matches.length >= MIN_MATCHES

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#404145] sm:text-[2rem] sm:leading-tight">
          {CLIENT_RESULTS_TITLE}
        </h1>
        {summary.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {summary.map((s) => (
              <span key={s} className="rounded-full border border-[#e4e5e7] bg-white px-2.5 py-0.5 text-xs text-[#62646a]">
                {s}
              </span>
            ))}
            <Link href="/settings#preferences" className="ml-1 text-xs font-semibold text-[#1dbf73] hover:underline">
              Edit
            </Link>
          </div>
        )}
      </div>

      {matches.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((p) => (
            <MatchCard key={p.id} provider={p} />
          ))}
        </div>
      )}

      {!enough && (
        <section
          aria-labelledby="fallback-title"
          className="rounded-xl border border-[#e4e5e7] bg-white p-5 sm:p-6"
        >
          <h2 id="fallback-title" className="text-base font-semibold text-[#404145]">
            {matches.length === 0
              ? 'We don’t have a match for you yet'
              : 'We only found a few matches so far'}
          </h2>
          <p className="mt-1 text-sm text-[#62646a]">
            Sanus is still growing. Tell us you&apos;d like help and our team will look for someone who fits
            what you&apos;re looking for.
          </p>
          <div className="mt-4">
            <RequestHelpForm alreadyRequested={alreadyRequested} />
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Link
          href="/find-care"
          className="inline-flex items-center gap-1.5 font-semibold text-[#1dbf73] hover:underline"
        >
          <Search className="size-4" aria-hidden />
          Browse all professionals
        </Link>
        <Link href="/dashboard" className="font-semibold text-[#62646a] hover:text-[#404145]">
          Go to dashboard
        </Link>
      </div>

      <EmergencyNotice />
    </div>
  )
}
