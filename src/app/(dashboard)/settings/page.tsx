'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, User, Bell, Shield, AlertTriangle } from 'lucide-react'
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

const preferenceLabels: Record<keyof NotificationPreferences, string> = {
  email_new_message: 'New messages',
  email_application_update: 'Application updates',
  email_contract_update: 'Contract updates',
  email_payment_update: 'Payment updates',
  email_review_received: 'New reviews',
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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

  useEffect(() => {
    async function fetchSettings() {
      if (isDemoMode()) {
        setProfile({
          email: DEMO_CONTRACTOR.email,
          phone: '(310) 555-0142',
          avatar_url: '',
        })
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

  function getSupabase() {
    return createClient()
  }

  async function handleProfileSave() {
    if (isDemoMode()) { toast.success('Profile updated (demo)'); return }
    setSaving(true)
    try {
      const supabase = getSupabase()
      const normalizedEmail = profile.email.trim().toLowerCase()
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail || undefined,
        phone: profile.phone.trim() || undefined,
      })

      if (error) throw error
      if (normalizedEmail !== originalEmail) {
        toast.success(
          'Profile updated. Check your inbox to confirm the new email.'
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
    if (isDemoMode()) { toast.success('Avatar updated (demo)'); return }

    try {
      const supabase = getSupabase()
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
    }
  }

  async function handlePreferencesSave() {
    if (isDemoMode()) { toast.success('Preferences updated (demo)'); return }
    setSaving(true)
    try {
      const supabase = getSupabase()
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
      setSaving(false)
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

    if (isDemoMode()) { toast.success('Password changed (demo)'); return }
    setSaving(true)
    try {
      const supabase = getSupabase()
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
      'This permanently deletes your HealthGig account and all related data. This cannot be undone. Continue?'
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
      const supabase = getSupabase()
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
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

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

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar">Avatar</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                />
                {profile.avatar_url && (
                  <Image
                    src={profile.avatar_url}
                    alt="Avatar"
                    width={64}
                    height={64}
                    className="mt-2 size-16 rounded-full object-cover"
                    unoptimized
                  />
                )}
              </div>

              <Separator />

              <Button onClick={handleProfileSave} disabled={saving}>
                {saving && (
                  <Loader2
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                )}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                Object.entries(preferenceLabels) as [
                  keyof NotificationPreferences,
                  string,
                ][]
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key}>{label}</Label>
                  <button
                    id={key}
                    type="button"
                    role="switch"
                    aria-checked={preferences[key]}
                    onClick={() => togglePreference(key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      preferences[key] ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        preferences[key] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}

              <Separator />

              <Button onClick={handlePreferencesSave} disabled={saving}>
                {saving && (
                  <Loader2
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                )}
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Separator />

                <Button type="submit" disabled={saving}>
                  {saving && (
                    <Loader2
                      className="size-4 animate-spin"
                      data-icon="inline-start"
                    />
                  )}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6 border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" />
                Delete Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data we hold about you,
                including contracts, payments history, messages, and reviews.
                Active subscriptions will be canceled. This cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={handleAccountDelete}
                disabled={deleting}
              >
                {deleting && (
                  <Loader2
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                )}
                Delete My Account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
