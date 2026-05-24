import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f7] px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1dbf73] text-lg font-black text-white">
            H
          </div>
          <span className="text-2xl font-black tracking-tight text-[#404145]">
            HealthGig<span className="text-[#1dbf73]">.</span>
          </span>
        </Link>
      </div>
      <div className="flex w-full flex-col items-center">{children}</div>
    </div>
  )
}
