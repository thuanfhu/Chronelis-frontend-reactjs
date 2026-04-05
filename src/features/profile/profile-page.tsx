import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Save,
  Settings2,
  Shield,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/app/store/auth-store'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export function ProfilePage() {
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

  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => mapUserToForm(currentUser ?? {
    userId: '',
    email: '',
    firstName: '',
    lastName: '',
  }))

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
      return 'Tên phải có tối thiểu 2 ký tự.'
    }

    if (profileForm.lastName.trim().length < 2) {
      return 'Họ phải có tối thiểu 2 ký tự.'
    }

    if (profileForm.nickname.trim().length === 1) {
      return 'Nickname phải có tối thiểu 2 ký tự nếu được nhập.'
    }

    return null
  }, [profileForm.firstName, profileForm.lastName, profileForm.nickname])

  const emailValidationError = useMemo(() => {
    const trimmed = newEmail.trim()
    if (!trimmed) {
      return 'Vui lòng nhập email mới.'
    }

    if (!EMAIL_PATTERN.test(trimmed)) {
      return 'Email mới chỉ hỗ trợ miền gmail.com hoặc yopmail.com.'
    }

    if (trimmed.toLowerCase() === profileForm.email.trim().toLowerCase()) {
      return 'Email mới phải khác email hiện tại.'
    }

    return null
  }, [newEmail, profileForm.email])

  const passwordValidationError = useMemo(() => {
    if (!passwordForm.currentPassword.trim()) {
      return 'Vui lòng nhập mật khẩu hiện tại.'
    }

    if (!STRONG_PASSWORD_PATTERN.test(passwordForm.newPassword)) {
      return 'Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.'
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return 'Xác nhận mật khẩu chưa khớp.'
    }

    return null
  }, [passwordForm])

  const updateProfileMutation = useMutation({
    mutationFn: () => userApi.updateProfile({
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
      toast.success('Cập nhật hồ sơ thành công')
    },
    onError: (error: Error) => {
      toast.error('Cập nhật hồ sơ thất bại', { description: error.message })
    },
  })

  const updateEmailMutation = useMutation({
    mutationFn: () => userApi.updateEmail({
      newEmail: newEmail.trim(),
    }),
    onSuccess: (message) => {
      setPendingEmail(newEmail.trim())
      setNewEmail('')
      toast.success('Yêu cầu đổi email đã được gửi', { description: message })
    },
    onError: (error: Error) => {
      toast.error('Không thể gửi yêu cầu đổi email', { description: error.message })
    },
  })

  const updatePasswordMutation = useMutation({
    mutationFn: () => userApi.updatePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword,
    }),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')
      clearSession()
      navigate('/login', { replace: true })
    },
    onError: (error: Error) => {
      toast.error('Đổi mật khẩu thất bại', { description: error.message })
    },
  })

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Ảnh đại diện phải là PNG, JPG hoặc WEBP')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh đại diện tối đa 5MB')
      event.target.value = ''
      return
    }

    setAvatarUploading(true)
    try {
      const uploaded = await storageApi.uploadSingle(file, 'user-avatars')
      setProfileForm((prev) => ({
        ...prev,
        avatarUrl: uploaded.fileUrl,
      }))
      toast.success('Đã tải ảnh đại diện')
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Upload ảnh thất bại'
      toast.error('Không thể tải ảnh đại diện', { description })
    } finally {
      setAvatarUploading(false)
      event.target.value = ''
    }
  }

  const loadedUser = profileQuery.data ?? currentUser
  if (!loadedUser && profileQuery.isLoading) {
    return <LoadingPanel />
  }

  if (!loadedUser) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-sm text-muted-foreground">
          Không tải được thông tin hồ sơ. Vui lòng đăng nhập lại.
        </CardContent>
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
            <h1 className="text-2xl font-semibold tracking-tight">Hồ sơ cá nhân</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý thông tin cá nhân, email đăng nhập và bảo mật tài khoản.
            </p>
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
              <p className="text-sm font-medium">Thông tin cá nhân</p>
              <p className="text-xs text-muted-foreground">Tên hiển thị, avatar và hồ sơ công việc.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600">
              <Settings2 className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Quản lý email</p>
              <p className="text-xs text-muted-foreground">Thay đổi email và xác thực qua địa chỉ mới.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-md bg-amber-500/10 p-2 text-amber-600">
              <Shield className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Bảo mật tài khoản</p>
              <p className="text-xs text-muted-foreground">Đổi mật khẩu mạnh để bảo vệ tài khoản.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'profile' | 'email' | 'password')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="size-4" />
            Cá nhân
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="size-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-1.5">
            <Lock className="size-4" />
            Mật khẩu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin cá nhân</CardTitle>
              <CardDescription>Cập nhật hồ sơ công khai của bạn trong Chronelis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center">
                <Avatar className="h-18 w-18">
                  <AvatarImage src={profileForm.avatarUrl} alt={`${profileForm.firstName} ${profileForm.lastName}`} />
                  <AvatarFallback className="text-sm font-semibold text-primary">
                    {buildInitials(profileForm.firstName, profileForm.lastName)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{profileForm.firstName} {profileForm.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{profileForm.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Tối đa 5MB, định dạng PNG/JPG/WEBP.</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  Đổi avatar
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(event) => { void handleAvatarFileChange(event) }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-first-name">Tên</Label>
                  <Input
                    id="profile-first-name"
                    value={profileForm.firstName}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-last-name">Họ</Label>
                  <Input
                    id="profile-last-name"
                    value={profileForm.lastName}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-nickname">Nickname</Label>
                  <Input
                    id="profile-nickname"
                    value={profileForm.nickname}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, nickname: event.target.value }))}
                    placeholder="Ví dụ: phuong.pm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-phone">Số điện thoại</Label>
                  <Input id="profile-phone" value={profileForm.phoneNumber} disabled readOnly />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-city">Thành phố</Label>
                  <Input
                    id="profile-city"
                    value={profileForm.city}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, city: event.target.value }))}
                    placeholder="Ví dụ: Ho Chi Minh City"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-nationality">Quốc tịch</Label>
                  <Input
                    id="profile-nationality"
                    value={profileForm.nationality}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, nationality: event.target.value }))}
                    placeholder="Ví dụ: Vietnam"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-biography">Giới thiệu</Label>
                <Textarea
                  id="profile-biography"
                  value={profileForm.biography}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, biography: event.target.value }))}
                  rows={4}
                  placeholder="Mô tả ngắn về chuyên môn và sở thích làm việc của bạn..."
                />
              </div>

              {profileValidationError && (
                <p className="text-sm text-destructive">{profileValidationError}</p>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => updateProfileMutation.mutate()}
                  disabled={updateProfileMutation.isPending || avatarUploading || Boolean(profileValidationError)}
                >
                  {updateProfileMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Lưu hồ sơ
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Cập nhật email</CardTitle>
              <CardDescription>
                Yêu cầu đổi email sẽ gửi liên kết xác thực về địa chỉ email mới.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Email hiện tại</p>
                <p className="text-sm font-medium">{profileForm.email}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-new-email">Email mới</Label>
                <Input
                  id="profile-new-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="you@gmail.com"
                />
                {emailValidationError && <p className="text-sm text-destructive">{emailValidationError}</p>}
              </div>

              {pendingEmail && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <CheckCircle2 className="mt-0.5 size-4" />
                  Đang chờ xác thực email mới: <strong className="ml-1">{pendingEmail}</strong>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => updateEmailMutation.mutate()}
                  disabled={updateEmailMutation.isPending || Boolean(emailValidationError)}
                >
                  {updateEmailMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                  Gửi yêu cầu đổi email
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Đổi mật khẩu</CardTitle>
              <CardDescription>
                Sau khi đổi mật khẩu thành công, bạn sẽ được đăng xuất để đăng nhập lại.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-current-password">Mật khẩu hiện tại</Label>
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
                  >
                    {showPassword.currentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-new-password">Mật khẩu mới</Label>
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
                  >
                    {showPassword.newPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-confirm-password">Xác nhận mật khẩu mới</Label>
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
                  >
                    {showPassword.confirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {passwordValidationError && (
                <p className="text-sm text-destructive">{passwordValidationError}</p>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => updatePasswordMutation.mutate()}
                  disabled={updatePasswordMutation.isPending || Boolean(passwordValidationError)}
                >
                  {updatePasswordMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
                  Cập nhật mật khẩu
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
