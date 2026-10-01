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
      <h4 className="text-sm font-semibold text-[#111827]">{title}</h4>
      <ul className="mt-4 space-y-2.5 text-sm text-[#6b7280]">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="transition hover:text-[#111827]">
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
    <footer className="border-t border-[#e5e7eb] bg-white py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-bold text-white">
                S
              </div>
              <span className="text-lg font-bold text-[#111827]">
                Sanus<span className="text-[#1dbf73]">.</span>
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
              Health expertise, on demand. For individuals, businesses, and
              healthcare organizations.
            </p>
          </div>

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
              { label: 'Post a project', href: '/signup?as=organization' },
              { label: 'Organization pricing', href: '/for-organizations#pricing' },
              { label: 'How it works', href: '/how-it-works' },
            ]}
          />

          <FooterColumn
            title="For professionals"
            links={[
              { label: 'Why Sanus', href: '/for-professionals' },
              { label: 'List your services', href: '/signup?as=professional' },
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

        <div className="mt-12 border-t border-[#e5e7eb] pt-6 text-center text-sm text-[#6b7280]">
          &copy; {new Date().getFullYear()} Sanus. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
