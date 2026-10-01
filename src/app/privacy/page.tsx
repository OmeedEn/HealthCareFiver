import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy (Draft) — Sanus',
  description:
    'Draft Privacy Policy for the Sanus health expertise marketplace, including how health information is handled. Pending legal review.',
}

const sections: LegalSection[] = [
  {
    id: 'scope',
    title: 'Scope and who we are',
    body: (
      <>
        <p>
          This Privacy Policy explains how [Sanus legal entity name]
          (&ldquo;Sanus,&rdquo; &ldquo;we&rdquo;) collects, uses, shares, and
          protects personal information when you use the Sanus marketplace
          (the &ldquo;Platform&rdquo;). It applies to Clients (individuals,
          businesses, and healthcare organizations) and Professionals.
        </p>
        <p>
          Sanus is a marketplace and does not itself provide medical care.
          See our{' '}
          <Link href="/terms" className="text-[#0f8f56] underline">
            Terms of Service
          </Link>{' '}
          for more on our role.
        </p>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'Information we collect',
    body: (
      <ul>
        <li>
          <strong>Account information:</strong> name, email, phone number,
          role, password (stored hashed by our authentication provider), and
          multi-factor authentication settings.
        </li>
        <li>
          <strong>Professional information:</strong> credentials, license
          and NPI details, specialties, rates, location (city/state),
          profile content, and documents submitted for verification.
        </li>
        <li>
          <strong>Verification results:</strong> outcomes of identity,
          license, and background checks returned by our vendors.
        </li>
        <li>
          <strong>Transaction information:</strong> bookings, contracts,
          invoices, and payout records. Card and bank details are collected
          and stored by Stripe, not by Sanus.
        </li>
        <li>
          <strong>Communications:</strong> messages sent through the
          Platform and support requests.
        </li>
        <li>
          <strong>Health information:</strong> information you choose to
          share with a Professional (for example in messages or intake
          details) that may constitute protected health information
          (&ldquo;PHI&rdquo;). See section 4.
        </li>
        <li>
          <strong>Usage and device data:</strong> log data, IP address,
          browser type, and product analytics events; error diagnostics.
        </li>
      </ul>
    ),
  },
  {
    id: 'use',
    title: 'How we use information',
    body: (
      <ul>
        <li>To create and operate accounts and the marketplace.</li>
        <li>
          To review and verify Professionals before they can be booked.
        </li>
        <li>To process payments, booking service fees, and payouts via Stripe.</li>
        <li>
          To send transactional emails (account, verification, booking, and
          security notices).
        </li>
        <li>
          To secure the Platform, prevent fraud, maintain audit logs, and
          comply with legal obligations.
        </li>
        <li>To understand and improve the Platform.</li>
      </ul>
    ),
  },
  {
    id: 'hipaa',
    title: 'Health information and HIPAA',
    body: (
      <>
        <p>
          When a Professional who is a HIPAA covered entity uses Sanus to
          deliver services, Sanus may act as that Professional&apos;s
          business associate and will handle PHI only as permitted by a
          business associate agreement (&ldquo;BAA&rdquo;) and HIPAA.
        </p>
        <ul>
          <li>
            We use PHI only to provide the Platform&apos;s services — never
            to sell it or for advertising.
          </li>
          <li>
            Access to PHI is limited to authorized personnel with a need to
            know, and access is recorded in audit logs.
          </li>
          <li>
            We apply administrative, technical, and physical safeguards,
            including encryption in transit and at rest, role-based access
            controls, and multi-factor authentication for privileged
            accounts.
          </li>
          <li>
            We notify affected parties of breaches of unsecured PHI as
            required by law.
          </li>
        </ul>
        <p>
          <strong>Notice of Privacy Practices:</strong> Covered entities
          (such as licensed clinicians on the Platform) are responsible for
          providing their own Notice of Privacy Practices describing how they
          use and disclose your PHI and your rights under HIPAA. Ask your
          Professional for a copy. Sanus&apos;s own Notice of Privacy
          Practices, if required for any service Sanus offers directly, will
          be published here: [to be determined by counsel].
        </p>
        <p>
          Some information you share — for example with a non-clinical
          Professional such as a coach or consultant — may not be PHI under
          HIPAA. We still protect it as described in this policy.
        </p>
      </>
    ),
  },
  {
    id: 'share',
    title: 'How we share information',
    body: (
      <>
        <p>We do not sell personal information. We share it only:</p>
        <ul>
          <li>
            <strong>Between Clients and Professionals</strong> as needed to
            facilitate an engagement you initiate.
          </li>
          <li>
            <strong>Publicly, for Professionals:</strong> profile details
            such as name, credentials, specialties, city/state, rates, bio,
            photo, and ratings. Contact details, license numbers, and
            verification documents are not shown publicly.
          </li>
          <li>
            <strong>With service providers</strong> who process data on our
            behalf under contract — for example hosting and database
            (Supabase, Vercel), payments and identity checks (Stripe),
            credential and background screening vendors, email delivery,
            error monitoring, and product analytics. Vendors that handle PHI
            sign a BAA.
          </li>
          <li>
            <strong>For legal reasons:</strong> to comply with law, respond to
            lawful requests, or protect rights and safety.
          </li>
          <li>
            <strong>In a business transfer</strong> such as a merger or
            acquisition, subject to this policy.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Data retention',
    body: (
      <ul>
        <li>
          Account and profile data is kept while your account is active and
          for a limited period after closure, unless a longer period is
          required by law.
        </li>
        <li>
          Security and HIPAA audit logs are retained for six (6) years, in
          line with HIPAA documentation requirements.
        </li>
        <li>
          Transaction and tax records are retained as required by financial
          and tax law.
        </li>
        <li>
          Verification documents: [retention period to be confirmed].
        </li>
      </ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your choices and rights',
    body: (
      <>
        <p>
          You can access and update much of your information in account
          settings, and you may request deletion of your account. Depending
          on where you live (for example California), you may have
          additional rights to access, correct, delete, or obtain a copy of
          your personal information, and to not be discriminated against for
          exercising them.
        </p>
        <p>
          Rights regarding PHI held by a covered entity (such as a
          Professional) are exercised with that covered entity; we will
          assist them as required by our BAA.
        </p>
        <p>To make a request, contact us at [privacy contact email].</p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and analytics',
    body: (
      <p>
        We use cookies that are necessary for sign-in and security, and
        product analytics to understand how the Platform is used. We do not
        place PHI in analytics or advertising tools. [Cookie preferences and
        Do Not Track handling — to be finalized.]
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        We use industry-standard safeguards to protect information, but no
        system is perfectly secure. Please use a strong, unique password and
        enable multi-factor authentication.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        The Platform is not directed to children under 18, and we do not
        knowingly collect their personal information through account
        registration.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy. If changes are material, we will notify
        you before they take effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Privacy questions or requests: [privacy contact email]. HIPAA privacy
        officer: [name / contact]. Mailing address: [Sanus legal entity name,
        address].
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="[Draft — not yet effective]"
      intro={
        <p>
          Your privacy matters, especially when health information is
          involved. This policy describes what we collect, why, who we share
          it with, how long we keep it, and the choices you have.
        </p>
      }
      sections={sections}
    />
  )
}
