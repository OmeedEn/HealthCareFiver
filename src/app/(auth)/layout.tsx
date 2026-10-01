import Link from 'next/link'
import {
  ShieldCheck,
  BadgeCheck,
  Layers,
  Users,
  HeartHandshake,
} from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between bg-[#0f4c3a] p-10 text-white">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1dbf73] text-lg font-black text-white shadow-lg shadow-[#1dbf73]/30">
              S
            </div>
            <span className="text-2xl font-black tracking-tight">
              Sanus<span className="text-[#8ee7bf]">.</span>
            </span>
          </Link>

          <div className="mt-16">
            <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              Where health expertise
              <br />
              meets opportunity.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#b8e6d0]">
              The marketplace for the entire health expertise economy.
              Clinical care, consulting, coaching, legal, and education — all
              in one place.
            </p>
          </div>

          <div className="mt-12 space-y-5">
            <Feature
              icon={BadgeCheck}
              title="Reviewed before booking"
              description="Professionals are verified by our team before they can be booked"
            />
            <Feature
              icon={Layers}
              title="Three ways to engage"
              description="Book a service, hire a consultant, or attend a live event"
            />
            <Feature
              icon={Users}
              title="For everyone"
              description="Individuals, businesses, and healthcare organizations all welcome"
            />
            <Feature
              icon={ShieldCheck}
              title="Secure payments"
              description="Payments are processed by Stripe — we never store your card details"
            />
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
              <HeartHandshake className="h-5 w-5 text-[#8ee7bf]" />
            </div>
            <div>
              <p className="text-sm font-bold">Built for trust from day one</p>
              <p className="mt-1 text-sm leading-relaxed text-[#b8e6d0]">
                Health information is handled with HIPAA safeguards, and you
                stay in control of who you work with and what you share.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-[#e4e5e7] px-6 py-4 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1dbf73] text-base font-black text-white">
              S
            </div>
            <span className="text-xl font-black tracking-tight text-[#404145]">
              Sanus<span className="text-[#1dbf73]">.</span>
            </span>
          </Link>
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center justify-center gap-1.5 border-t border-[#e4e5e7] px-6 py-4 text-center text-xs text-[#95979d] sm:flex-row sm:gap-4">
          <span>&copy; {new Date().getFullYear()} Sanus. All rights reserved.</span>
          <span className="flex gap-4">
            <Link href="/terms" className="transition hover:text-[#404145]">
              Terms of Service
            </Link>
            <Link href="/privacy" className="transition hover:text-[#404145]">
              Privacy Policy
            </Link>
          </span>
        </div>
      </div>
    </div>
  )
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
        <Icon className="h-5 w-5 text-[#8ee7bf]" />
      </div>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[#b8e6d0]">
          {description}
        </p>
      </div>
    </div>
  )
}
