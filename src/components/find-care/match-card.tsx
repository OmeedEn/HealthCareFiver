import Link from 'next/link'
import { MapPin, ShieldCheck, Star, Tag } from 'lucide-react'
import { CLIENT_INTEREST_LABELS } from '@/lib/onboarding/client-interests'
import { FORMAT_LABELS, type MatchedProvider } from '@/lib/find-care/match-shared'

const AVATAR_PALETTE = [
  'bg-rose-100 text-rose-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-emerald-100 text-emerald-700',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

/**
 * A professional on the client results screen. Same look as the /find-care
 * cards (that component isn't exported), plus why they matched: the tiles
 * they fit, the formats they offer, and "Near you" for the same state.
 */
export function MatchCard({ provider: p }: { provider: MatchedProvider }) {
  const initials = `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase() || '?'
  const location = [p.city, p.state].filter(Boolean).join(', ')

  return (
    <article className="flex flex-col rounded-2xl border border-[#e3dfd6] bg-white p-5 transition hover:shadow-md">
      <div className="flex items-start gap-3.5">
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase storage host
          <img src={p.avatar_url} alt="" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-full text-base font-bold ${avatarColor(p.id)}`}
            aria-hidden
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-base font-semibold text-[#1a1a17]">
              {p.first_name} {p.last_name}
            </h3>
            <span className="rounded-full bg-[#eceefe] px-2 py-0.5 text-xs font-semibold text-[#1a1a17]">
              {p.credential}
            </span>
            {p.insured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eceefe] px-2 py-0.5 text-xs font-semibold text-[#2330c8]">
                <ShieldCheck className="size-3" aria-hidden />
                Insured
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-[#5f5d57]">{p.specialty}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-[#5f5d57]">
            {p.total_reviews > 0 ? (
              <>
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                <span className="font-semibold text-[#1a1a17]">{p.average_rating.toFixed(1)}</span>({p.total_reviews})
              </>
            ) : (
              'New on Sanus'
            )}
          </p>
        </div>
      </div>

      {p.headline && <p className="mt-3 line-clamp-2 text-sm text-[#3a3934]">{p.headline}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.matched_interests.map((k) => (
          <span key={k} className="rounded-md bg-[#eceefe] px-2 py-0.5 text-xs font-medium text-[#2330c8]">
            {CLIENT_INTEREST_LABELS[k] ?? k}
          </span>
        ))}
        {p.formats.map((f) => (
          <span key={f} className="rounded-md bg-[#eeebe4] px-2 py-0.5 text-xs text-[#3a3934]">
            {FORMAT_LABELS[f] ?? f}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {/* Prices live on the full profile only, never on browse cards. */}
        <span className="flex items-center gap-1 font-medium text-[#2330c8]">
          <Tag className="size-3.5" aria-hidden />
          Rates on profile
        </span>
        {location && (
          <span className="flex items-center gap-1 text-[#5f5d57]">
            <MapPin className="size-3.5" aria-hidden />
            {location}
            {p.same_state && <span className="font-medium text-[#2330c8]">· Near you</span>}
          </span>
        )}
      </div>

      <Link
        href={`/pros/${p.id}`}
        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#2f3cf5] text-sm font-semibold text-[#2f3cf5] transition hover:bg-[#2f3cf5] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f3cf5]"
      >
        View profile
      </Link>
    </article>
  )
}
