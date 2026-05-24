import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Stethoscope, Building2, ArrowLeft } from 'lucide-react'

export default function SignupPage() {
  return (
    <div className="w-full max-w-2xl space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-blue-600">Join HealthGig</h1>
        <p className="text-muted-foreground">
          Choose how you want to get started
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Link href="/signup/contractor" className="group">
          <Card className="h-full transition-all hover:ring-2 hover:ring-blue-600 hover:shadow-lg cursor-pointer">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                <Stethoscope className="h-7 w-7" />
              </div>
              <CardTitle className="text-lg">Healthcare Professional</CardTitle>
              <CardDescription>
                Find shifts, manage credentials, and grow your career
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <span className="text-sm font-medium text-blue-600 group-hover:underline">
                Get Started &rarr;
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/signup/facility" className="group">
          <Card className="h-full transition-all hover:ring-2 hover:ring-blue-600 hover:shadow-lg cursor-pointer">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                <Building2 className="h-7 w-7" />
              </div>
              <CardTitle className="text-lg">Healthcare Facility</CardTitle>
              <CardDescription>
                Post jobs, find qualified professionals, and manage staffing
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <span className="text-sm font-medium text-blue-600 group-hover:underline">
                Get Started &rarr;
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
          <ArrowLeft className="h-3 w-3" />
          Already have an account? Sign in
        </Link>
      </p>
    </div>
  )
}
