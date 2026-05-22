import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Camera,
  CheckCircle2,
  Copy,
  Crop,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  Save,
  Settings2,
  Shield,
  User,
  ZoomIn,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/app/store/auth-store'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchableSelectPopover } from '@/components/shared/searchable-select-popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { authApi } from '@/lib/api/modules/auth-api'
import { storageApi } from '@/lib/api/modules/storage-api'
import { userApi } from '@/lib/api/modules/user-api'
import { queryKeys } from '@/lib/api/query-keys'
import type { UserSecure } from '@/types/domain'

interface ProfileFormState {
  firstName: string
  lastName: string
  nickname: string
  phoneNumber: string
  biography: string
  city: string
  nationality: string
  avatarUrl: string
  email: string
}

function mapUserToForm(user: UserSecure): ProfileFormState {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    nickname: user.nickname ?? '',
    phoneNumber: user.phoneNumber ?? '',
    biography: user.biography ?? '',
    city: user.city ?? '',
    nationality: user.nationality ?? '',
    avatarUrl: user.avatarUrl ?? '',
    email: user.email ?? '',
  }
}

function buildInitials(firstName: string, lastName: string) {
  const first = firstName.trim().charAt(0).toUpperCase()
  const last = lastName.trim().charAt(0).toUpperCase()
  return `${first}${last}`.trim() || 'U'
}

const EMAIL_PATTERN = /^[\w._%+-]+@(gmail\.com|yopmail\.com)$/i
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
const AVATAR_CROP_CONTEXT_ERROR = 'AVATAR_CROP_CONTEXT_ERROR'
const AVATAR_CROP_EMPTY_ERROR = 'AVATAR_CROP_EMPTY_ERROR'

// ─── Image crop helpers ───

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (e) => reject(e))
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation = 0): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(AVATAR_CROP_CONTEXT_ERROR)

  const maxSize = Math.max(image.width, image.height)
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2))
  canvas.width = safeArea
  canvas.height = safeArea

  ctx.translate(safeArea / 2, safeArea / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-safeArea / 2, -safeArea / 2)
  ctx.drawImage(image, safeArea / 2 - image.width / 2, safeArea / 2 - image.height / 2)

  const data = ctx.getImageData(0, 0, safeArea, safeArea)
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.putImageData(
    data,
    0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
    0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(AVATAR_CROP_EMPTY_ERROR))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.92,
    )
  })
}

// ─── Country/City API types ───

interface CountryOption {
  name: string
  flag: string
}

