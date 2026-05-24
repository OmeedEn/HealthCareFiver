'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
import { Loader2, Save, ArrowLeft } from 'lucide-react'
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
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/contractor/profile" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-bold">Edit Profile</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="First name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor_type">Contractor Type</Label>
              <Select
                value={formData.contractor_type}
                onValueChange={(val) => handleSelectChange('contractor_type', val)}
              >
                <SelectTrigger className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                name="headline"
                value={formData.headline}
                onChange={handleChange}
                placeholder="e.g., Experienced ICU Nurse"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell facilities about your experience and skills..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialties">Specialties</Label>
              <Input
                id="specialties"
                name="specialties"
                value={formData.specialties}
                onChange={handleChange}
                placeholder="e.g., ICU, Emergency, Pediatrics (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple specialties with commas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="years_of_experience">Years of Experience</Label>
              <Input
                id="years_of_experience"
                name="years_of_experience"
                type="number"
                min="0"
                value={formData.years_of_experience}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Compensation */}
        <Card>
          <CardHeader>
            <CardTitle>Compensation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hourly_rate_min">Min Hourly Rate ($)</Label>
                <Input
                  id="hourly_rate_min"
                  name="hourly_rate_min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.hourly_rate_min}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly_rate_max">Max Hourly Rate ($)</Label>
                <Input
                  id="hourly_rate_max"
                  name="hourly_rate_max"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.hourly_rate_max}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* License Information */}
        <Card>
          <CardHeader>
            <CardTitle>License Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="npi_number">NPI Number</Label>
              <Input
                id="npi_number"
                name="npi_number"
                value={formData.npi_number}
                onChange={handleChange}
                placeholder="10-digit NPI number"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="state_license_number">State License Number</Label>
                <Input
                  id="state_license_number"
                  name="state_license_number"
                  value={formData.state_license_number}
                  onChange={handleChange}
                  placeholder="License number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_state">License State</Label>
                <Select
                  value={formData.license_state}
                  onValueChange={(val) => handleSelectChange('license_state', val)}
                >
                  <SelectTrigger className="w-full">
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

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={formData.state}
                  onValueChange={(val) => handleSelectChange('state', val)}
                >
                  <SelectTrigger className="w-full">
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
              <div className="space-y-2">
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleChange}
                  placeholder="12345"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Availability & Travel */}
        <Card>
          <CardHeader>
            <CardTitle>Availability & Travel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_available"
                name="is_available"
                checked={formData.is_available}
                onChange={handleChange}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="is_available">Currently available for work</Label>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="willing_to_travel"
                name="willing_to_travel"
                checked={formData.willing_to_travel}
                onChange={handleChange}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="willing_to_travel">Willing to travel</Label>
            </div>

            {formData.willing_to_travel && (
              <div className="space-y-2">
                <Label htmlFor="travel_radius_miles">Travel Radius (miles)</Label>
                <Input
                  id="travel_radius_miles"
                  name="travel_radius_miles"
                  type="number"
                  min="0"
                  value={formData.travel_radius_miles}
                  onChange={handleChange}
                  placeholder="e.g., 50"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" type="button" render={<Link href="/contractor/profile" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            ) : (
              <Save className="size-4" data-icon="inline-start" />
            )}
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  )
}
