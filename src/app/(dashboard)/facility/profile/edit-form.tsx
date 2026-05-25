'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
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
import { FACILITY_TYPE_LABELS, US_STATES } from '@/lib/utils/constants'
import { toast } from 'sonner'
import { Loader2, Save, Pencil, X } from 'lucide-react'

interface FacilityProfile {
  id: string
  facility_name: string
  facility_type: string
  description: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  ein: string | null
  average_rating: number | null
  total_reviews: number | null
  is_verified: boolean
}

interface FacilityProfileEditFormProps {
  facility: FacilityProfile | null
}

export function FacilityProfileEditForm({ facility }: FacilityProfileEditFormProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(!facility)
  const [saving, setSaving] = useState(false)

  const [facilityName, setFacilityName] = useState(facility?.facility_name ?? '')
  const [facilityType, setFacilityType] = useState(facility?.facility_type ?? '')
  const [description, setDescription] = useState(facility?.description ?? '')
  const [website, setWebsite] = useState(facility?.website ?? '')
  const [addressLine1, setAddressLine1] = useState(facility?.address_line1 ?? '')
  const [addressLine2, setAddressLine2] = useState(facility?.address_line2 ?? '')
  const [city, setCity] = useState(facility?.city ?? '')
  const [state, setState] = useState(facility?.state ?? '')
  const [zipCode, setZipCode] = useState(facility?.zip_code ?? '')
  const [phone, setPhone] = useState(facility?.phone ?? '')
  const [contactName, setContactName] = useState(facility?.contact_name ?? '')
  const [contactTitle, setContactTitle] = useState(facility?.contact_title ?? '')
  const [contactEmail, setContactEmail] = useState(facility?.contact_email ?? '')
  const [ein, setEin] = useState(facility?.ein ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!facilityName || !facilityType) {
      toast.error('Facility name and type are required.')
      return
    }

    setSaving(true)

    if (isDemoMode()) {
      toast.success('Facility profile saved! (demo mode)')
      setEditing(false)
      setSaving(false)
      return
    }

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in.')
        return
      }

      const payload = {
        facility_name: facilityName,
        facility_type: facilityType,
        description: description || null,
        website: website || null,
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        phone: phone || null,
        contact_name: contactName || null,
        contact_title: contactTitle || null,
        contact_email: contactEmail || null,
        ein: ein || null,
      }

      let error
      if (facility) {
        ;({ error } = await supabase
          .from('facility_profiles')
          .update(payload)
          .eq('id', user.id))
      } else {
        ;({ error } = await supabase
          .from('facility_profiles')
          .insert({ id: user.id, ...payload }))
      }

      if (error) {
        toast.error('Failed to save profile: ' + error.message)
      } else {
        toast.success('Facility profile saved!')
        setEditing(false)
        router.refresh()
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-4" data-icon="inline-start" />
          Edit Profile
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {facility ? 'Edit Facility Profile' : 'Create Facility Profile'}
            </CardTitle>
            {facility && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditing(false)}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="facility_name">
                Facility Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="facility_name"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="Facility name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility_type">
                Facility Type <span className="text-destructive">*</span>
              </Label>
              <Select value={facilityType} onValueChange={(v) => setFacilityType(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FACILITY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your facility..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ein">EIN</Label>
            <Input
              id="ein"
              value={ein}
              onChange={(e) => setEin(e.target.value)}
              placeholder="XX-XXXXXXX"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input
              id="address_line1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Street address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input
              id="address_line2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Suite, unit, etc."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select value={state} onValueChange={(v) => setState(v ?? '')}>
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
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="12345"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Person</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Name</Label>
              <Input
                id="contact_name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_title">Title</Label>
              <Input
                id="contact_title"
                value={contactTitle}
                onChange={(e) => setContactTitle(e.target.value)}
                placeholder="e.g., HR Manager"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@example.com"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {facility && (
          <Button variant="outline" type="button" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
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
  )
}
