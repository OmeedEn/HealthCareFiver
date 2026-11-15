import Link from 'next/link'
import { PresenceHeartbeat } from '@/components/presence-heartbeat'
import { SanusMark } from '@/components/brand/sanus-mark'

// Minimal, generic shell for post-signup onboarding flows (/onboarding/*):
// logo header + a centered column. Individual pages choose their own width.
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f4ef]">
      <PresenceHeartbeat />
      <header className="border-b border-[#e3dfd6] bg-white">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <SanusMark className="h-9 w-9" />
            <span className="text-xl font-black tracking-tight text-[#1a1a17]">
              Sanus<span className="text-[#2f3cf5]">.</span>
            </span>
          </Link>
          {/* Buyer browsing never requires finishing this flow: answers are
              saved as you go, and /find-care is open to every account. */}
          <Link
            href="/find-care"
            className="rounded text-sm font-semibold text-[#2f3cf5] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f3cf5]"
          >
            Browse professionals
          </Link>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-2xl">{children}</div>
      </main>

      <footer className="flex flex-col items-center justify-center gap-1.5 border-t border-[#e3dfd6] bg-white px-6 py-4 text-center text-xs text-[#706d65] sm:flex-row sm:gap-4">
        <span>&copy; {new Date().getFullYear()} Sanus. All rights reserved.</span>
        <span className="flex gap-4">
          <Link href="/terms" className="transition hover:text-[#1a1a17]">
            Terms of Service
          </Link>
          <Link href="/privacy" className="transition hover:text-[#1a1a17]">
            Privacy Policy
          </Link>
        </span>
      </footer>
    </div>
  )
}
