import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'
import { CONTRACTOR_AGREEMENT_VERSION } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Independent Contractor and Platform Agreement (Draft) — Sanus',
  description:
    'Draft Independent Contractor and Platform Agreement for professionals on Sanus. Pending legal review.',
}

const linkClass = 'text-[#0f8f56] underline'

const sections: LegalSection[] = [
  {
    id: 'parties',
    title: 'Parties and acceptance',
    body: (
      <>
        <p>
          This Independent Contractor and Platform Agreement (the
          &ldquo;Agreement&rdquo;) is between [Sanus legal entity name], a
          [state] [entity type] (&ldquo;Sanus,&rdquo; &ldquo;we,&rdquo;
          &ldquo;us&rdquo;), and you, the individual professional or business
          offering services through the Sanus platform (&ldquo;you&rdquo; or
          &ldquo;Professional&rdquo;).
        </p>
        <p>
          You accept this Agreement by checking the agreement box and
          confirming at the &ldquo;Go live&rdquo; step of your Sanus account.
          This Agreement supplements our{' '}
          <Link href="/terms" className={linkClass}>
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          , which also apply to you. If they conflict, this Agreement controls
          as to your activities as a Professional.
        </p>
      </>
    ),
  },
  {
    id: 'independent-contractor',
    title: 'Independent contractor status',
    body: (
      <>
        <p>
          You are an independent contractor. Nothing in this Agreement creates
          an employment, partnership, joint venture, agency, or franchise
          relationship between you and Sanus.
        </p>
        <ul>
          <li>
            You decide whether, when, where, and how often to offer services,
            which bookings to accept, and how to perform your services, within
            the standards of your profession.
          </li>
          <li>
            You set your own prices, subject to the platform service fee
            described below.
          </li>
          <li>
            You are free to offer services outside Sanus, including to the
            same types of clients, subject to Section [non-circumvention].
          </li>
          <li>
            You are not entitled to wages, overtime, benefits, workers&rsquo;
            compensation, or unemployment insurance from Sanus.
          </li>
          <li>
            You are responsible for your own taxes, including income and
            self-employment taxes. Sanus or its payment processor may issue tax
            forms (for example, Form 1099-K or 1099-NEC) as required by law.
          </li>
          <li>
            You supply your own tools, equipment, supplies, and workspace
            unless otherwise agreed with a client.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'professional-responsibility',
    title: 'Licensure, scope of practice, and professional responsibility',
    body: (
      <>
        <p>
          You are solely responsible for the professional services you provide
          and for your professional judgment. Sanus does not supervise,
          direct, or control your services and does not practice medicine or
          any other licensed profession.
        </p>
        <ul>
          <li>
            You will hold, and keep current and in good standing, every
            license, certification, registration, and credential required for
            the services you offer, in each jurisdiction where you or your
            client are located.
          </li>
          <li>
            You will only offer and provide services within your lawful scope
            of practice and training, and will follow applicable standards of
            care, professional ethics, and laws (including telehealth,
            informed consent, prescribing, and record-keeping rules).
          </li>
          <li>
            You will tell Sanus within [5] business days if any license or
            certification is suspended, restricted, revoked, placed on
            probation, or subject to an investigation or disciplinary action,
            or if any information you submitted for verification changes.
          </li>
          <li>
            Sanus&rsquo;s credential review is a marketplace trust measure only.
            It is not a guarantee of your qualifications, and it does not
            shift responsibility for your services to Sanus.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'listings',
    title: 'Listing review and scope of practice',
    body: (
      <>
        <p>
          [Attorney to finalize.] Every listing (service, consulting offer,
          or event) is reviewed by Sanus before it is published, and may be
          reviewed again after you edit it. Sanus may decline, pause, or
          remove a listing that does not meet these rules:
        </p>
        <ul>
          <li>
            The listing must fall within the scope of practice of the license
            or certification Sanus verified for you, in each state where the
            client will be located.
          </li>
          <li>
            You will not offer to diagnose or treat conditions outside your
            scope, and will not offer prescribing, injectables, or IV therapy
            unless you are licensed to do so (or are acting under legally
            required supervision or orders) in the client&rsquo;s state.
          </li>
          <li>
            Listings may not promise a cure or guaranteed results, or make
            false, misleading, or unsupported health claims.
          </li>
          <li>
            You must disclose in the listing whether it involves in-person or
            hands-on care, home visits, prescribing, injectables, or IVs, and
            keep that information accurate.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'insurance',
    title: 'Insurance',
    body: (
      <>
        <p>
          You will maintain, at your own expense, insurance appropriate to
          your profession and services, including professional liability
          (malpractice) insurance where your profession requires or customarily
          carries it, with limits of at least [$1,000,000 per claim /
          $3,000,000 aggregate] or as required by law, whichever is greater.
        </p>
        <p>
          You will provide proof of coverage on request and notify Sanus of
          any lapse or cancellation within [5] business days. [Additional
          insured / general liability requirements — pending counsel.]
        </p>
        <p>
          <strong>Services that require malpractice coverage.</strong>{' '}
          [Attorney to finalize.] Professional liability (malpractice)
          insurance covering the services offered is required for any listing
          that involves in-person or hands-on care, home visits, prescribing,
          injectables, or IV therapy (&ldquo;Covered Services&rdquo;). A
          Covered Services listing will not be published or bookable until
          Sanus has reviewed a current certificate of insurance. The
          &ldquo;Insured&rdquo; badge appears on your profile only after that
          review.
        </p>
        <p>
          <strong>Grace period.</strong> [Attorney to finalize.] If you
          indicated you will offer Covered Services but did not provide a
          certificate before approval, you have thirty (30) days from the date
          Sanus approves your account to upload a certificate. During this
          grace period you may go live and publish listings that are not
          Covered Services (for example, consulting, telehealth or virtual
          advisory, and educational listings); Covered Services listings stay
          unpublished until the certificate is reviewed. Sanus will remind
          you before the deadline.
        </p>
        <p>
          <strong>Pause rule.</strong> [Attorney to finalize.] If the grace
          period ends without a reviewed certificate, or if your coverage
          later expires, lapses, or is cancelled, Sanus will pause and hide
          your Covered Services listings (and may cancel affected upcoming
          bookings [per the cancellation policy — pending counsel]) and
          remove the Insured badge. Your other listings are not affected. Paused
          listings are reactivated after you upload a current certificate and
          Sanus reviews it.
        </p>
      </>
    ),
  },
  {
    id: 'monitoring',
    title: 'Ongoing screening and credential monitoring',
    body: (
      <>
        <p>
          [Attorney to finalize.] You authorize Sanus and its vendors to
          verify your credentials with licensing boards and certifying bodies
          and to screen you against federal and state exclusion and debarment
          lists (including the HHS-OIG List of Excluded Individuals/Entities,
          SAM.gov, and the Medi-Cal Suspended and Ineligible Provider List),
          both at approval and on an ongoing basis (currently about monthly).
        </p>
        <ul>
          <li>
            Sanus tracks the expiration dates of your license or
            certification, malpractice insurance, and government ID, and will
            remind you approximately 60 and 30 days before each expires.
          </li>
          <li>
            If a license, certification, or government ID expires or is no
            longer active and in good standing, Sanus will hide your profile
            and listings from search and stop new bookings until a current
            credential is verified.
          </li>
          <li>
            If screening shows you are excluded, debarred, or otherwise
            ineligible, or contradicts information you provided, Sanus may
            suspend or remove your account immediately.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'self-disclosure',
    title: 'Accuracy and duty to notify Sanus of changes',
    body: (
      <>
        <p>
          [Attorney to finalize.] You certify that the information you gave
          Sanus, including your self-disclosure answers, is accurate and
          complete. You will notify Sanus in writing within [5] business days
          if:
        </p>
        <ul>
          <li>
            any license or certification is suspended, revoked, restricted,
            surrendered, placed on probation, or becomes the subject of an
            investigation or disciplinary action;
          </li>
          <li>
            you are excluded, suspended, or debarred from Medicare, Medicaid
            (including Medi-Cal), or any other federal or state program;
          </li>
          <li>
            you are charged with or convicted of a felony or any
            healthcare-related offense;
          </li>
          <li>
            a malpractice claim, judgment, or settlement is made against you,
            or your professional liability coverage changes, lapses, or is
            cancelled; or
          </li>
          <li>
            your name, practice locations, or any other information you
            submitted for verification changes.
          </li>
        </ul>
        <p>
          An inaccurate or incomplete disclosure, or a failure to notify, is
          a material breach of this Agreement.
        </p>
      </>
    ),
  },
  {
    id: 'fees-payments',
    title: 'Platform fee and payments through Stripe Connect',
    body: (
      <>
        <p>
          Joining Sanus is free. Sanus charges a service fee on each booking
          made through the platform. The current fee is [X% of the booking
          amount / fee schedule], and you will see the exact amount before you
          publish an offering. We will give you at least [30] days&rsquo;
          notice before increasing the fee.
        </p>
        <ul>
          <li>
            Client payments are processed by Stripe, Inc. through Stripe
            Connect. To receive payouts you must create and keep in good
            standing a Stripe Connect account and agree to the{' '}
            <a
              href="https://stripe.com/connect-account/legal"
              className={linkClass}
              target="_blank"
              rel="noopener noreferrer"
            >
              Stripe Connected Account Agreement
            </a>
            .
          </li>
          <li>
            Stripe collects and handles your identity and banking details (for
            example, bank account, date of birth, and SSN digits). Sanus does
            not receive or store that information.
          </li>
          <li>
            You authorize Sanus to deduct its service fee, and any refunds,
            chargebacks, or adjustments owed under our policies, from amounts
            paid to you.
          </li>
          <li>
            Payout timing is governed by Stripe and by [Sanus payout schedule /
            hold period — pending counsel].
          </li>
          <li>
            Cancellations, no-shows, and refunds follow the [Sanus cancellation
            and refund policy].
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'non-circumvention',
    title: 'Bookings made through Sanus',
    body: (
      <p>
        For clients you first meet through Sanus, you agree not to move
        payment for services off the platform to avoid the service fee for
        [12] months after your first booking with that client. [Scope and
        enforceability of this clause — pending counsel.]
      </p>
    ),
  },
  {
    id: 'hipaa',
    title: 'Privacy, HIPAA, and protected health information',
    body: (
      <>
        <p>
          Where you are a covered entity or business associate under HIPAA,
          or otherwise create, receive, or maintain protected health
          information (&ldquo;PHI&rdquo;) through Sanus, you are responsible
          for your own compliance with HIPAA and applicable state privacy laws.
        </p>
        <ul>
          <li>
            Where required, you and Sanus will enter into a Business Associate
            Agreement (&ldquo;BAA&rdquo;), which will govern PHI handled
            through the platform. [BAA form and trigger conditions — pending
            counsel.]
          </li>
          <li>
            Use Sanus messaging, video, and documentation tools for client
            communications involving PHI rather than unsecured channels.
          </li>
          <li>
            Use client information only to provide the booked services and as
            permitted by law, and keep it confidential.
          </li>
          <li>
            Report any suspected security incident or unauthorized disclosure
            involving Sanus data to [security contact] within [24 hours].
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'conduct',
    title: 'Professional conduct',
    body: (
      <>
        <p>You agree to:</p>
        <ul>
          <li>
            Represent your credentials, experience, services, and prices
            accurately and keep your profile current.
          </li>
          <li>
            Treat clients with respect and without discrimination on any basis
            prohibited by law.
          </li>
          <li>
            Not harass, exploit, or engage in any inappropriate relationship
            with clients, and maintain professional boundaries.
          </li>
          <li>
            Not make false or unsupported health claims, or misuse reviews or
            ratings.
          </li>
          <li>
            Follow the Sanus{' '}
            <Link href="/terms" className={linkClass}>
              Terms of Service
            </Link>{' '}
            and [community guidelines].
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'Responsibility for claims',
    body: (
      <p>
        You will defend, indemnify, and hold harmless Sanus and its officers,
        employees, and agents from claims arising out of your services, your
        breach of this Agreement, or your violation of law or the rights of a
        third party. [Limitation of liability and indemnity scope — pending
        counsel.]
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Term, suspension, and termination',
    body: (
      <>
        <p>
          This Agreement starts when you accept it and continues until ended by
          either party.
        </p>
        <ul>
          <li>You may end it at any time by closing your Sanus account.</li>
          <li>
            Sanus may suspend or remove your profile or end this Agreement on
            [notice period] notice, or immediately if you breach it, if your
            license or required credentials lapse or are restricted, if we
            receive credible reports of client harm, or if required by law.
          </li>
          <li>
            Bookings already confirmed at termination will be [completed or
            cancelled and refunded — pending counsel]. Fees owed and Sections
            on payments, HIPAA, responsibility for claims, and dispute
            resolution survive termination.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'general',
    title: 'Changes, disputes, and general terms',
    body: (
      <>
        <p>
          We may update this Agreement. If changes are material, we will
          notify you and ask you to accept the updated version before you
          continue to accept new bookings. This version is identified as{' '}
          <strong>{CONTRACTOR_AGREEMENT_VERSION}</strong>.
        </p>
        <p>
          [Governing law, venue, arbitration / class-action waiver, notices,
          assignment, severability, and entire-agreement clauses — pending
          counsel.]
        </p>
        <p>Questions: [legal contact email].</p>
      </>
    ),
  },
]

export default function ContractorAgreementPage() {
  return (
    <LegalPage
      title="Independent Contractor and Platform Agreement"
      lastUpdated="October 1, 2026"
      intro={
        <p>
          This Agreement explains how professionals work with Sanus: you are
          an independent professional responsible for your own practice,
          Sanus provides the marketplace and charges a small service fee on
          each booking, and payments are handled by Stripe.
        </p>
      }
      sections={sections}
    />
  )
}
