import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service (Draft) — Sanus',
  description:
    'Draft Terms of Service for the Sanus health expertise marketplace. Pending legal review.',
}

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement to these terms',
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to
          and use of the Sanus website, applications, and related services
          (the &ldquo;Platform&rdquo;), operated by [Sanus legal entity name]
          (&ldquo;Sanus,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By
          creating an account or using the Platform you agree to these Terms
          and to our <Link href="/privacy" className="text-[#0f8f56] underline">Privacy Policy</Link>.
          If you do not agree, do not use the Platform.
        </p>
        <p>
          You must be at least 18 years old and able to form a binding
          contract to use the Platform.
        </p>
      </>
    ),
  },
  {
    id: 'marketplace-role',
    title: 'Sanus is a marketplace, not a provider of care',
    body: (
      <>
        <p>
          Sanus is an online marketplace that connects individuals,
          businesses, and healthcare organizations (&ldquo;Clients&rdquo;)
          with independent health professionals, consultants, and educators
          (&ldquo;Professionals&rdquo;).
        </p>
        <ul>
          <li>
            Sanus does not provide medical care, diagnosis, treatment, legal
            advice, or any other professional service, and does not practice
            medicine or any licensed profession.
          </li>
          <li>
            Professionals are independent and are not employees, agents, or
            contractors of Sanus. Each Professional is solely responsible for
            the services they provide, their professional judgment, and
            compliance with the laws and licensing rules that apply to them.
          </li>
          <li>
            Nothing on the Platform establishes a provider–patient
            relationship between you and Sanus.
          </li>
        </ul>
        <p className="font-semibold">
          The Platform is not for emergencies. If you are experiencing a
          medical emergency, call 911 or go to the nearest emergency room.
        </p>
      </>
    ),
  },
  {
    id: 'verification',
    title: 'Professional review and verification',
    body: (
      <>
        <p>
          Professionals submit credentials and other information that Sanus
          reviews before a Professional can be booked. Depending on the type
          of professional, review may include license, identity, and
          background checks performed by Sanus or third-party vendors.
        </p>
        <p>
          Verification reflects information available at the time of review.
          It is not a guarantee or endorsement of any Professional&apos;s
          qualifications, quality of services, or outcomes. Clients remain
          responsible for deciding whether a Professional is right for them.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts and security',
    body: (
      <ul>
        <li>
          You agree to provide accurate information and to keep it current.
        </li>
        <li>
          You are responsible for activity under your account and for
          keeping your credentials secure. Some accounts may be required to
          use multi-factor authentication.
        </li>
        <li>
          Notify us promptly at [support contact] if you suspect
          unauthorized access to your account.
        </li>
      </ul>
    ),
  },
  {
    id: 'payments',
    title: 'Bookings, fees, and payments',
    body: (
      <>
        <p>
          Payments on the Platform are processed by Stripe, Inc. and its
          affiliates (&ldquo;Stripe&rdquo;). Sanus does not store full card
          numbers. By making or receiving payments you also agree to
          Stripe&apos;s applicable terms, including the Stripe Connected
          Account Agreement for Professionals.
        </p>
        <ul>
          <li>
            Professionals set their own rates. Sanus may charge Clients and/or
            Professionals a platform fee or commission, disclosed before you
            pay.
          </li>
          <li>
            Professionals may need an active paid subscription to be listed
            and bookable. Subscription pricing, billing cycle, trial terms,
            and cancellation are shown at checkout.
          </li>
          <li>
            Payouts to Professionals are made through Stripe on Stripe&apos;s
            payout schedule, less applicable fees.
          </li>
          <li>
            Cancellation, refund, and dispute terms: [to be finalized].
          </li>
          <li>
            Professionals are responsible for their own taxes. Clients are
            responsible for confirming whether any service is eligible for
            insurance reimbursement; Sanus does not bill insurance.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'conduct',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Provide false information or impersonate anyone.</li>
          <li>
            Misrepresent credentials, licenses, or qualifications, or offer
            services you are not legally permitted to provide.
          </li>
          <li>
            Circumvent the Platform to avoid fees for engagements that began
            on Sanus.
          </li>
          <li>
            Harass others, post unlawful content, or upload malware, or
            interfere with the Platform&apos;s security or operation.
          </li>
          <li>
            Share another person&apos;s health information without
            authorization.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'health-info',
    title: 'Health information',
    body: (
      <p>
        Some services on the Platform may involve protected health
        information (&ldquo;PHI&rdquo;). How Sanus collects, uses, and
        safeguards health information — including when Sanus acts as a
        business associate under HIPAA — is described in our{' '}
        <Link href="/privacy" className="text-[#0f8f56] underline">
          Privacy Policy
        </Link>
        . Professionals who are HIPAA covered entities remain responsible for
        their own HIPAA obligations, including providing their own Notice of
        Privacy Practices.
      </p>
    ),
  },
  {
    id: 'reviews-content',
    title: 'Reviews and user content',
    body: (
      <p>
        You retain ownership of content you submit, and grant Sanus a
        limited license to host and display it to operate the Platform.
        Reviews must reflect genuine experiences from a completed
        engagement. Sanus may remove content that violates these Terms.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <p>
        You may close your account at any time. Sanus may suspend or
        terminate accounts that violate these Terms, pose risk to other
        users, or where a Professional&apos;s verification lapses or is
        revoked. Certain records may be retained after closure as described
        in the Privacy Policy.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers and limitation of liability',
    body: (
      <>
        <p>
          The Platform is provided &ldquo;as is&rdquo; and &ldquo;as
          available.&rdquo; To the fullest extent permitted by law, Sanus
          disclaims all warranties, express or implied, and is not liable for
          the acts or omissions of Professionals or Clients.
        </p>
        <p>
          [Limitation of liability cap, indemnification, governing law,
          venue, and dispute resolution / arbitration terms — to be drafted
          by counsel.]
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these Terms. If changes are material, we will notify
        you by email or in-product notice before they take effect. Continued
        use after the effective date means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these Terms: [legal contact email], [Sanus legal
        entity name], [mailing address].
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="[Draft — not yet effective]"
      intro={
        <p>
          Please read these Terms carefully. They explain Sanus&apos;s role as
          a marketplace, what we expect from Clients and Professionals, and
          how payments work.
        </p>
      }
      sections={sections}
    />
  )
}
