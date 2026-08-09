'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  Loader2,
  User,
  Bell,
  Shield,
  AlertTriangle,
  Camera,
  Mail,
  Phone,
  MessageSquare,
  Briefcase,
  FileText,
  DollarSign,
  Star,
  KeyRound,
  Smartphone,
  Monitor,
  Lock,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

interface ProfileData {
  email: string
  phone: string
  avatar_url: string
}

interface NotificationPreferences {
  email_new_message: boolean
  email_application_update: boolean
  email_contract_update: boolean
  email_payment_update: boolean
  email_review_received: boolean
}

const defaultPreferences: NotificationPreferences = {
  email_new_message: true,
  email_application_update: true,
  email_contract_update: true,
  email_payment_update: true,
  email_review_received: true,
}

const preferenceRows: {
  key: keyof NotificationPreferences
  title: string
  description: string
  icon: React.ElementType
}[] = [
  {
    key: 'email_new_message',
    title: 'New messages',
    description: 'A facility or contractor sends you a direct message.',
    icon: MessageSquare,
  },
  {
    key: 'email_application_update',
    title: 'Application updates',
    description: 'Your application status changes (shortlisted, offered, etc.).',
    icon: Briefcase,
  },
  {
    key: 'email_contract_update',
    title: 'Contract updates',
    description: 'A contract you signed has a status or terms change.',
    icon: FileText,
  },
  {
    key: 'email_payment_update',
    title: 'Payment updates',
    description: 'A payment is processed, released, or disputed.',
    icon: DollarSign,
  },
  {
    key: 'email_review_received',
    title: 'New reviews',
    description: 'A facility leaves you a review after a contract.',
    icon: Star,
  },
]

