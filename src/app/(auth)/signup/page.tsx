import Link from 'next/link'
import { Stethoscope, Building2, ArrowRight } from 'lucide-react'

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-[#404145]">
        Join HealthGig
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        Choose how you want to get started
      </p>

      <div className="mt-8 space-y-3">
        <Link
          href="/signup/contractor"
          className="group flex items-center gap-4 rounded-xl border border-[#e4e5e7] bg-white p-5 transition-all hover:border-[#1dbf73] hover:shadow-md"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73] transition-colors group-hover:bg-[#1dbf73] group-hover:text-white">
            <Stethoscope className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-[#404145]">
              Healthcare Professional
            </p>
            <p className="mt-0.5 text-sm text-[#62646a]">
              Find shifts, manage credentials, and grow your career
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-[#95979d] transition-transform group-hover:translate-x-1 group-hover:text-[#1dbf73]" />
        </Link>

        <Link
          href="/signup/facility"
          className="group flex items-center gap-4 rounded-xl border border-[#e4e5e7] bg-white p-5 transition-all hover:border-[#1dbf73] hover:shadow-md"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73] transition-colors group-hover:bg-[#1dbf73] group-hover:text-white">
            <Building2 className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-[#404145]">
              Healthcare Facility
            </p>
            <p className="mt-0.5 text-sm text-[#62646a]">
              Post jobs, find professionals, and manage staffing
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-[#95979d] transition-transform group-hover:translate-x-1 group-hover:text-[#1dbf73]" />
        </Link>
      </div>

      <p className="mt-6 text-center text-sm text-[#62646a]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-bold text-[#1dbf73] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
