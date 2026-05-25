'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CREDENTIAL_TYPE_LABELS } from '@/lib/utils/constants'
import { toast } from 'sonner'
import { Loader2, Upload, ArrowLeft } from 'lucide-react'

export default function CredentialUploadPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [credentialType, setCredentialType] = useState('')
  const [name, setName] = useState('')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [issuedDate, setIssuedDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!credentialType || !name) {
      toast.error('Please fill in the required fields.')
      return
    }

    setSaving(true)

    if (isDemoMode()) {
      toast.success('Credential uploaded successfully! (demo mode)')
      router.push('/contractor/credentials')
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

      let documentUrl: string | null = null
      let documentFilename: string | null = null

      // Upload file to Supabase Storage if provided
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('credentials')
          .upload(filePath, file)

        if (uploadError) {
          toast.error('Failed to upload file: ' + uploadError.message)
          setSaving(false)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('credentials').getPublicUrl(filePath)

        documentUrl = publicUrl
        documentFilename = file.name
      }

      // Create credential record
      const { error } = await supabase.from('credentials').insert({
        contractor_id: user.id,
        credential_type: credentialType,
        name,
        issuing_authority: issuingAuthority || null,
        license_number: licenseNumber || null,
        issued_date: issuedDate || null,
        expiration_date: expirationDate || null,
        status: 'pending_review',
        document_url: documentUrl,
        document_filename: documentFilename,
      })

      if (error) {
        toast.error('Failed to save credential: ' + error.message)
      } else {
        toast.success('Credential uploaded successfully!')
        router.push('/contractor/credentials')
      }
    } catch (err) {
      toast.error('An unexpected error occurred.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/contractor/credentials" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-bold">Upload Credential</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Credential Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credential_type">
                Credential Type <span className="text-destructive">*</span>
              </Label>
              <Select value={credentialType} onValueChange={(v) => setCredentialType(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select credential type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CREDENTIAL_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Credential Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., California RN License"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuing_authority">Issuing Authority</Label>
              <Input
                id="issuing_authority"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="e.g., California Board of Registered Nursing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="license_number">License / Certificate Number</Label>
              <Input
                id="license_number"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="License or certificate number"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issued_date">Issued Date</Label>
                <Input
                  id="issued_date"
                  type="date"
                  value={issuedDate}
                  onChange={(e) => setIssuedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiration_date">Expiration Date</Label>
                <Input
                  id="expiration_date"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document">Document (PDF or Image)</Label>
              <Input
                id="document"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Upload a PDF or image of your credential. Max file size: 10MB.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" type="button" render={<Link href="/contractor/credentials" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            ) : (
              <Upload className="size-4" data-icon="inline-start" />
            )}
            {saving ? 'Uploading...' : 'Upload Credential'}
          </Button>
        </div>
      </form>
    </div>
  )
}
