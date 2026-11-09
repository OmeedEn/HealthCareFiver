import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export type LegalSection = {
  id: string
  title: string
  body: React.ReactNode
}

/**
 * Shared shell for /terms and /privacy. Both documents are DRAFTS pending
 * legal review — the banner is intentionally prominent and must stay until
 * counsel signs off on final text.
 */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string
  lastUpdated: string
  intro: React.ReactNode
  sections: LegalSection[]
}) {
  return (
    <div className="min-h-screen bg-[#f6f4ef] text-[#1a1a17]">
      <header className="border-b border-[#e3dfd6] bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f3cf5] text-sm font-bold text-white">
              S
            </div>
            <span className="text-xl font-bold tracking-tight text-[#1a1a17]">
              Sanus<span className="text-[#2f3cf5]">.</span>
            </span>
          </Link>
          <nav className="flex gap-5 text-sm font-medium text-[#5f5d57]">
            <Link href="/terms" className="transition hover:text-[#1a1a17]">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-[#1a1a17]">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold uppercase tracking-wide">
              Draft — pending legal review
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              This document is a working draft and has not been reviewed or
              approved by counsel. It is not final and may change materially
              before Sanus launches publicly. Bracketed items are placeholders.
            </p>
          </div>
        </div>

        <h1 className="mt-8 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#5f5d57]">Last updated: {lastUpdated}</p>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#3a3934]">
          {intro}
        </div>

        <nav
          aria-label="Contents"
          className="mt-8 rounded-xl border border-[#e3dfd6] bg-white p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5f5d57]">
            Contents
          </p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-[#2330c8] transition hover:text-[#1a1a17] hover:underline"
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="text-xl font-semibold text-[#1a1a17]">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#3a3934] [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-[#e3dfd6] bg-white py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-2 px-4 text-sm text-[#5f5d57] sm:flex-row sm:gap-4 sm:px-6">
          <span>&copy; {new Date().getFullYear()} Sanus. All rights reserved.</span>
          <span className="flex gap-4">
            <Link href="/terms" className="transition hover:text-[#1a1a17]">
              Terms of Service
            </Link>
            <Link href="/privacy" className="transition hover:text-[#1a1a17]">
              Privacy Policy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
