import Link from 'next/link'
import { Briefcase, Building2, Stethoscope, ArrowRight } from 'lucide-react'

const PATHS = [
  {
    href: '/signup/client',
    icon: Briefcase,
    title: "I'm looking for a professional",
    description: 'Find a health expert, book a service, or attend an event.',
  },
  {
    href: '/signup/organization',
    icon: Building2,
    title: 'I represent a business or organization',
    description:
      'Hospitals, clinics, practices, gyms, employers, and wellness businesses.',
  },
  {
    href: '/signup/professional',
    icon: Stethoscope,
    title: "I'm a health professional",
    description:
      'Advertise your services, consulting, or events to clients and organizations.',
  },
]

export default function SignupPickerPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
        Join Sanus — Who are you here as?
      </h1>
      <p className="mt-2 text-sm text-[#62646a]">
        Pick the path that fits you. You can always change later.
      </p>

      <div className="mt-8 space-y-3">
        {PATHS.map((p) => {
          const Icon = p.icon
          return (
            <Link
              key={p.href}
              href={p.href}
              className="group flex items-start gap-4 rounded-xl border border-[#e4e5e7] bg-white p-5 transition hover:border-[#1dbf73] hover:bg-[#f0faf5]"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#e8faf1] text-[#1dbf73] transition group-hover:bg-[#1dbf73] group-hover:text-white">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-[#404145]">
                  {p.title}
                </p>
                <p className="mt-1 text-sm text-[#62646a]">{p.description}</p>
              </div>
              <ArrowRight className="mt-2 size-4 shrink-0 text-[#62646a] transition group-hover:text-[#1dbf73]" />
            </Link>
          )
        })}
      </div>

      <p className="mt-8 text-center text-sm text-[#62646a]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-[#1dbf73] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
