import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}
