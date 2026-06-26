import Link from 'next/link'
import {
  ShieldCheck,
  BadgeCheck,
  HeartPulse,
  Clock,
  Star,
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
            <h1 className="text-3xl font-black leading-tight tracking-tight xl:text-4xl">
              The smarter way to
              <br />
              staff healthcare.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#b8e6d0]">
              Connect with verified clinicians, manage credentials, and
              streamline contracts — all in one marketplace.
            </p>
          </div>

          <div className="mt-12 space-y-5">
            <Feature
              icon={BadgeCheck}
              title="Verified Professionals"
              description="Every clinician is credential-checked and license-verified"
            />
            <Feature
              icon={ShieldCheck}
              title="Secure Payments"
              description="Escrow-protected payments with automatic 1099 filing"
            />
            <Feature
              icon={HeartPulse}
              title="Healthcare-First"
              description="Built specifically for clinical staffing workflows"
            />
            <Feature
              icon={Clock}
              title="Fill Shifts Fast"
              description="Smart matching finds the right pro in hours, not weeks"
            />
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex -space-x-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0f4c3a] bg-[#1dbf73] text-xs font-bold">
                SJ
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0f4c3a] bg-[#ffd700] text-xs font-bold text-[#404145]">
                MC
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0f4c3a] bg-[#87ceeb] text-xs font-bold text-[#404145]">
                KW
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 fill-[#ffd700] text-[#ffd700]"
                  />
                ))}
                <span className="ml-1 text-sm font-bold">4.9</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[#b8e6d0]">
                &ldquo;Sanus made it incredibly easy to find qualified ICU
                nurses for our facility.&rdquo;
              </p>
              <p className="mt-1 text-xs font-semibold text-[#8ee7bf]">
                — Dr. Michael Chen, Northline Medical Center
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
        <div className="border-t border-[#e4e5e7] px-6 py-4 text-center text-xs text-[#95979d]">
          &copy; {new Date().getFullYear()} Sanus. All rights reserved.
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
