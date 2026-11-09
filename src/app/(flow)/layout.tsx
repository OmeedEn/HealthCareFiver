import Link from 'next/link'

// Shell for the pre-account single-question signup flows (Single-Question
// Onboarding spec): same logo header as /onboarding/*, no marketing side
// panel, and tight vertical padding so each screen fits a phone without
// scrolling. Route group only — URLs stay /signup/<flow>.
export default function QuestionFlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f6f4ef]">
      <header className="border-b border-[#e3dfd6] bg-white">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#2f3cf5] text-base font-black text-white">
              S
            </div>
            <span className="text-xl font-black tracking-tight text-[#1a1a17]">
              Sanus<span className="text-[#2f3cf5]">.</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-5 sm:px-6 sm:py-10">
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
