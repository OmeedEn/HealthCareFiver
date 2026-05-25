import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DEMO_EVENTS } from '@/lib/demo/data'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  Users,
  ArrowLeft,
  CheckCircle2,
  Video,
  Wrench,
  Award,
  Radio,
  GraduationCap,
} from 'lucide-react'
import { EventDetailRegisterButton } from './register-button'

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; gradient: string }
> = {
  webinar: {
    label: 'Webinar',
    icon: Video,
    color: 'bg-blue-100 text-blue-700',
    gradient: 'from-blue-500 to-blue-700',
  },
  workshop: {
    label: 'Workshop',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-700',
    gradient: 'from-orange-500 to-orange-700',
  },
  certification: {
    label: 'Certification',
    icon: Award,
    color: 'bg-purple-100 text-purple-700',
    gradient: 'from-purple-500 to-purple-700',
  },
  live_class: {
    label: 'Live Class',
    icon: Radio,
    color: 'bg-emerald-100 text-emerald-700',
    gradient: 'from-emerald-500 to-emerald-700',
  },
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Self-paced'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // In production, fetch from Supabase. In demo mode, use mock data.
  const event = DEMO_EVENTS.find((e) => e.id === id)

  if (!event) {
    notFound()
  }

  const config = TYPE_CONFIG[event.type]
  const TypeIcon = config?.icon ?? Video

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-1 text-sm text-[#6b7280] transition-colors hover:text-[#1dbf73]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </Link>

      {/* Hero */}
      <div
        className={`relative flex h-56 items-center justify-center rounded-xl bg-gradient-to-br ${config?.gradient ?? 'from-gray-500 to-gray-700'}`}
      >
        <TypeIcon className="h-20 w-20 text-white/30" />
        <Badge
          className={`absolute left-4 top-4 ${config?.color ?? 'bg-gray-100 text-gray-700'}`}
        >
          {config?.label ?? event.type}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#111827]">
              {event.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[#6b7280]">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(event.date)}
              </div>
              {formatTime(event.date) && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatTime(event.date)}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {event.registered} registered
              </div>
            </div>
          </div>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg text-[#111827]">
                About This Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-[#374151]">
                {event.description}
              </p>
            </CardContent>
          </Card>

          {/* What You'll Learn */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg text-[#111827]">
                What You Will Learn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {event.learningObjectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                    <span className="text-sm text-[#374151]">{objective}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Curriculum / Agenda */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg text-[#111827]">
                {event.type === 'certification' ? 'Curriculum' : 'Agenda'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {event.agenda.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 rounded-lg border border-[#e4e5e7] p-3"
                  >
                    <span className="shrink-0 text-sm font-medium text-[#1dbf73]">
                      {item.time}
                    </span>
                    <span className="text-sm text-[#374151]">
                      {item.topic}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Prerequisites */}
          {event.prerequisites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg text-[#111827]">
                  Prerequisites
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {event.prerequisites.map((prereq) => (
                    <li
                      key={prereq}
                      className="flex items-start gap-2 text-sm text-[#374151]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6b7280]" />
                      {prereq}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Registration card */}
          <Card className="sticky top-6 border-[#e4e5e7]">
            <CardContent className="space-y-4 pt-6">
              <div className="text-center">
                {event.price === 0 ? (
                  <div>
                    <p className="text-2xl font-bold text-[#1dbf73]">Free</p>
                    <p className="text-sm text-[#6b7280]">for all members</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-[#111827]">
                      ${event.memberPrice}
                    </p>
                    {event.memberPrice < event.price && (
                      <p className="text-sm text-[#6b7280]">
                        <span className="line-through">${event.price}</span>{' '}
                        non-member price
                      </p>
                    )}
                  </div>
                )}
              </div>

              <EventDetailRegisterButton title={event.title} />

              <div className="space-y-2 text-sm text-[#6b7280]">
                <div className="flex items-center justify-between">
                  <span>Format</span>
                  <span className="font-medium text-[#374151]">
                    {config?.label ?? event.type}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Duration</span>
                  <span className="font-medium text-[#374151]">
                    {event.duration}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Registered</span>
                  <span className="font-medium text-[#374151]">
                    {event.registered} attendees
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructor card */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base text-[#111827]">
                Instructor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1dbf73]/10">
                  <GraduationCap className="h-5 w-5 text-[#1dbf73]" />
                </div>
                <p className="font-medium text-[#111827]">
                  {event.instructor}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                {event.instructorBio}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
