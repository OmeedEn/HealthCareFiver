'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { isDemoMode, DEMO_EVENTS } from '@/lib/demo/data'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Calendar,
  Clock,
  Search,
  Users,
  Video,
  Wrench,
  Award,
  Radio,
  GraduationCap,
} from 'lucide-react'

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

const FILTER_TYPES = ['all', 'webinar', 'workshop', 'certification', 'live_class'] as const

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Self-paced'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
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

function isUpcoming(dateStr: string | null) {
  if (!dateStr) return true // Self-paced is always "upcoming"
  return new Date(dateStr) > new Date()
}

function EventCard({
  event,
  onRegister,
}: {
  event: (typeof DEMO_EVENTS)[number]
  onRegister: (title: string) => void
}) {
  const config = TYPE_CONFIG[event.type]
  const TypeIcon = config?.icon ?? Video

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      {/* Image placeholder with gradient */}
      <div
        className={`relative flex h-40 items-center justify-center bg-gradient-to-br ${config?.gradient ?? 'from-gray-500 to-gray-700'}`}
      >
        <TypeIcon className="h-12 w-12 text-white/40" />
        <Badge
          className={`absolute left-3 top-3 ${config?.color ?? 'bg-gray-100 text-gray-700'}`}
        >
          {config?.label ?? event.type}
        </Badge>
        {event.price === 0 && (
          <Badge className="absolute right-3 top-3 bg-[#1dbf73] text-white hover:bg-[#1dbf73]/90">
            Free
          </Badge>
        )}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base leading-snug text-[#111827]">
          <Link
            href={`/events/${event.id}`}
            className="hover:text-[#1dbf73] transition-colors"
          >
            {event.title}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-col gap-1.5 text-sm text-[#6b7280]">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(event.date)}</span>
            {formatTime(event.date) && (
              <>
                <Clock className="ml-1 h-3.5 w-3.5" />
                <span>{formatTime(event.date)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>{event.instructor}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>{event.registered} registered</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            {event.price === 0 ? (
              <span className="text-sm font-semibold text-[#1dbf73]">
                Free for members
              </span>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-[#111827]">
                  ${event.memberPrice}
                </span>
                {event.memberPrice < event.price && (
                  <span className="text-sm text-[#6b7280] line-through">
                    ${event.price}
                  </span>
                )}
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="bg-[#1dbf73] text-white hover:bg-[#1dbf73]/90"
            onClick={() => onRegister(event.title)}
          >
            Register
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const events = DEMO_EVENTS

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        !searchQuery ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.instructor.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = typeFilter === 'all' || event.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [events, searchQuery, typeFilter])

  const upcomingEvents = filteredEvents.filter((e) => isUpcoming(e.date))
  const pastEvents = filteredEvents.filter((e) => !isUpcoming(e.date))

  // Demo: simulated registrations
  const myRegistrations = isDemoMode()
    ? [events[0], events[4]]
    : []

  function handleRegister(title: string) {
    if (isDemoMode()) {
      toast.success(`Successfully registered for "${title}" (demo mode)`)
      return
    }
    toast.info('Redirecting to registration...')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#111827]">
          Events & Education
        </h1>
        <p className="mt-1 text-[#6b7280]">
          Expand your skills with webinars, workshops, and certification
          courses.
        </p>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTER_TYPES.map((type) => (
            <Button
              key={type}
              variant={typeFilter === type ? 'default' : 'outline'}
              size="sm"
              className={
                typeFilter === type
                  ? 'bg-[#1dbf73] text-white hover:bg-[#1dbf73]/90'
                  : 'text-[#6b7280]'
              }
              onClick={() => setTypeFilter(type)}
            >
              {type === 'all'
                ? 'All'
                : type === 'live_class'
                  ? 'Live Class'
                  : type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past">Past ({pastEvents.length})</TabsTrigger>
          <TabsTrigger value="registered">
            My Registrations ({myRegistrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {upcomingEvents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="h-12 w-12 text-[#6b7280]" />
                <p className="mt-3 text-[#6b7280]">
                  No upcoming events match your search.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRegister={handleRegister}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {pastEvents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-[#6b7280]" />
                <p className="mt-3 text-[#6b7280]">
                  No past events to show.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pastEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRegister={handleRegister}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="registered" className="mt-6">
          {myRegistrations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Award className="h-12 w-12 text-[#6b7280]" />
                <p className="mt-3 text-[#6b7280]">
                  You have not registered for any events yet.
                </p>
                <Button
                  className="mt-4 bg-[#1dbf73] text-white hover:bg-[#1dbf73]/90"
                  onClick={() => {
                    const tab = document.querySelector(
                      '[data-value="upcoming"]'
                    ) as HTMLElement
                    tab?.click()
                  }}
                >
                  Browse Events
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {myRegistrations.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRegister={handleRegister}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
