import {
  Activity,
  Baby,
  Brain,
  CalendarClock,
  CalendarDays,
  CircleQuestionMark,
  Dumbbell,
  Hand,
  House,
  MapPin,
  Presentation,
  Salad,
  Scale,
  Search,
  Shuffle,
  Sparkles,
  Stethoscope,
  Video,
  Zap,
} from 'lucide-react'
import type { ChoiceIcons } from './choice-icons'

// Icons for the client flow's tiles, keyed by the values in
// src/lib/onboarding/client-interests.ts.

export const CLIENT_INTEREST_ICONS: ChoiceIcons = {
  clinical: Stethoscope,
  mental_health: Brain,
  nutrition: Salad,
  coaching: Sparkles,
  physical_therapy: Activity,
  fitness: Dumbbell,
  bodywork: Hand,
  birth_family: Baby,
  advice_advocacy: Scale,
  events_education: Presentation,
  not_sure: CircleQuestionMark,
}

export const HELP_TIMELINE_ICONS: ChoiceIcons = {
  asap: Zap,
  two_weeks: CalendarClock,
  month: CalendarDays,
  exploring: Search,
}

export const MEETING_FORMAT_ICONS: ChoiceIcons = {
  virtual: Video,
  in_person: MapPin,
  home_visit: House,
  no_preference: Shuffle,
}
