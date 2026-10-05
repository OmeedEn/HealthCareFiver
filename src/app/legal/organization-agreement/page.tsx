import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'
import { ORG_AGREEMENT_VERSION } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Organization Agreement (Draft) — Sanus',
  description: 'Draft Organization Agreement for organizations on Sanus. Pending legal review.',
}

const linkClass = 'text-[#0f8f56] underline'

const sections: LegalSection[] = [
  {
    id: 'parties',
    title: 'Parties and acceptance',
    body: (
      <>
        <p>
          This Organization Agreement (the &ldquo;Agreement&rdquo;) is between [Sanus legal entity
          name], a [state] [entity type] (&ldquo;Sanus&rdquo;), and the organization you represent
          (&ldquo;you&rdquo; or the &ldquo;Organization&rdquo;).
        </p>
        <p>
          You accept this Agreement on the Organization&apos;s behalf by checking the agreement box in
          your Sanus account, and you confirm you&apos;re authorized to do so. It supplements our{' '}
          <Link href="/terms" className={linkClass}>Terms of Service</Link> and{' '}
          <Link href="/privacy" className={linkClass}>Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'not-employer',
    title: 'Sanus connects; it is not the employer or an agency',
    body: (
      <>
        <p>
          Sanus is a marketplace that connects organizations and professionals. Sanus is not the
          employer of any professional, is not a staffing agency, employment agency, or nurse
          registry, and does not handle pay, scheduling, supervision, or employment for
          opportunities you post.
        </p>
        <p>
          You and any professional you engage arrange those terms directly. You are responsible for
          correctly classifying workers (including under California&apos;s ABC test), complying with
          wage, hour, and pay-transparency laws, and any licensing, background-check, or
          credentialing requirements that apply to you. [Counsel to confirm scope given employment
          agency and nurse registry rules.]
        </p>
      </>
    ),
  },
  {
    id: 'accuracy',
    title: 'Accurate information and verification',
    body: (
      <ul>
        <li>The information you gave during signup and verification is accurate, and you&apos;ll keep it current.</li>
        <li>You authorize Sanus to verify it and to run exclusion screenings (OIG, SAM.gov) on the Organization, now and periodically.</li>
        <li>Sanus may suspend or remove the Organization if information is inaccurate or a screening finds an exclusion.</li>
      </ul>
    ),
  },
  {
    id: 'listings',
    title: 'Listings, events, and posts',
    body: (
      <ul>
        <li>Every listing, event, and staffing post is reviewed before it goes live, and edits send it back for review.</li>
        <li>Listings must be truthful. No &ldquo;cure&rdquo; or guaranteed-results claims.</li>
        <li>Paid opportunities must state pay as a rate or range with a unit; unpaid opportunities must be clearly marked volunteer.</li>
        <li>You may not ask applicants to pay or buy anything, or request Social Security numbers or other sensitive personal information up front.</li>
      </ul>
    ),
  },
  {
    id: 'professionals',
    title: 'Contacting professionals',
    body: (
      <ul>
        <li>Inquiries and invitations must relate to a genuine opportunity and include the role, engagement type, and timeline.</li>
        <li>Professionals may decline or turn off inquiries; respect that. Sanus limits how many invitations an organization can send per day.</li>
        <li>Don&apos;t take relationships started on Sanus off the platform to avoid fees. [Non-circumvention terms — pending counsel.]</li>
      </ul>
    ),
  },
  {
    id: 'payments',
    title: 'Payments',
    body: (
      <p>
        If you publish a paid service or event, you&apos;ll set up payouts through Stripe Connect
        before it goes live. A small service fee applies to each paid booking; you&apos;ll see the
        exact amount before you publish. [Fee terms — pending.]
      </p>
    ),
  },
  {
    id: 'phi',
    title: 'Health information',
    body: (
      <p>
        Don&apos;t post protected health information in listings, posts, or messages. [Business
        Associate terms, where applicable — pending counsel.]
      </p>
    ),
  },
  {
    id: 'general',
    title: 'Term, changes, and general terms',
    body: (
      <>
        <p>
          Either party may end this Agreement at any time by closing the account. We may update this
          Agreement; we&apos;ll ask you to accept material changes. Current version:{' '}
          <strong>{ORG_AGREEMENT_VERSION}</strong>.
        </p>
        <p>
          [Governing law, venue, dispute resolution, limitation of liability, indemnity, notices,
          assignment, severability, and entire-agreement clauses — pending counsel.]
        </p>
      </>
    ),
  },
]

export default function OrganizationAgreementPage() {
  return (
    <LegalPage
      title="Organization Agreement"
      lastUpdated="October 5, 2026"
      intro={
        <p>
          This Agreement explains how organizations work with Sanus: Sanus connects you with
          professionals and reviews what you publish, and you remain responsible for your own hiring,
          pay, and compliance.
        </p>
      }
      sections={sections}
    />
  )
}
