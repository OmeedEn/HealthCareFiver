import { Card, CardContent } from '@/components/ui/card'

/** Shown by admin pages that only work against a live Supabase project. */
export function AdminDemoNotice() {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-[#62646a]">
        This page reads live data from Supabase. Set the Supabase env vars to use it.
      </CardContent>
    </Card>
  )
}
