import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-lg">
            H
          </div>
          <span className="text-2xl font-bold text-blue-600">HealthGig</span>
        </Link>
      </div>
      <div className="flex w-full flex-col items-center">{children}</div>
    </div>
  )
}
