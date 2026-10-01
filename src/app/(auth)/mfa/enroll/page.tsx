'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { TotpEnrollment } from '@/components/auth/totp-setup'
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react'
import { MfaSignOut, safeRedirect } from '../shared'

export default function MfaEnrollPage() {
  return (
    <Suspense fallback={<Header />}>
      <EnrollForm />
    </Suspense>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-[#404145]">
        Protect your account
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        One last step: connect an authenticator app so only you can sign in.
      </p>
    </div>
  )
}

function WhyExplainer() {
  return (
    <div className="mt-6 rounded-lg border border-[#e4e5e7] bg-[#fafefb] px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#404145]">
        <ShieldCheck className="size-4 text-[#1dbf73]" aria-hidden="true" />
        Why is this required?
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[#62646a]">
        Sanus handles health information, so every account uses two-step
        sign-in: your password plus a 6-digit code from an app on your phone.
        Even if someone learns your password, they can’t get in without your
        phone.
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#404145]">
        <Clock className="size-3.5 text-[#95979d]" aria-hidden="true" />
        Takes about a minute.
      </p>
    </div>
  )
}

function EnrollForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  const [done, setDone] = useState(false)

  function handleContinue() {
    router.push(redirectTo)
    router.refresh()
  }

  // Don't router.refresh() until the user continues: this session is now
  // AAL2, so the proxy would bounce /mfa/enroll straight to /dashboard and
  // skip the success screen.
  if (done) {
    return (
      <div>
        <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
          <CheckCircle2 className="size-6 text-[#1dbf73]" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-[#404145]">
          You’re all set
        </h1>
        <p className="mt-1.5 text-sm text-[#62646a]">
          Two-step sign-in is on. Next time you sign in, open your
          authenticator app and enter the code it shows for Sanus.
        </p>

        <div className="mt-6 rounded-lg border border-[#e4e5e7] bg-[#fafefb] px-4 py-3">
          <p className="text-sm font-semibold text-[#404145]">
            Tip: add a backup authenticator
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#62646a]">
            If you lose or replace your phone, a backup keeps you from being
            locked out. When you have a minute, go to{' '}
            <strong>Settings → Security</strong> and add an authenticator on a
            second device (like a tablet or an old phone), or
            use an app that syncs, like 1Password.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleContinue}
          autoFocus
          className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
        >
          Continue
        </Button>
      </div>
    )
  }

  return (
    <div>
      <Header />
      <WhyExplainer />

      <div className="mt-8">
        <TotpEnrollment kind="primary" onVerified={() => setDone(true)} />
      </div>

      <MfaSignOut />
    </div>
  )
}
