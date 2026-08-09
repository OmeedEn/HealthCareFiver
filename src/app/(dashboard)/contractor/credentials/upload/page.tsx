'use client'

import { useEffect, useRef, useState } from 'react'
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
import {
  Loader2,
  Upload,
  ArrowLeft,
  FileText,
  X,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Lock,
  Lightbulb,
  FileImage,
  Image as ImageIcon,
} from 'lucide-react'

const MAX_CREDENTIAL_BYTES = 10 * 1024 * 1024
const ALLOWED_CREDENTIAL_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

// Per-credential-type hints shown under the credential type select, so a
// contractor immediately knows what to put in the name/issuer fields.
const TYPE_HINTS: Record<string, { name: string; authority: string }> = {
  license: {
    name: 'e.g., California RN License',
    authority: 'e.g., California Board of Registered Nursing',
  },
  certification: {
    name: 'e.g., BLS, ACLS, PALS, CCRN',
    authority: 'e.g., American Heart Association',
  },
  npi: {
    name: 'NPI (National Provider Identifier)',
    authority: 'CMS',
  },
  dea: {
    name: 'DEA Registration',
    authority: 'U.S. Drug Enforcement Administration',
  },
  background_check: {
    name: 'Background check (within last 12 months)',
    authority: 'e.g., Checkr, Sterling, GoodHire',
  },
  malpractice_insurance: {
    name: 'Professional liability / malpractice policy',
    authority: 'e.g., NSO, Proliability',
  },
  immunization: {
    name: 'Immunization record (Hep B, MMR, Tdap, Flu)',
    authority: 'Issuing physician or clinic',
  },
  tb_test: {
    name: 'TB test result (PPD or QuantiFERON)',
    authority: 'Issuing clinic or lab',
  },
  fit_test: {
    name: 'N95 respirator fit test',
    authority: 'Employer / occupational health',
  },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

export default function CredentialUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [credentialType, setCredentialType] = useState('')
  const [name, setName] = useState('')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [issuedDate, setIssuedDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Generate (and revoke) a blob URL for image previews so we never leak it
  // between selections.
  useEffect(() => {
    if (!file || !isImageMime(file.type)) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const typeHint = credentialType ? TYPE_HINTS[credentialType] : undefined

  function validateAndSet(selected: File | null) {
    if (!selected) {
      setFile(null)
      return
    }
    if (!ALLOWED_CREDENTIAL_MIME.includes(selected.type)) {
      toast.error('File must be a PDF, JPG, PNG, GIF, or WebP')
      setFile(null)
      return
    }
    if (selected.size > MAX_CREDENTIAL_BYTES) {
      toast.error('File must be 10 MB or smaller')
      setFile(null)
      return
    }
    setFile(selected)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    validateAndSet(e.target.files?.[0] ?? null)
  }

  function handleRemoveFile() {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) validateAndSet(dropped)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!credentialType || !name) {
      toast.error('Please fill in the required fields.')
      return
    }

    if (file) {
      if (!ALLOWED_CREDENTIAL_MIME.includes(file.type)) {
        toast.error('File must be a PDF, JPG, PNG, GIF, or WebP')
        return
      }
      if (file.size > MAX_CREDENTIAL_BYTES) {
        toast.error('File must be 10 MB or smaller')
        return
      }
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
        // If the provider was asked for more info, resubmitting a
        // credential puts them back in the admin verification queue.
        fetch('/api/contractor/verification/resubmit', { method: 'POST' }).catch(() => {})
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
    <div className="space-y-6">
      <Link
        href="/contractor/credentials"
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to credentials
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Upload credential</h1>
        <p className="text-[#62646a]">
          Add a professional license, certification, or other credential.
          We&apos;ll verify it and make it visible to facilities once approved.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Credential information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="credential_type">
                  Credential type <span className="text-red-600">*</span>
                </Label>
                <Select
                  value={credentialType}
                  onValueChange={(v) => setCredentialType(v ?? '')}
                >
                  <SelectTrigger id="credential_type" className="w-full">
                    <SelectValue placeholder="Select credential type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CREDENTIAL_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Credential name <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    typeHint?.name ?? 'e.g., California RN License'
                  }
                  required
                />
                {typeHint && (
                  <p className="text-xs text-[#62646a]">{typeHint.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="issuing_authority">Issuing authority</Label>
                <Input
                  id="issuing_authority"
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  placeholder={
                    typeHint?.authority ??
                    'e.g., California Board of Registered Nursing'
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="license_number">
                  License / certificate number
                </Label>
                <Input
                  id="license_number"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="Number on the credential, if any"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="issued_date">Issued date</Label>
                  <Input
                    id="issued_date"
                    type="date"
                    value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiration_date">Expiration date</Label>
                  <Input
                    id="expiration_date"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supporting document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileInputRef}
                id="document"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFileSelect}
                className="sr-only"
              />

              {file ? (
                <div className="flex items-center gap-4 rounded-lg border border-[#bcebd5] bg-[#e8faf1] p-4">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Document preview"
                      className="size-20 shrink-0 rounded-md border border-[#bcebd5] bg-white object-cover"
                    />
                  ) : (
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-md border border-[#bcebd5] bg-white">
                      {isImageMime(file.type) ? (
                        <ImageIcon className="size-8 text-[#0f8f56]" />
                      ) : (
                        <FileText className="size-8 text-[#0f8f56]" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#404145]">
                      {file.name}
                    </p>
                    <p className="text-xs text-[#62646a]">
                      {formatFileSize(file.size)} ·{' '}
                      {file.type.split('/')[1].toUpperCase()}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-[#0f8f56]">
                      <CheckCircle2 className="size-3.5" />
                      Ready to upload
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleRemoveFile}
                    aria-label="Remove file"
                    className="shrink-0"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="document"
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                    dragOver
                      ? 'border-[#1dbf73] bg-[#e8faf1]'
                      : 'border-[#e4e5e7] hover:border-[#1dbf73] hover:bg-[#fafefb]'
                  }`}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                    <Upload className="size-6 text-[#1dbf73]" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#404145]">
                    Drag and drop, or click to browse
                  </p>
                  <p className="mt-1 text-sm text-[#62646a]">
                    PDF, PNG, JPG, GIF, or WebP — up to 10 MB
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-[#6b7280]">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3.5" />
                      PDF
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileImage className="size-3.5" />
                      Image
                    </span>
                  </div>
                </label>
              )}

              <p className="text-xs text-[#6b7280]">
                A clear scan or photo with all four corners visible speeds up
                verification.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              render={<Link href="/contractor/credentials" />}
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
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Submit for review
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-[#1dbf73]" />
                How verification works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  step: 1,
                  title: 'You submit',
                  body: 'Upload a clear scan or photo of the credential.',
                },
                {
                  step: 2,
                  title: 'We verify',
                  body: 'Our team reviews within 24–48 business hours.',
                },
                {
                  step: 3,
                  title: 'Visible on your profile',
                  body: 'Approved credentials show on your profile and unlock matching jobs.',
                },
              ].map((s) => (
                <div key={s.step} className="flex gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e8faf1] text-xs font-semibold text-[#0f8f56]">
                    {s.step}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#404145]">
                      {s.title}
                    </p>
                    <p className="text-xs text-[#62646a]">{s.body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="size-4 text-[#1dbf73]" />
                Tips for fast approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-[#62646a]">
                {[
                  'Use a flat, well-lit surface — no glare.',
                  'Make sure expiration date is readable.',
                  'Include all four corners of the document.',
                  'PDFs from the issuing authority are preferred.',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#1dbf73]" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-[#1dbf73]" />
                Common credentials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-[#62646a]">
                <li>State nursing or medical license</li>
                <li>BLS / ACLS / PALS certifications</li>
                <li>NPI number</li>
                <li>Background check (within 12 months)</li>
                <li>Immunization record</li>
                <li>TB test (within 12 months)</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-[#bcebd5] bg-[#e8faf1]">
            <CardContent className="flex items-start gap-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-[#0f8f56]" />
              <p className="text-xs text-[#0f8f56]">
                Documents are private. Only our verification team can view the
                file you upload — facilities only see the credential name and
                status.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