function initialsFromEmail(email: string): string {
  if (!email) return '?'
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export default function SettingsPage() {
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    email: '',
    phone: '',
    avatar_url: '',
  })
  const [originalEmail, setOriginalEmail] = useState('')
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      if (isDemoMode()) {
        setProfile({
          email: DEMO_CONTRACTOR.email,
          phone: '(310) 555-0142',
          avatar_url: '',
        })
        setOriginalEmail(DEMO_CONTRACTOR.email)
        setLoading(false)
        return
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setProfile({
        email: user.email ?? '',
        phone: user.phone ?? '',
        avatar_url: user.user_metadata?.avatar_url ?? '',
      })
      setOriginalEmail(user.email ?? '')

      const { data: prefData } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (prefData) {
        setPreferences({
          email_new_message: prefData.email_new_message ?? true,
          email_application_update: prefData.email_application_update ?? true,
          email_contract_update: prefData.email_contract_update ?? true,
          email_payment_update: prefData.email_payment_update ?? true,
          email_review_received: prefData.email_review_received ?? true,
        })
      }

      setLoading(false)
    }

    fetchSettings()
  }, [])

  async function handleProfileSave() {
    if (isDemoMode()) {
      toast.success('Profile updated (demo)')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const normalizedEmail = profile.email.trim().toLowerCase()
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail || undefined,
        phone: profile.phone.trim() || undefined,
      })

      if (error) throw error
      if (normalizedEmail !== originalEmail) {
        toast.success(
          'Profile updated. Check your inbox to confirm the new email.',
        )
      } else {
        toast.success('Profile updated successfully')
      }
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_AVATAR_MIME.includes(file.type)) {
      toast.error('Avatar must be a JPG, PNG, WebP, or GIF')
      e.target.value = ''
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Avatar must be 5 MB or smaller')
      e.target.value = ''
      return
    }
    if (isDemoMode()) {
      toast.success('Avatar updated (demo)')
      return
    }

    setAvatarUploading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath)

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })

      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }))
      toast.success('Avatar updated')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handlePreferencesSave() {
    if (isDemoMode()) {
      toast.success('Preferences updated (demo)')
      return
    }
    setSavingPrefs(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: user.id, ...preferences })

      if (error) throw error
      toast.success('Notification preferences updated')
    } catch {
      toast.error('Failed to update preferences')
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()

    if (!currentPassword) {
      toast.error('Please enter your current password')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (isDemoMode()) {
      toast.success('Password changed (demo)')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.email) {
        toast.error('You must be signed in to change your password')
        return
      }

      // Verify the user actually knows the current password before changing it.
      // Without this, a hijacked session can rotate the password and lock out
      // the legitimate owner.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (reauthError) {
        toast.error('Current password is incorrect')
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      toast.success('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  async function handleAccountDelete() {
    const confirmed = window.confirm(
      'This permanently deletes your Sanus account and all related data. This cannot be undone. Continue?',
    )
    if (!confirmed) return

    if (isDemoMode()) {
      toast.success('Account deleted (demo)')
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to delete account')
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('Account deleted')
      router.push('/')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete account'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  function togglePreference(key: keyof NotificationPreferences) {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[#1dbf73]" />
      </div>
    )
  }

  const emailChanged =
    profile.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase()
  const initials = initialsFromEmail(profile.email)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Settings</h1>
        <p className="text-[#62646a]">
          Manage your account, notifications, and security preferences.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="size-4" data-icon="inline-start" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-4" data-icon="inline-start" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="size-4" data-icon="inline-start" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* ====================== Profile ====================== */}
        <TabsContent value="profile">
          <div className="space-y-6">
            {/* Avatar hero */}
            <Card>
              <CardHeader>
                <CardTitle>Profile photo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                  <div className="relative">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt="Avatar"
                        width={96}
                        height={96}
                        className="size-24 rounded-full border border-[#e4e5e7] object-cover"
                        unoptimized
                      />
                    ) : (
                      <Avatar className="size-24 border border-[#e4e5e7]">
                        <AvatarFallback className="bg-[#e8faf1] text-xl font-semibold text-[#0f8f56]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      aria-label="Upload new photo"
                      className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border-2 border-white bg-[#1dbf73] text-white shadow-sm hover:bg-[#19a463] disabled:opacity-60"
                    >
                      {avatarUploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Camera className="size-4" />
                      )}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#404145]">
                      {profile.email || 'Your account'}
                    </p>
                    <p className="text-xs text-[#62646a]">
                      JPG, PNG, WebP, or GIF — up to 5 MB. Square images look
                      best.
                    </p>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAvatarUpload}
                      className="sr-only"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account details */}
            <Card>
              <CardHeader>
                <CardTitle>Account details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b7280]"
                    />
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      className="pl-9"
                    />
                  </div>
                  {emailChanged && (
                    <p className="text-xs text-[#0f8f56]">
                      You&apos;ll get a confirmation link at the new address
                      before the change takes effect.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <div className="relative">
                    <Phone
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b7280]"
                    />
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="(310) 555-0142"
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-[#62646a]">
                    Used for shift reminders and time-sensitive alerts only —
                    never shared with facilities.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleProfileSave}
                    disabled={saving}
                    className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                  >
                    {saving && (
                      <Loader2
                        className="mr-2 size-4 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ====================== Notifications ====================== */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-4 text-[#1dbf73]" />
                Email notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {preferenceRows.map((row) => {
                const Icon = row.icon
                const enabled = preferences[row.key]
                return (
                  <div
                    key={row.key}
                    className="flex items-start justify-between gap-4 border-b border-[#f1f3f5] py-4 last:border-0"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e8faf1]">
                        <Icon className="size-4 text-[#1dbf73]" />
                      </div>
                      <div className="min-w-0">
                        <Label
                          htmlFor={row.key}
                          className="text-sm font-medium text-[#404145]"
                        >
                          {row.title}
                        </Label>
                        <p className="text-xs text-[#62646a]">
                          {row.description}
                        </p>
                      </div>
                    </div>
                    <button
                      id={row.key}
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => togglePreference(row.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        enabled ? 'bg-[#1dbf73]' : 'bg-[#e4e5e7]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0 transition-transform ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handlePreferencesSave}
                  disabled={savingPrefs}
                  className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                >
                  {savingPrefs && (
                    <Loader2
                      className="mr-2 size-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Save preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== Security ====================== */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-4 text-[#1dbf73]" />
                  Change password
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handlePasswordChange}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <div className="relative">
                      <Lock
                        aria-hidden="true"
                        className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b7280]"
                      />
                      <Input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <p className="text-xs text-[#62646a]">
                        At least 8 characters.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                    >
                      {saving && (
                        <Loader2
                          className="mr-2 size-4 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      Update password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* 2FA placeholder — surfaces the work even though it isn't wired
                yet, so users know it's coming. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="size-4 text-[#1dbf73]" />
                  Two-factor authentication
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-[#404145]">
                      Add an extra step at sign-in using an authenticator app.
                    </p>
                    <p className="text-xs text-[#62646a]">
                      Two-factor authentication is coming soon. We&apos;ll
                      notify you when enrollment opens.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Set up
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sessions placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="size-4 text-[#1dbf73]" />
                  Active sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-md border border-[#e4e5e7] bg-[#fafefb] px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#404145]">
                      This device
                    </p>
                    <p className="text-xs text-[#62646a]">
                      Active now · last used just now
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8faf1] px-2 py-0.5 text-xs font-medium text-[#0f8f56]">
                    <span className="size-1.5 rounded-full bg-[#1dbf73]" />
                    Current
                  </span>
                </div>
                <p className="mt-3 text-xs text-[#62646a]">
                  Full session management is coming soon. Until then, you can
                  sign out from any session by signing out and back in.
                </p>
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="border-red-200 bg-red-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="size-4" />
                  Danger zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-700">
                      Delete account
                    </p>
                    <p className="text-sm text-red-700/80">
                      Permanently deletes your account and all data we hold
                      about you, including contracts, payments history,
                      messages, and reviews. Active subscriptions will be
                      canceled. This cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleAccountDelete}
                    disabled={deleting}
                    className="shrink-0"
                  >
                    {deleting && (
                      <Loader2
                        className="mr-2 size-4 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    Delete account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
