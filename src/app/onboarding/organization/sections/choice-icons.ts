import {
  Ambulance,
  Award,
  BadgeCheck,
  Banknote,
  BedDouble,
  BookOpen,
  Briefcase,
  Building,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleEllipsis,
  CircleX,
  Clock,
  Dumbbell,
  GraduationCap,
  HeartHandshake,
  Hospital,
  House,
  Landmark,
  Laptop,
  Lightbulb,
  MapPin,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Mic,
  MonitorPlay,
  MonitorSmartphone,
  Presentation,
  Repeat,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Stethoscope,
  Tag,
  Tent,
  User,
  UserMinus,
  Users,
  UsersRound,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react'

// Icons for the button grids in the organization wizard, keyed by the option
// values in lib/onboarding/organization. A value with no entry falls back to
// CircleEllipsis, so new options never break the UI.

export type ChoiceIcons = Record<string, LucideIcon>

export const ORG_TYPE_ICONS: ChoiceIcons = {
  hospital: Hospital,
  clinic: Stethoscope,
  urgent_care: Ambulance,
  nursing_home: BedDouble,
  home_health: House,
  telehealth: Video,
  med_spa: Sparkles,
  gym: Dumbbell,
  school: GraduationCap,
  nonprofit: HeartHandshake,
  employer: Briefcase,
  law_firm: Scale,
  startup: Rocket,
  staffing: Users,
  government: Landmark,
  other: CircleEllipsis,
}

export const ORG_SIZE_ICONS: ChoiceIcons = {
  '1-10': User,
  '11-50': Users,
  '51-200': UsersRound,
  '201-500': Building,
  '500+': Building2,
}

export const BUSINESS_STRUCTURE_ICONS: ChoiceIcons = {
  llc: Briefcase,
  corporation: Building2,
  nonprofit: HeartHandshake,
  government: Landmark,
  sole_proprietor: User,
  other: CircleEllipsis,
}

export const EVENT_TYPE_ICONS: ChoiceIcons = {
  webinar: MonitorPlay,
  workshop: Presentation,
  ceu_course: BookOpen,
  certification: Award,
  conference: Mic,
  health_fair: Tent,
  support_group: MessagesSquare,
}

export const STAFFING_POST_TYPE_ICONS: ChoiceIcons = {
  surge: Zap,
  staffing_shortage: UserMinus,
  ongoing_role: Repeat,
  short_term_project: CalendarClock,
}

export const PROFESSIONAL_TIER_ICONS: ChoiceIcons = {
  clinical: Stethoscope,
  allied: BadgeCheck,
  consultant: Lightbulb,
  educator: GraduationCap,
  other: CircleEllipsis,
}

export const PAY_UNIT_ICONS: ChoiceIcons = {
  hourly: Clock,
  daily: CalendarDays,
  flat: Tag,
  salary: Banknote,
}

export const YES_NO_ICONS: ChoiceIcons = { yes: CircleCheck, no: CircleX }

export const ORG_INTENT_ICONS: ChoiceIcons = {
  advertise_services: Megaphone,
  host_events: CalendarDays,
  find_professionals: Search,
  post_needs: Zap,
}

/** LISTING_FORMATS, EVENT_FORMATS and WORK_SETTINGS share these keys. */
export const FORMAT_ICONS: ChoiceIcons = {
  in_person: MapPin,
  on_site: MapPin,
  virtual: Video,
  remote: Laptop,
  home_visit: House,
  hybrid: MonitorSmartphone,
}

export const REACH_VIA_ICONS: ChoiceIcons = { book: CalendarCheck, inquiry: MessageSquare }

export const AUDIENCE_ICONS: ChoiceIcons = {
  individuals: User,
  businesses: Building2,
  professionals: Stethoscope,
  public: Users,
  staff: BadgeCheck,
}

export const ENGAGEMENT_ICONS: ChoiceIcons = {
  employee: BadgeCheck,
  independent_contractor: Briefcase,
  per_diem: CalendarClock,
  consulting_project: Lightbulb,
  volunteer: HeartHandshake,
}

export const TIMELINE_ICONS: ChoiceIcons = {
  immediately: Zap,
  within_month: CalendarDays,
  exploring: Search,
}

export const FALLBACK_ICON = CircleEllipsis
