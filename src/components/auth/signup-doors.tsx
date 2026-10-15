import Link from 'next/link'
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'
import {
  SignupOptionLink,
  type SignupOption,
  type SignupScreen,
} from '@/components/auth/signup-tracking'

// Shared pieces for the signup routing screens (/signup, /signup/offer,
// /signup/looking).

export interface SignupDoor {
  option: SignupOption
  href: string
  icon: LucideIcon
  title: string
  description: string
}

export function SignupDoorTiles({ screen, doors }: { screen: SignupScreen; doors: SignupDoor[] }) {
  return (
    <div className="mt-8 space-y-3">
      {doors.map((d) => {
        const Icon = d.icon
        return (
          <SignupOptionLink
            key={d.option}
            screen={screen}
            option={d.option}
            href={d.href}
            className="group flex items-start gap-4 rounded-xl border border-[#e4e5e7] bg-white p-5 transition hover:border-[#1dbf73] hover:bg-[#f0faf5]"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#e8faf1] text-[#1dbf73] transition group-hover:bg-[#1dbf73] group-hover:text-white">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-[#404145]">{d.title}</p>
              <p className="mt-1 text-sm text-[#62646a]">{d.description}</p>
            </div>
            <ArrowRight className="mt-2 size-4 shrink-0 text-[#62646a] transition group-hover:text-[#1dbf73]" />
          </SignupOptionLink>
        )
      })}
    </div>
  )
}

export function SignupBackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
    >
      <ArrowLeft className="size-3.5" />
      Back
    </Link>
  )
}

export function SignInFooter() {
  return (
    <p className="mt-8 text-center text-sm text-[#62646a]">
      Already have an account?{' '}
      <Link href="/login" className="font-semibold text-[#1dbf73] hover:underline">
        Sign in
      </Link>
    </p>
  )
}
