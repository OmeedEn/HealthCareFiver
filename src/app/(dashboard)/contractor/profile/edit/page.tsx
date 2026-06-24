'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { CONTRACTOR_TYPE_LABELS, US_STATES } from '@/lib/utils/constants'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface FormData {
  first_name: string
  last_name: string
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
        })
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
        .select('*')
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
        })
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/contractor/profile"
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to profile
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Edit Profile</h1>
        <p className="text-[#62646a]">
          Keep your profile current so facilities can match you with the right shifts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Basic info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="first_name">
                  First name <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="First name"
                  required
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="last_name">
                  Last name <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Last name"
                  required
                  className="mt-2"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  name="headline"
                  value={formData.headline}
                  onChange={handleChange}
                  placeholder="e.g., Experienced ICU Nurse"
                  className="mt-2"
                />
                <p className="mt-1 text-xs text-[#62646a]">
                  A short tagline that appears at the top of your profile.
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Tell facilities about your experience and skills..."
                  rows={5}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Professional details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contractor_type">Contractor type</Label>
                <Select
                  value={formData.contractor_type}
                  onValueChange={(val) => handleSelectChange('contractor_type', val)}
                >
                  <SelectTrigger id="contractor_type" className="mt-2 w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACTOR_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="years_of_experience">Years of experience</Label>
                <Input
                  id="years_of_experience"
                  name="years_of_experience"
                  type="number"
                  min="0"
                  value={formData.years_of_experience}
                  onChange={handleChange}
                  placeholder="0"
                  className="mt-2"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  name="specialties"
                  value={formData.specialties}
                  onChange={handleChange}
                  placeholder="e.g., ICU, Emergency, Pediatrics"
                  className="mt-2"
                />
                <p className="mt-1 text-xs text-[#62646a]">
                  Separate multiple specialties with commas.
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="npi_number">NPI number</Label>
                <Input
                  id="npi_number"
                  name="npi_number"
                  value={formData.npi_number}
                  onChange={handleChange}
                  placeholder="10-digit NPI number"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="state_license_number">State license number</Label>
                <Input
                  id="state_license_number"
                  name="state_license_number"
                  value={formData.state_license_number}
                  onChange={handleChange}
                  placeholder="License number"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="license_state">License state</Label>
                <Select
                  value={formData.license_state}
                  onValueChange={(val) => handleSelectChange('license_state', val)}
                >
                  <SelectTrigger id="license_state" className="mt-2 w-full">
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
          </CardContent>
        </Card>

        {/* Rate & availability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Rate & availability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="hourly_rate_min">Min hourly rate ($)</Label>
                <Input
                  id="hourly_rate_min"
                  name="hourly_rate_min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.hourly_rate_min}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="hourly_rate_max">Max hourly rate ($)</Label>
                <Input
                  id="hourly_rate_max"
                  name="hourly_rate_max"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.hourly_rate_max}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>

              <div className="sm:col-span-2">
                <Separator />
              </div>

              <div className="sm:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_available"
                  name="is_available"
                  checked={formData.is_available}
                  onChange={handleChange}
                  className="size-4 rounded border-input accent-[#1dbf73]"
                />
                <Label htmlFor="is_available" className="font-normal text-[#404145]">
                  Currently available for work
                </Label>
              </div>

              <div className="sm:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="willing_to_travel"
                  name="willing_to_travel"
                  checked={formData.willing_to_travel}
                  onChange={handleChange}
                  className="size-4 rounded border-input accent-[#1dbf73]"
                />
                <Label htmlFor="willing_to_travel" className="font-normal text-[#404145]">
                  Willing to travel
                </Label>
              </div>

              {formData.willing_to_travel && (
                <div className="sm:col-span-2">
                  <Label htmlFor="travel_radius_miles">Travel radius (miles)</Label>
                  <Input
                    id="travel_radius_miles"
                    name="travel_radius_miles"
                    type="number"
                    min="0"
                    value={formData.travel_radius_miles}
                    onChange={handleChange}
                    placeholder="e.g., 50"
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Select
                  value={formData.state}
                  onValueChange={(val) => handleSelectChange('state', val)}
                >
                  <SelectTrigger id="state" className="mt-2 w-full">
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
                <Label htmlFor="zip_code">ZIP code</Label>
                <Input
                  id="zip_code"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleChange}
                  placeholder="12345"
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 border-t border-[#e5e7eb] bg-white px-4 sm:px-6 py-3 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            render={<Link href="/contractor/profile" />}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Profile'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
