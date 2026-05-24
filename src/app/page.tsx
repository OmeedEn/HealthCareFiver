import Link from 'next/link'
import {
  Zap,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  ArrowRight,
  CheckCircle,
  Stethoscope,
  Building2,
  UserPlus,
  Search,
  FileCheck,
  ClipboardList,
  Handshake,
  Star,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
              H
            </div>
            <span className="text-xl font-bold text-blue-600">HealthGig</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
              Connect with Top{' '}
              <span className="text-blue-600">Healthcare Professionals</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 md:text-xl">
              HealthGig is the modern platform that matches healthcare facilities with
              qualified professionals. Streamline hiring, verify credentials, and manage
              contracts all in one place.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-8 text-base font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                Sign Up Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-8 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                Browse Jobs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Everything You Need to Succeed
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Purpose-built tools for healthcare staffing
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={Zap}
              title="Smart Matching"
              description="AI-powered matching connects the right professionals with the right opportunities based on skills, certifications, and preferences."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Credential Verification"
              description="Automated credential tracking and verification ensures compliance and keeps everyone safe."
            />
            <FeatureCard
              icon={CreditCard}
              title="Secure Payments"
              description="Transparent billing, automated timesheets, and fast payments for every completed shift."
            />
            <FeatureCard
              icon={MessageSquare}
              title="Real-time Communication"
              description="Built-in messaging keeps facilities and professionals connected throughout every engagement."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-lg text-gray-600">
              Get started in minutes, not days
            </p>
          </div>

          <div className="mt-16 grid gap-12 lg:grid-cols-2">
            {/* For Professionals */}
            <div>
              <div className="mb-6 flex items-center gap-2">
                <Stethoscope className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">
                  For Professionals
                </h3>
              </div>
              <div className="space-y-6">
                <StepCard
                  step={1}
                  icon={UserPlus}
                  title="Create Your Profile"
                  description="Sign up, upload your credentials, and set your availability and preferences."
                />
                <StepCard
                  step={2}
                  icon={Search}
                  title="Get Matched with Jobs"
                  description="Our smart matching engine finds shifts that fit your skills, schedule, and location."
                />
                <StepCard
                  step={3}
                  icon={Star}
                  title="Work and Get Paid"
                  description="Complete shifts, track your hours, and receive fast, secure payments."
                />
              </div>
            </div>

            {/* For Facilities */}
            <div>
              <div className="mb-6 flex items-center gap-2">
                <Building2 className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">
                  For Facilities
                </h3>
              </div>
              <div className="space-y-6">
                <StepCard
                  step={1}
                  icon={ClipboardList}
                  title="Post Your Openings"
                  description="Describe the role, requirements, and schedule. Reach qualified professionals instantly."
                />
                <StepCard
                  step={2}
                  icon={FileCheck}
                  title="Review Verified Candidates"
                  description="Browse pre-verified professionals with confirmed credentials and reviews."
                />
                <StepCard
                  step={3}
                  icon={Handshake}
                  title="Hire and Manage"
                  description="Extend offers, manage contracts, and handle payments all in one platform."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to Transform Healthcare Staffing?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Join thousands of healthcare professionals and facilities already using
            HealthGig.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 text-base font-medium text-blue-600 shadow-sm hover:bg-blue-50 transition-colors"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
                  H
                </div>
                <span className="text-lg font-bold text-blue-600">HealthGig</span>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Modern healthcare staffing made simple.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">For Professionals</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li><Link href="/signup/contractor" className="hover:text-blue-600">Sign Up</Link></li>
                <li><Link href="/login" className="hover:text-blue-600">Sign In</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Browse Jobs</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">For Facilities</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li><Link href="/signup/facility" className="hover:text-blue-600">Sign Up</Link></li>
                <li><Link href="/login" className="hover:text-blue-600">Sign In</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Post a Job</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Company</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-blue-600">About</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Contact</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} HealthGig. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  )
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
          {step}
        </div>
      </div>
      <div>
        <h4 className="flex items-center gap-2 font-semibold text-gray-900">
          <Icon className="h-4 w-4 text-blue-600" />
          {title}
        </h4>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
    </div>
  )
}
