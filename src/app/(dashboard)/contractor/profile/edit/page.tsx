'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { US_STATES } from '@/lib/utils/constants'
import { getInitials } from '@/lib/utils/format'
import { normalizeLanguages } from '@/lib/profile/languages'
import { HeadshotUpload } from '@/components/contractor/headshot-upload'
import { LanguagesInput } from '@/components/contractor/languages-input'
import { toast } from 'sonner'
import {
  Loader2,
  ArrowLeft,
  UserRound,
  Languages,
  BriefcaseMedical,
  CircleDollarSign,
  MapPin,
  Check,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

// Broad category picked at /signup/professional (contractor_profiles.professional_category).
const PROFESSIONAL_CATEGORY_LABELS: Record<string, string> = {
  clinical: 'Licensed clinical professional',
  allied: 'Allied or certified health practitioner',
  consultant: 'Healthcare consultant or advisor',
  educator: 'Health educator or trainer',
}

// Keys must match the `contractor_type` Postgres enum
// (20250523000001_create_enums.sql). CONTRACTOR_TYPE_LABELS in
// lib/utils/constants uses different keys (e.g. 'registered_nurse'), which
// the DB rejects, so this page keeps its own enum-aligned list.
const LICENSE_TYPE_LABELS: Record<string, string> = {
  rn: 'Registered Nurse (RN)',
  lpn: 'Licensed Practical Nurse (LPN)',
  cna: 'Certified Nursing Assistant (CNA)',
  np: 'Nurse Practitioner (NP)',
  pa: 'Physician Assistant (PA)',
  md: 'Physician (MD)',
  do: 'Physician (DO)',
  pt: 'Physical Therapist (PT)',
  ot: 'Occupational Therapist (OT)',
  slp: 'Speech-Language Pathologist (SLP)',
  rt: 'Respiratory Therapist (RT)',
  pharm: 'Pharmacist',
  rad_tech: 'Radiology Technologist',
  lab_tech: 'Lab Technician',
  ma: 'Medical Assistant (MA)',
  emt: 'EMT / Paramedic',
  sw: 'Social Worker',
  other: 'Other',
}

interface FormData {
  first_name: string
  last_name: string
  professional_category: string
  contractor_type: string
  headline: string
  bio: string
  specialties: string
  years_of_experience: string
  hourly_rate_min: string
  hourly_rate_max: string
  npi_number: string
  state_license_number: string
  license_state: string
  city: string
  state: string
  zip_code: string
  willing_to_travel: boolean
  travel_radius_miles: string
  is_available: boolean
}

const initialFormData: FormData = {
  first_name: '',
  last_name: '',
  professional_category: '',
  contractor_type: '',
  headline: '',
  bio: '',
  specialties: '',
  years_of_experience: '',
  hourly_rate_min: '',
  hourly_rate_max: '',
  npi_number: '',
  state_license_number: '',
  license_state: '',
  city: '',
  state: '',
  zip_code: '',
  willing_to_travel: false,
  travel_radius_miles: '',
  is_available: true,
}

function calculateCompletion(data: FormData): number {
  const fields = [
    data.first_name,
    data.last_name,
    data.contractor_type,
    data.headline,
    data.bio,
    data.specialties,
    data.years_of_experience,
    data.hourly_rate_min,
    data.hourly_rate_max,
    data.npi_number,
    data.state_license_number,
    data.license_state,
    data.city,
    data.state,
    data.zip_code,
  ]
  const filled = fields.filter((f) => f !== '' && f !== null && f !== undefined).length
  return Math.round((filled / fields.length) * 100)
}

export default function ContractorProfileEditPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>(initialFormData)
  // contractor_profiles.languages (TEXT[])
  const [languages, setLanguages] = useState<string[]>([])
  // profiles.avatar_url — written immediately by <HeadshotUpload>
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      if (isDemoMode()) {
        const data = DEMO_CONTRACTOR
        setFormData({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          contractor_type: data.contractor_type ?? '',
          headline: data.headline ?? '',
          bio: data.bio ?? '',
          specialties: Array.isArray(data.specialties)
            ? data.specialties.join(', ')
            : '',
          years_of_experience: data.years_of_experience?.toString() ?? '',
          hourly_rate_min: data.hourly_rate_min?.toString() ?? '',
          hourly_rate_max: data.hourly_rate_max?.toString() ?? '',
          npi_number: data.npi_number ?? '',
          state_license_number: data.state_license_number ?? '',
          license_state: data.license_state ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zip_code: data.zip_code ?? '',
          willing_to_travel: data.willing_to_travel ?? false,
          travel_radius_miles: data.travel_radius_miles?.toString() ?? '',
          is_available: data.is_available ?? true,
          professional_category: '',
        })
        setLanguages(['English', 'Spanish'])
        setLoading(false)
        return
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('contractor_profiles')
        .select('*, profiles!contractor_profiles_id_fkey(avatar_url)')
        .eq('id', user.id)
        .single()

      if (data) {
        setFormData({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          contractor_type: data.contractor_type ?? '',
          headline: data.headline ?? '',
          bio: data.bio ?? '',
          specialties: Array.isArray(data.specialties)
            ? data.specialties.join(', ')
            : '',
          years_of_experience: data.years_of_experience?.toString() ?? '',
          hourly_rate_min: data.hourly_rate_min?.toString() ?? '',
          hourly_rate_max: data.hourly_rate_max?.toString() ?? '',
          npi_number: data.npi_number ?? '',
          state_license_number: data.state_license_number ?? '',
          license_state: data.license_state ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zip_code: data.zip_code ?? '',
          willing_to_travel: data.willing_to_travel ?? false,
          travel_radius_miles: data.travel_radius_miles?.toString() ?? '',
          is_available: data.is_available ?? true,
          professional_category: data.professional_category ?? '',
        })
        setLanguages(Array.isArray(data.languages) ? data.languages : [])
        const linked = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
        setAvatarUrl(linked?.avatar_url ?? null)
      }

      setLoading(false)
    }

    loadProfile()
  }, [router])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  function handleSelectChange(name: string, value: string | null) {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    if (isDemoMode()) {
      toast.success('Profile updated successfully! (demo mode)')
      router.push('/contractor/profile')
      return
    }

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in to update your profile.')
        return
      }

      const specialtiesArray = formData.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const profileCompletion = calculateCompletion(formData)

      const updatePayload = {
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        professional_category: formData.professional_category || null,
        contractor_type: formData.contractor_type || null,
        headline: formData.headline || null,
        bio: formData.bio || null,
        specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
        years_of_experience: formData.years_of_experience
          ? parseInt(formData.years_of_experience, 10)
          : null,
        hourly_rate_min: formData.hourly_rate_min
          ? parseFloat(formData.hourly_rate_min)
          : null,
        hourly_rate_max: formData.hourly_rate_max
          ? parseFloat(formData.hourly_rate_max)
          : null,
        npi_number: formData.npi_number || null,
        state_license_number: formData.state_license_number || null,
        license_state: formData.license_state || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        willing_to_travel: formData.willing_to_travel,
        travel_radius_miles: formData.travel_radius_miles
          ? parseInt(formData.travel_radius_miles, 10)
          : null,
        is_available: formData.is_available,
        languages: normalizeLanguages(languages),
        profile_completion_pct: profileCompletion,
      }

      const { error } = await supabase
        .from('contractor_profiles')
        .update(updatePayload)
        .eq('id', user.id)

      if (error) {
        toast.error('Failed to update profile: ' + error.message)
      } else {
        toast.success('Profile updated successfully!')
        router.push('/contractor/profile')
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[#62646a]" />
      </div>
    )
  }

  const completion = calculateCompletion(formData)
  const fullName = `${formData.first_name} ${formData.last_name}`.trim()

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        href="/contractor/profile"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to profile
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-[#404145]">Edit profile</h1>
        <p className="mt-1.5 text-base text-[#62646a]">
          Keep your profile current so facilities can match you with the right shifts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8">
        <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Summary + section nav */}
          <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
            <div className="rounded-2xl border border-[#e4e5e7] bg-white p-6">
              <div className="flex items-center gap-4 lg:flex-col lg:text-center">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-full object-cover lg:size-24"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#e8faf1] text-xl font-bold text-[#1dbf73] lg:size-24 lg:text-3xl">
                    {getInitials(formData.first_name, formData.last_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-[#404145]">
                    {fullName || 'Your name'}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-[#62646a]">
                    {formData.headline || 'Add a headline'}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#404145]">Profile strength</span>
                  <span className="font-bold text-[#1dbf73]">{completion}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e4e5e7]">
                  <div
                    className="h-full rounded-full bg-[#1dbf73] transition-all"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>

              <div
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  formData.is_available
                    ? 'bg-[#e8faf1] text-[#0f8f56]'
                    : 'bg-[#f1f1f2] text-[#62646a]'
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    formData.is_available ? 'bg-[#1dbf73]' : 'bg-[#95979d]'
                  }`}
                />
                {formData.is_available ? 'Available for work' : 'Not available'}
              </div>
            </div>

            <nav
              aria-label="Profile sections"
              className="hidden rounded-2xl border border-[#e4e5e7] bg-white p-2 lg:block"
            >
              {SECTIONS.map(({ id, title, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#62646a] transition hover:bg-[#f0faf5] hover:text-[#404145]"
                >
                  <Icon className="size-4 text-[#1dbf73]" />
                  {title}
                </a>
              ))}
            </nav>
          </aside>

          {/* Form sections */}
          <div className="min-w-0 space-y-6">
            <Section
              id="basic"
              icon={UserRound}
              title="Basic info"
              description="How you appear to clients and facilities."
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel>Headshot</FieldLabel>
                  <div className="mt-2">
                    <HeadshotUpload
                      avatarUrl={avatarUrl}
                      initials={getInitials(formData.first_name, formData.last_name)}
                      onUploaded={setAvatarUrl}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="first_name" required>First name</FieldLabel>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="First name"
                    required
                    className={INPUT}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="last_name" required>Last name</FieldLabel>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Last name"
                    required
                    className={INPUT}
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="headline">Headline</FieldLabel>
                  <Input
                    id="headline"
                    name="headline"
                    value={formData.headline}
                    onChange={handleChange}
                    placeholder="e.g., Experienced ICU Nurse"
                    className={INPUT}
                  />
                  <Hint>A short tagline that appears at the top of your profile.</Hint>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="bio">Bio</FieldLabel>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    placeholder="Tell clients about your background, experience, and how you work..."
                    rows={7}
                    className="mt-2 min-h-40 px-3.5 py-3 text-base md:text-[15px]"
                  />
                </div>
              </div>
            </Section>

            <Section
              id="languages"
              icon={Languages}
              title="Languages"
              description="Select every language you can work with clients in."
            >
              <LanguagesInput value={languages} onChange={setLanguages} />
            </Section>

            <Section
              id="professional"
              icon={BriefcaseMedical}
              title="Professional details"
              description="Your license and experience help facilities trust and find you."
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2 xl:col-span-3">
                  <FieldLabel htmlFor="professional_category">Professional category</FieldLabel>
                  <Select
                    items={PROFESSIONAL_CATEGORY_LABELS}
                    value={formData.professional_category}
                    onValueChange={(val) => handleSelectChange('professional_category', val)}
                  >
                    <SelectTrigger id="professional_category" className={SELECT}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROFESSIONAL_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="xl:col-span-2">
                  <FieldLabel htmlFor="contractor_type">License / profession type</FieldLabel>
                  <Select
                    items={LICENSE_TYPE_LABELS}
                    value={formData.contractor_type}
                    onValueChange={(val) => handleSelectChange('contractor_type', val)}
                  >
                    <SelectTrigger id="contractor_type" className={SELECT}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LICENSE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <FieldLabel htmlFor="years_of_experience">Years of experience</FieldLabel>
                  <Input
                    id="years_of_experience"
                    name="years_of_experience"
                    type="number"
                    min="0"
                    value={formData.years_of_experience}
                    onChange={handleChange}
                    placeholder="0"
                    className={INPUT}
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-3">
                  <FieldLabel htmlFor="specialties">Specialties</FieldLabel>
                  <Input
                    id="specialties"
                    name="specialties"
                    value={formData.specialties}
                    onChange={handleChange}
                    placeholder="e.g., ICU, Emergency, Pediatrics"
                    className={INPUT}
                  />
                  <Hint>Separate multiple specialties with commas.</Hint>
                </div>

                <div>
                  <FieldLabel htmlFor="npi_number">NPI number</FieldLabel>
                  <Input
                    id="npi_number"
                    name="npi_number"
                    value={formData.npi_number}
                    onChange={handleChange}
                    placeholder="10-digit NPI number"
                    className={INPUT}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="state_license_number">State license number</FieldLabel>
                  <Input
                    id="state_license_number"
                    name="state_license_number"
                    value={formData.state_license_number}
                    onChange={handleChange}
                    placeholder="License number"
                    className={INPUT}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="license_state">License state</FieldLabel>
                  <Select
                    items={STATE_LABELS}
                    value={formData.license_state}
                    onValueChange={(val) => handleSelectChange('license_state', val)}
                  >
                    <SelectTrigger id="license_state" className={SELECT}>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            <Section
              id="rate"
              icon={CircleDollarSign}
              title="Rate & availability"
              description="Set your hourly range and let facilities know when you can work."
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="hourly_rate_min">Minimum hourly rate</FieldLabel>
                  <MoneyInput
                    id="hourly_rate_min"
                    value={formData.hourly_rate_min}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="hourly_rate_max">Maximum hourly rate</FieldLabel>
                  <MoneyInput
                    id="hourly_rate_max"
                    value={formData.hourly_rate_max}
                    onChange={handleChange}
                  />
                </div>

                <ToggleTile
                  id="is_available"
                  checked={formData.is_available}
                  onChange={handleChange}
                  title="Currently available for work"
                  description="Show up in searches for open shifts."
                />
                <ToggleTile
                  id="willing_to_travel"
                  checked={formData.willing_to_travel}
                  onChange={handleChange}
                  title="Willing to travel"
                  description="Get matched with shifts outside your city."
                />

                {formData.willing_to_travel && (
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="travel_radius_miles">Travel radius (miles)</FieldLabel>
                    <Input
                      id="travel_radius_miles"
                      name="travel_radius_miles"
                      type="number"
                      min="0"
                      value={formData.travel_radius_miles}
                      onChange={handleChange}
                      placeholder="e.g., 50"
                      className={`${INPUT} md:max-w-xs`}
                    />
                  </div>
                )}
              </div>
            </Section>

            <Section
              id="location"
              icon={MapPin}
              title="Location"
              description="Where you're based. Used to match you with nearby work."
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <FieldLabel htmlFor="city">City</FieldLabel>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className={INPUT}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="state">State</FieldLabel>
                  <Select
                    items={STATE_LABELS}
                    value={formData.state}
                    onValueChange={(val) => handleSelectChange('state', val)}
                  >
                    <SelectTrigger id="state" className={SELECT}>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="zip_code">ZIP code</FieldLabel>
                  <Input
                    id="zip_code"
                    name="zip_code"
                    value={formData.zip_code}
                    onChange={handleChange}
                    placeholder="12345"
                    className={INPUT}
                  />
                </div>
              </div>
            </Section>
          </div>
        </div>

        {/* Sticky save bar: negative margins/offsets cancel the dashboard main's p-4 md:p-6 so it sits flush. */}
        <div className="sticky -bottom-4 z-10 -mx-4 mt-8 md:-bottom-6 border-t border-[#e4e5e7] bg-white/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="hidden text-sm text-[#62646a] sm:block">
              Profile <span className="font-semibold text-[#404145]">{completion}%</span> complete
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/contractor/profile" />}
                className="h-11 flex-1 px-6 text-sm font-semibold sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-11 flex-1 bg-[#1dbf73] px-8 text-sm font-semibold text-white hover:bg-[#19a463] sm:flex-none"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save profile'
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

/* ────────── Layout pieces ────────── */

// Lets <SelectValue> show "California" rather than the stored "CA".
const STATE_LABELS: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.value, s.label])
)

const INPUT = 'mt-2 h-11 px-3.5 text-base md:text-[15px]'
const SELECT = 'mt-2 w-full px-3.5 text-[15px] data-[size=default]:h-11'

const SECTIONS: { id: string; title: string; icon: LucideIcon }[] = [
  { id: 'basic', title: 'Basic info', icon: UserRound },
  { id: 'languages', title: 'Languages', icon: Languages },
  { id: 'professional', title: 'Professional details', icon: BriefcaseMedical },
  { id: 'rate', title: 'Rate & availability', icon: CircleDollarSign },
  { id: 'location', title: 'Location', icon: MapPin },
]

function Section({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-6 rounded-2xl border border-[#e4e5e7] bg-white"
    >
      <div className="flex items-start gap-4 border-b border-[#efeff0] px-6 py-5 md:px-8">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e8faf1] text-[#1dbf73]">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 id={`${id}-title`} className="text-lg font-bold text-[#404145]">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-[#62646a]">{description}</p>
        </div>
      </div>
      <div className="px-6 py-6 md:px-8 md:py-7">{children}</div>
    </section>
  )
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-semibold text-[#404145]">
      {children}
      {required && <span className="text-red-600">*</span>}
    </Label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-[#62646a]">{children}</p>
}

function MoneyInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="relative mt-2">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[15px] text-[#62646a]">
        $
      </span>
      <Input
        id={id}
        name={id}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={onChange}
        placeholder="0.00"
        className="h-11 pr-12 pl-8 text-base md:text-[15px]"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-[#95979d]">
        /hr
      </span>
    </div>
  )
}

/**
 * Big clickable card wrapping a native checkbox, styled as a switch. The
 * label is `relative` so the sr-only (absolute) checkbox stays inside it;
 * otherwise focusing it scrolls the dashboard's overflow-hidden shell.
 */
function ToggleTile({
  id,
  checked,
  onChange,
  title,
  description,
}: {
  id: string
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  title: string
  description: string
}) {
  return (
    <label
      htmlFor={id}
      className={`relative flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition has-focus-visible:ring-3 has-focus-visible:ring-[#1dbf73]/30 ${
        checked
          ? 'border-[#1dbf73] bg-[#f0faf5]'
          : 'border-[#e4e5e7] bg-white hover:border-[#bcebd5]'
      }`}
    >
      <span>
        <span className="block text-sm font-semibold text-[#404145]">{title}</span>
        <span className="mt-0.5 block text-xs text-[#62646a]">{description}</span>
      </span>
      <input
        type="checkbox"
        id={id}
        name={id}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-[#1dbf73]' : 'bg-[#d5d6d9]'
        }`}
      >
        <span
          className={`flex size-5 items-center justify-center rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        >
          {checked && <Check className="size-3 text-[#1dbf73]" />}
        </span>
      </span>
    </label>
  )
}
