import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  IconCalendar,
  IconFlag,
  IconMail,
  IconPhone,
  IconShield,
  IconUser,
  IconUserCircle,
} from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { useUsers } from '../context/users-context'
import type { User } from '../data/schema'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { adminRoleApi } from '@/lib/api/modules/admin-role-api'

const formSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  phoneNumber: z.string().optional(),
  firstName: z.string().min(1, 'Vui lòng nhập tên'),
  lastName: z.string().min(1, 'Vui lòng nhập họ'),
  nickname: z.string().optional(),
  avatar: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  isVerified: z.boolean(),
  roleIds: z.array(z.string()),
})

type UserForm = z.infer<typeof formSchema>

interface Props {
  currentRow?: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isView?: boolean
}

export function UsersActionDialog({ currentRow, open, onOpenChange, isView }: Props) {
  const { updateUser, createUser } = useUsers()
  const { t } = useTranslation()
  const isEdit = !!currentRow
  const [isUploading, setIsUploading] = useState(false)

  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles-select'],
    queryFn: async () => {
      const result = await adminRoleApi.list({ page: 1, size: 200 })
      return result.content || []
    },
    staleTime: 5 * 60 * 1000,
  })
  const roles = rolesData || []

  const defaultRoleIds = useMemo(() => {
    if (currentRow?.roles && Array.isArray(currentRow.roles) && currentRow.roles.length > 0) {
      return (currentRow.roles as any[])
        .map((role) => role.roleId || role.id || '')
        .filter(Boolean)
    }
    return []
  }, [currentRow])

  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: currentRow?.email || '',
      phoneNumber: currentRow?.phoneNumber || '',
      firstName: currentRow?.firstName || '',
      lastName: currentRow?.lastName || '',
      nickname: currentRow?.nickname || '',
      avatar: currentRow?.avatar || currentRow?.avatarUrl || '',
      birthDate: currentRow?.birthDate || '',
      gender: currentRow?.gender || '',
      nationality: currentRow?.nationality || '',
      isVerified: currentRow?.isVerified || false,
      roleIds: defaultRoleIds,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        email: currentRow?.email || '',
        phoneNumber: currentRow?.phoneNumber || '',
        firstName: currentRow?.firstName || '',
        lastName: currentRow?.lastName || '',
        nickname: currentRow?.nickname || '',
        avatar: currentRow?.avatar || currentRow?.avatarUrl || '',
        birthDate: currentRow?.birthDate || '',
        gender: currentRow?.gender || '',
        nationality: currentRow?.nationality || '',
        isVerified: currentRow?.isVerified || false,
        roleIds: defaultRoleIds,
      })
    }
  }, [open, currentRow, defaultRoleIds])

  const onSubmit = async (values: UserForm) => {
    try {
      setIsUploading(true)
      const avatarUrl = values.avatar

      if (isEdit && currentRow?.userId) {
        const changedFields: any = {}

        const isEmpty = (v: any) => v === '' || v === null || v === undefined
        const hasChanged = (newVal: any, oldVal: any) => {
          if (isEmpty(newVal) && isEmpty(oldVal)) return false
          return newVal !== oldVal
        }

        if (hasChanged(values.email, currentRow.email)) changedFields.email = values.email
        if (hasChanged(values.phoneNumber, currentRow.phoneNumber) && !isEmpty(values.phoneNumber)) changedFields.phoneNumber = values.phoneNumber
        if (hasChanged(values.firstName, currentRow.firstName)) changedFields.firstName = values.firstName
        if (hasChanged(values.lastName, currentRow.lastName)) changedFields.lastName = values.lastName
        if (hasChanged(values.nickname, currentRow.nickname) && !isEmpty(values.nickname)) changedFields.nickname = values.nickname
        if (hasChanged(avatarUrl, currentRow.avatar) && !isEmpty(avatarUrl)) changedFields.avatar = avatarUrl
        if (hasChanged(values.birthDate, currentRow.birthDate) && !isEmpty(values.birthDate)) changedFields.birthDate = values.birthDate
        if (hasChanged(values.gender, currentRow.gender) && !isEmpty(values.gender)) changedFields.gender = values.gender
        if (hasChanged(values.nationality, currentRow.nationality) && !isEmpty(values.nationality)) changedFields.nationality = values.nationality
        if (hasChanged(values.isVerified, currentRow.isVerified)) changedFields.isVerified = values.isVerified

        const currentRoleIds = (currentRow.roles || []).map((r: any) => r.roleId || r.id || '').filter(Boolean)
        const hasRoleChanged = JSON.stringify(values.roleIds.filter(Boolean)) !== JSON.stringify(currentRoleIds)
        if (hasRoleChanged && values.roleIds.length > 0) {
          changedFields.roleIds = values.roleIds.filter(Boolean)
        }

        if (Object.keys(changedFields).length === 0) {
          toast.info('Không có thông tin nào được thay đổi.')
          setIsUploading(false)
          return
        }

        await updateUser(currentRow.userId, changedFields)
      } else {
        const userData: any = {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          isVerified: values.isVerified,
        }
        if (values.roleIds && values.roleIds.length > 0) userData.roleIds = values.roleIds.filter(Boolean)
        if (values.phoneNumber) userData.phoneNumber = values.phoneNumber
        if (values.nickname) userData.nickname = values.nickname
        if (avatarUrl) userData.avatar = avatarUrl
        if (values.birthDate) userData.birthDate = values.birthDate
        if (values.gender) userData.gender = values.gender
        if (values.nationality) userData.nationality = values.nationality

        await createUser(userData)
      }

      setIsUploading(false)
      onOpenChange(false)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Đã xảy ra lỗi. Vui lòng thử lại.')
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] p-0 gap-0 overflow-hidden dark:bg-zinc-700 dark:border-zinc-800 border-slate-200 shadow-lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full"
        >
          <DialogHeader className="p-6 pb-2 border-b bg-slate-50 dark:bg-zinc-800">
            <DialogTitle className="text-xl">
              {isView 
                ? t('userManagement.viewUser', 'Xem thông tin người dùng') 
                : isEdit ? t('userManagement.editUser') : t('userManagement.addUser')}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {isView 
                ? t('userManagement.viewUserDesc', 'Chi tiết thông tin người dùng')
                : isEdit ? t('userManagement.editUserDesc') : t('userManagement.addUserDesc')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[65vh] px-6 py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="bg-white dark:border-zinc-800 dark:bg-zinc-800 p-5 rounded-md border border-slate-200 shadow-sm"
                >
                  <h3 className="text-md font-medium text-slate-900 dark:text-slate-100 mb-4">
                    {t('userManagement.basicInfo')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.columns.email')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IconMail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder="example@email.com" {...field} className="bg-slate-50 dark:bg-zinc-800 pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.phoneNumber')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IconPhone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder={t('userManagement.phoneNumberPlaceholder')} {...field} className="bg-slate-50 dark:bg-zinc-800 pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.columns.lastName')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IconUser className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder={t('userManagement.lastNamePlaceholder')} {...field} className="bg-slate-50 dark:bg-zinc-800 pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.columns.firstName')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IconUser className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder={t('userManagement.firstNamePlaceholder')} {...field} className="bg-slate-50 dark:bg-zinc-800 pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="bg-white dark:bg-zinc-800 dark:border-zinc-800 p-5 rounded-md border border-slate-200 shadow-sm"
                >
                  <h3 className="text-md font-medium dark:text-slate-100 text-slate-900 mb-4">
                    {t('userManagement.additionalInfo')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="nickname" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.nickname')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('userManagement.nicknamePlaceholder')} {...field} className="bg-slate-50 dark:bg-zinc-800" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="birthDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.birthDate')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IconCalendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input type="date" {...field} className="bg-slate-50 dark:bg-zinc-800 pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="gender" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.gender')}</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="bg-slate-50 dark:bg-zinc-800">
                              <SelectValue placeholder={t('userManagement.genderPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">{t('userManagement.genderOptions.male')}</SelectItem>
                            <SelectItem value="female">{t('userManagement.genderOptions.female')}</SelectItem>
                            <SelectItem value="other">{t('userManagement.genderOptions.other')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="nationality" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.nationality')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IconFlag className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input placeholder={t('userManagement.nationalityPlaceholder')} {...field} className="bg-slate-50 dark:bg-zinc-800 pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="bg-white dark:bg-zinc-800 dark:border-zinc-800 dark:text-slate-100 p-5 rounded-md border border-slate-200 shadow-sm"
                >
                  <h3 className="text-md font-medium text-slate-900 dark:text-slate-100 mb-4">
                    {t('userManagement.imageAndPermissions')}
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <FormField control={form.control} name="avatar" render={({ field }) => {
                      const [previewUrl, setPreviewUrl] = useState<string>(field.value || '')
                      return (
                        <FormItem>
                          <FormLabel>{t('userManagement.avatar')}</FormLabel>
                          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                            <Avatar className="h-20 w-20 rounded-md border-2 border-slate-200">
                              <AvatarImage src={previewUrl || `https://ui-avatars.com/api/?name=${form.watch('firstName')}+${form.watch('lastName')}&size=80&background=random`} alt="Avatar preview" />
                              <AvatarFallback className="rounded-md bg-slate-100 dark:bg-slate-600">
                                <IconUserCircle className="h-10 w-10 text-slate-400" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-2">
                              <FormControl>
                                <Input
                                  placeholder="https://example.com/avatar.jpg"
                                  {...field}
                                  className="bg-slate-50 dark:bg-zinc-800"
                                  onChange={(e) => {
                                    field.onChange(e)
                                    setPreviewUrl(e.target.value)
                                  }}
                                />
                              </FormControl>
                              <p className="text-xs text-slate-500">{t('userManagement.avatarFormat')}</p>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )
                    }} />
                    <FormField control={form.control} name="roleIds" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userManagement.role')}</FormLabel>
                        <Select
                          value={field.value?.length > 0 ? field.value[0] : ''}
                          onValueChange={(value) => {
                            if (value) field.onChange([value])
                          }}
                        >
                          <FormControl>
                            <div className="relative">
                              <IconShield className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 z-10" />
                              <SelectTrigger className="bg-slate-50 dark:bg-zinc-800 pl-10">
                                <SelectValue placeholder={t('userManagement.rolePlaceholder')} />
                              </SelectTrigger>
                            </div>
                          </FormControl>
                          <SelectContent>
                            {roles.map((role: any) => (
                              <SelectItem key={role.roleId} value={role.roleId || ''}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="mt-4">
                    <FormField control={form.control} name="isVerified" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-zinc-800">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">{t('userManagement.emailVerification')}</FormLabel>
                          <div className="text-sm text-slate-500">
                            {field.value ? t('userManagement.userVerified') : t('userManagement.userUnverified')}
                          </div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-slate-900" />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                </motion.div>
              </form>
            </Form>
          </ScrollArea>
          <DialogFooter className="p-6 border-t flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="transition-all duration-200 hover:bg-slate-100"
            >
              {isView ? t('close', 'Đóng') : t('userManagement.cancel')}
            </Button>
            {!isView && (
              <Button
                type="submit"
                onClick={form.handleSubmit(onSubmit)}
                disabled={form.formState.isSubmitting || isUploading}
                className="bg-primary transition-all duration-200 hover:bg-primary/90"
              >
                {form.formState.isSubmitting || isUploading
                  ? t('userManagement.processing')
                  : isEdit
                    ? t('userManagement.update')
                    : t('userManagement.add')}
              </Button>
            )}
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
