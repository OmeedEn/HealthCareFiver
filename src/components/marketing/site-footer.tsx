import { EmergencyNotice } from '@/components/emergency-notice'
import Link from 'next/link'

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="underline decoration-transparent underline-offset-4 transition hover:text-ink hover:decoration-line-strong"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Public marketing footer shared by the homepage and every marketing page. */
export function SiteFooter() {
  return (
    <footer className="bg-paper text-ink">
      <div className="mx-auto w-full max-w-[90rem] px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:px-10">
        <div className="grid gap-12 border-t-2 border-ink pt-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          <div className="sm:col-span-2 lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Sanus home">
              <span className="flex size-8 items-center justify-center rounded-md bg-ink font-display text-sm font-bold text-paper">
                S
              </span>
              <span className="font-display text-xl font-bold tracking-tight">
                Sanus<span className="text-brand">.</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[32ch] text-sm leading-relaxed text-ink-muted">
              Health expertise, on demand. For individuals, businesses, and
              healthcare organizations.
            </p>
          </div>

          <div className="grid gap-10 sm:col-span-2 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
            <FooterColumn
              title="For individuals"
              links={[
                { label: 'Find a professional', href: '/find-care' },
                { label: 'Events & training', href: '/events-and-training' },
                { label: 'How it works', href: '/how-it-works' },
                { label: 'Pricing', href: '/how-it-works#pricing' },
              ]}
            />

            <FooterColumn
              title="For businesses & organizations"
              links={[
                { label: 'Hire expertise', href: '/for-organizations' },
                { label: 'Post a project', href: '/signup/organization?source=HIRING' },
                { label: 'Organization pricing', href: '/for-organizations#pricing' },
                { label: 'How it works', href: '/how-it-works' },
              ]}
            />

            <FooterColumn
              title="For professionals"
              links={[
                { label: 'Why Sanus', href: '/for-professionals' },
                { label: 'List your services', href: '/signup/offer' },
                { label: 'Host an event', href: '/events-and-training' },
                { label: 'Professional pricing', href: '/for-professionals#pricing' },
              ]}
            />

            <FooterColumn
              title="Platform"
              links={[
                { label: 'Trust & safety', href: '/how-it-works#trust' },
                { label: 'HIPAA safeguards', href: '/how-it-works#trust' },
                { label: 'About Sanus', href: '/' },
                { label: 'Sign in', href: '/login' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
              ]}
            />
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-muted sm:flex-row sm:items-start sm:justify-between">
          <EmergencyNotice variant="inline" />
          <p className="shrink-0">&copy; {new Date().getFullYear()} Sanus. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
