import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageIntro } from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'Host an event — Sanus',
  description: 'Host a webinar, workshop, course, or training on Sanus as an individual educator or an organization.',
}

/**
 * "Host an event": the one destination for every host CTA. Public (under
 * /events-and-training), so signed-out visitors get a choice of signup path
 * and signed-in hosts go straight to their own event editor. (/signup itself
 * redirects signed-in users to their landing page, so it can't be the target.)
 */
export default async function HostEventPage() {
  let role: string | null = null
  try {
    const { currentUser } = await import('@/lib/auth/roles')
    role = (await currentUser())?.role ?? null
  } catch {
    role = null
  }
  if (role === 'contractor') redirect('/contractor/listings/new?kind=event')
  if (role === 'facility') redirect('/facility/listings?new=event')
  if (role === 'admin') redirect('/admin/review/org-listings')

  const signedInOther = role !== null
  return (
    <>
      <PageIntro
        kicker="Host an event"
        title="Host an event or training on Sanus"
        description="Webinars, workshops, courses, and certification prep. Every host is reviewed before their events can be published, and each event is reviewed before it goes live."
      />
      <section className="bg-paper py-12 sm:py-16">
        <div className="mx-auto grid w-full max-w-[90rem] gap-4 px-4 sm:px-6 md:grid-cols-2 lg:px-10">
          {signedInOther ? (
            <p className="text-sm text-ink-muted md:col-span-2">
              Your account type can&apos;t host events. Hosting is for professionals and organizations; you can still{' '}
              <Link href="/events" className="font-semibold text-ink underline">
                browse and register for events
              </Link>
              .
            </p>
          ) : (
            <>
              <HostOption
                title="I'm an individual educator or professional"
                body="Create a professional account, finish review, then add your event as a listing."
                href="/signup?start=independent"
                cta="Sign up as a professional"
              />
              <HostOption
                title="We're an organization"
                body="Create an organization account, finish verification, then add events from Services & events."
                href="/signup?start=company"
                cta="Sign up as an organization"
              />
              <p className="text-sm text-ink-muted md:col-span-2">
                Already have an account?{' '}
                <Link href="/login?redirectTo=/events-and-training/host" className="font-semibold text-ink underline">
                  Sign in
                </Link>{' '}
                and you&apos;ll go straight to your event editor.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  )
}

function HostOption({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-surface p-6 ring-1 ring-line">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
      <Link
        href={href}
        className="mt-6 inline-flex h-11 w-fit items-center rounded-lg bg-ink px-5 text-sm font-semibold text-paper transition hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  )
}