async function fetchCountries(): Promise<CountryOption[]> {
  const res = await fetch('https://restcountries.com/v3.1/all?fields=name,flags')
  if (!res.ok) throw new Error('Failed to fetch countries')
  const data = (await res.json()) as Array<{ name: { common: string }; flags: { svg: string; png: string } }>
  return data
    .map((c) => ({ name: c.name.common, flag: c.flags.svg || c.flags.png }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function fetchCities(countryName: string): Promise<string[]> {
  const res = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: countryName }),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { error: boolean; data: string[] }
  if (data.error) return []
  return data.data.sort((a, b) => a.localeCompare(b))
}

export function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const currentUser = useAuthStore((state) => state.currentUser)
  const accessToken = useAuthStore((state) => state.accessToken)
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)

  const [activeTab, setActiveTab] = useState<'profile' | 'email' | 'password'>('profile')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  // ─── Image crop state ───
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const [profileForm, setProfileForm] = useState<ProfileFormState>(() =>
    mapUserToForm(
      currentUser ?? {
        userId: '',
        email: '',
        firstName: '',
        lastName: '',
      },
    ),
  )

  const [newEmail, setNewEmail] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  })

  const profileQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.getAccount,
    staleTime: 60_000,
  })

  const countriesQuery = useQuery({
    queryKey: ['external', 'countries'],
    queryFn: fetchCountries,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })

  const citiesQuery = useQuery({
    queryKey: ['external', 'cities', profileForm.nationality],
    queryFn: () => fetchCities(profileForm.nationality),
    enabled: Boolean(profileForm.nationality),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  useEffect(() => {
    const source = profileQuery.data ?? currentUser
    if (!source) {
      return
    }

    setProfileForm(mapUserToForm(source))
    setNewEmail('')
  }, [currentUser, profileQuery.data])

  const profileValidationError = useMemo(() => {
    if (profileForm.firstName.trim().length < 2) {
      return t('profile.validation.firstNameMin')
    }

    if (profileForm.lastName.trim().length < 2) {
      return t('profile.validation.lastNameMin')
    }

    if (profileForm.nickname.trim().length === 1) {
      return t('profile.validation.nicknameMin')
    }

    return null
  }, [profileForm.firstName, profileForm.lastName, profileForm.nickname, t])

  const emailValidationError = useMemo(() => {
    const trimmed = newEmail.trim()
    if (!trimmed) {
      return t('profile.validation.newEmailRequired')
    }

    if (!EMAIL_PATTERN.test(trimmed)) {
      return t('profile.validation.newEmailDomain')
    }

    if (trimmed.toLowerCase() === profileForm.email.trim().toLowerCase()) {
      return t('profile.validation.newEmailDifferent')
    }

    return null
  }, [newEmail, profileForm.email, t])

  const passwordValidationError = useMemo(() => {
    if (!passwordForm.currentPassword.trim()) {
      return t('profile.validation.currentPasswordRequired')
    }

    if (!STRONG_PASSWORD_PATTERN.test(passwordForm.newPassword)) {
      return t('profile.validation.newPasswordStrength')
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return t('profile.validation.confirmPasswordMismatch')
    }

    return null
  }, [passwordForm, t])

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      userApi.updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        nickname: profileForm.nickname.trim() || undefined,
        avatarUrl: profileForm.avatarUrl.trim() || undefined,
        biography: profileForm.biography.trim() || undefined,
        city: profileForm.city.trim() || undefined,
        nationality: profileForm.nationality.trim() || undefined,
      }),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(queryKeys.auth.me, updatedUser)
      if (accessToken) {
        setSession({
          accessToken,
          currentUser: updatedUser,
        })
      }
      toast.success(t('profile.toast.updateSuccess'))
    },
    onError: (error: Error) => {
      toast.error(t('profile.toast.updateFailed'), { description: error.message })
    },
  })

  const updateEmailMutation = useMutation({
    mutationFn: () =>
      userApi.updateEmail({
        newEmail: newEmail.trim(),
      }),
    onSuccess: (message) => {
      setPendingEmail(newEmail.trim())
      setNewEmail('')
      toast.success(t('profile.toast.emailRequestSuccess'), { description: message })
    },
    onError: (error: Error) => {
      toast.error(t('profile.toast.emailRequestFailed'), { description: error.message })
    },
  })

  const updatePasswordMutation = useMutation({
    mutationFn: () =>
      userApi.updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      }),
    onSuccess: () => {
      toast.success(t('profile.toast.passwordUpdateSuccess'))
      clearSession()
      navigate('/login', { replace: true })
    },
    onError: (error: Error) => {
      toast.error(t('profile.toast.passwordUpdateFailed'), { description: error.message })
    },
  })

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error(t('profile.toast.avatarInvalidType'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.toast.avatarTooLarge'))
      return
    }

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setRawImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
      setCropDialogOpen(true)
    })
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return
    setAvatarUploading(true)
    try {
      const blob = await getCroppedImg(rawImageSrc, croppedAreaPixels, rotation)
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      const uploaded = await storageApi.uploadSingle(file, 'user-avatars')
      setProfileForm((prev) => ({ ...prev, avatarUrl: uploaded.fileUrl }))
      setCropDialogOpen(false)
      setRawImageSrc(null)
      toast.success(t('profile.toast.avatarUpdated'))
    } catch (error) {
      const description =
        error instanceof Error &&
        error.message &&
        error.message !== AVATAR_CROP_CONTEXT_ERROR &&
        error.message !== AVATAR_CROP_EMPTY_ERROR
          ? error.message
          : t('profile.toast.avatarUploadFallback')
      toast.error(t('profile.toast.avatarUploadFailed'), { description })
    } finally {
      setAvatarUploading(false)
    }
  }

  const loadedUser = profileQuery.data ?? currentUser
  const handleCopyUserId = useCallback(() => {
    if (!loadedUser?.userId) return
    void navigator.clipboard.writeText(loadedUser.userId)
    toast.success(t('profile.toast.userIdCopied'))
  }, [loadedUser?.userId, t])
  if (!loadedUser && profileQuery.isLoading) {
    return <LoadingPanel />
  }

  if (!loadedUser) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-sm text-muted-foreground">{t('profile.loadFailed')}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-primary/10 via-background to-sky-500/10 p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative flex flex-col gap-4 sm:flex-row sm:items-center"
        >
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <User className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('profile.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('profile.description')}</p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="grid gap-3 md:grid-cols-3"
      >
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-md bg-sky-500/10 p-2 text-sky-600">
              <User className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('profile.cards.personalTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.cards.personalDescription')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600">
              <Settings2 className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('profile.cards.emailTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.cards.emailDescription')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-md bg-amber-500/10 p-2 text-amber-600">
              <Shield className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('profile.cards.securityTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.cards.securityDescription')}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'profile' | 'email' | 'password')}>
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="profile" className="justify-start gap-1.5 sm:justify-center">
            <User className="size-4" />
            {t('profile.tabs.profile')}
          </TabsTrigger>
          <TabsTrigger value="email" className="justify-start gap-1.5 sm:justify-center">
            <Mail className="size-4" />
            {t('profile.tabs.email')}
          </TabsTrigger>
          <TabsTrigger value="password" className="justify-start gap-1.5 sm:justify-center">
            <Lock className="size-4" />
            {t('profile.tabs.password')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.sections.profileTitle')}</CardTitle>
              <CardDescription>{t('profile.sections.profileDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center">
                <div className="relative inline-flex">
                  <Avatar className="h-18 w-18">
                    <AvatarImage src={profileForm.avatarUrl} alt={`${profileForm.firstName} ${profileForm.lastName}`} />
                    <AvatarFallback className="text-sm font-semibold text-primary">
                      {buildInitials(profileForm.firstName, profileForm.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100 disabled:pointer-events-none"
                    title={t('profile.changeAvatar')}
                  >
                    <Camera className="size-5 text-white" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {profileForm.firstName} {profileForm.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{profileForm.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('profile.labels.avatarHelp')}</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  {t('profile.changeAvatar')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleAvatarFileChange}
                />
              </div>

              <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t('profile.labels.userId')}</p>
                  <p className="truncate text-sm font-medium">{loadedUser.userId}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleCopyUserId}>
                  <Copy className="size-3.5" />
                  {t('profile.actions.copyUserId')}
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-first-name">{t('profile.labels.firstName')}</Label>
                  <Input
                    id="profile-first-name"
                    value={profileForm.firstName}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-last-name">{t('profile.labels.lastName')}</Label>
                  <Input
                    id="profile-last-name"
                    value={profileForm.lastName}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-nickname">{t('profile.labels.nickname')}</Label>
                  <Input
                    id="profile-nickname"
                    value={profileForm.nickname}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, nickname: event.target.value }))}
                    placeholder={t('profile.placeholders.nickname')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-phone">{t('profile.labels.phoneNumber')}</Label>
                  <Input id="profile-phone" value={profileForm.phoneNumber} disabled readOnly />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-nationality">{t('profile.labels.nationality')}</Label>
                  <SearchableSelectPopover
                    value={profileForm.nationality || undefined}
                    options={(countriesQuery.data ?? []).map((country) => ({
                      value: country.name,
                      label: country.name,
                      prefix: country.flag ? (
                        <img src={country.flag} alt="" className="size-4 rounded-xs object-cover" loading="lazy" />
                      ) : null,
                    }))}
                    placeholder={countriesQuery.isLoading ? t('common.loading') : t('profile.placeholders.nationality')}
                    searchPlaceholder={t('profile.placeholders.nationalitySearch')}
                    emptyLabel={t('profile.placeholders.nationalityEmpty')}
                    onValueChange={(nextValue) =>
                      setProfileForm((prev) => ({ ...prev, nationality: nextValue, city: '' }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-city">
                    {t('profile.labels.city')}
                    {!profileForm.nationality && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({t('profile.labels.selectNationalityFirst')})
                      </span>
                    )}
                  </Label>
                  <SearchableSelectPopover
                    value={profileForm.city || undefined}
                    options={(citiesQuery.data ?? []).map((city) => ({
                      value: city,
                      label: city,
                      description: profileForm.nationality || undefined,
                    }))}
                    placeholder={
                      citiesQuery.isLoading ? t('profile.placeholders.cityLoading') : t('profile.placeholders.city')
                    }
                    searchPlaceholder={t('profile.placeholders.citySearch')}
                    emptyLabel={
                      profileForm.nationality
                        ? t('profile.placeholders.cityEmpty')
                        : t('profile.placeholders.citySelectNationality')
                    }
                    disabled={!profileForm.nationality}
                    onValueChange={(nextValue) => setProfileForm((prev) => ({ ...prev, city: nextValue }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-biography">{t('profile.labels.biography')}</Label>
                <Textarea
                  id="profile-biography"
                  value={profileForm.biography}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, biography: event.target.value }))}
                  rows={4}
                  placeholder={t('profile.placeholders.biography')}
                />
              </div>

              {profileValidationError && <p className="text-sm text-destructive">{profileValidationError}</p>}

              <div className="flex justify-end">
                <Button
                  onClick={() => updateProfileMutation.mutate()}
                  disabled={updateProfileMutation.isPending || avatarUploading || Boolean(profileValidationError)}
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {t('profile.actions.saveProfile')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.sections.emailTitle')}</CardTitle>
              <CardDescription>{t('profile.sections.emailDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">{t('profile.labels.currentEmail')}</p>
                <p className="text-sm font-medium">{profileForm.email}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-new-email">{t('profile.labels.newEmail')}</Label>
                <Input
                  id="profile-new-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder={t('profile.placeholders.newEmail')}
                />
                {emailValidationError && <p className="text-sm text-destructive">{emailValidationError}</p>}
              </div>

              {pendingEmail && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <CheckCircle2 className="mt-0.5 size-4" />
                  {t('profile.labels.pendingEmail')} <strong className="ml-1">{pendingEmail}</strong>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => updateEmailMutation.mutate()}
                  disabled={updateEmailMutation.isPending || Boolean(emailValidationError)}
                >
                  {updateEmailMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  {t('profile.actions.sendEmailChange')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.changePassword')}</CardTitle>
              <CardDescription>{t('profile.sections.passwordDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-current-password">{t('profile.currentPassword')}</Label>
                <div className="relative">
                  <Input
                    id="profile-current-password"
                    type={showPassword.currentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center text-muted-foreground"
                    onClick={() => setShowPassword((prev) => ({ ...prev, currentPassword: !prev.currentPassword }))}
                    aria-label={showPassword.currentPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword.currentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-new-password">{t('profile.newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="profile-new-password"
                    type={showPassword.newPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center text-muted-foreground"
                    onClick={() => setShowPassword((prev) => ({ ...prev, newPassword: !prev.newPassword }))}
                    aria-label={showPassword.newPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword.newPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-confirm-password">{t('profile.labels.confirmPassword')}</Label>
                <div className="relative">
                  <Input
                    id="profile-confirm-password"
                    type={showPassword.confirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center text-muted-foreground"
                    onClick={() => setShowPassword((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))}
                    aria-label={
                      showPassword.confirmPassword ? t('auth.hideConfirmPassword') : t('auth.showConfirmPassword')
                    }
                  >
                    {showPassword.confirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {passwordValidationError && <p className="text-sm text-destructive">{passwordValidationError}</p>}

              <div className="flex justify-end">
                <Button
                  onClick={() => updatePasswordMutation.mutate()}
                  disabled={updatePasswordMutation.isPending || Boolean(passwordValidationError)}
                >
                  {updatePasswordMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Shield className="size-4" />
                  )}
                  {t('profile.actions.updatePassword')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Avatar Crop Dialog ─── */}
      <Dialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          if (!open && !avatarUploading) {
            setCropDialogOpen(false)
            setRawImageSrc(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="size-4" />
              {t('profile.crop.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="relative h-64 w-full overflow-hidden rounded-lg bg-black">
            {rawImageSrc && (
              <Cropper
                image={rawImageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round"
                showGrid={false}
              />
            )}
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs">
                  <ZoomIn className="size-3.5" />
                  {t('profile.crop.zoom')}
                </Label>
                <span className="text-xs tabular-nums text-muted-foreground">{zoom.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs">
                  <RotateCcw className="size-3.5" />
                  {t('profile.crop.rotate')}
                </Label>
                <span className="text-xs tabular-nums text-muted-foreground">{rotation}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCropDialogOpen(false)
                setRawImageSrc(null)
              }}
              disabled={avatarUploading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                void handleCropConfirm()
              }}
              disabled={avatarUploading}
            >
              {avatarUploading ? <Loader2 className="size-4 animate-spin" /> : <Crop className="size-4" />}
              {t('profile.actions.applyAvatar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
