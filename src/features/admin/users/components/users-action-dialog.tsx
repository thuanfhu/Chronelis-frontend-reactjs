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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconCalendar, IconFlag, IconMail, IconPhone, IconUser, IconUserCircle, IconCheck, IconChevronDown } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { useUsers } from '../context/users-context'
import type { User } from '../data/schema'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { adminRoleApi } from '@/lib/api/modules/admin-role-api'
import { adminUserApi } from '@/lib/api/modules/admin-user-api'

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

const uniqueRoleIds = (roleIds: unknown[] = []): string[] =>
  Array.from(
    new Set(
      roleIds
        .map((roleId) => (roleId == null ? '' : String(roleId).trim()))
        .filter((roleId) => roleId.length > 0),
    ),
  )

const isEmptyValue = (value: unknown) => value === '' || value === null || value === undefined

const hasFieldChanged = (newValue: unknown, oldValue: unknown) => {
  if (isEmptyValue(newValue) && isEmptyValue(oldValue)) return false
  return newValue !== oldValue
}

const hasRoleSelectionChanged = (currentRoleIds: string[], selectedRoleIds: string[]) => {
  if (currentRoleIds.length !== selectedRoleIds.length) return true

  const currentRoleSet = new Set(currentRoleIds)
  return selectedRoleIds.some((roleId) => !currentRoleSet.has(roleId))
}

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
  const queryClient = useQueryClient()

  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles-select'],
    queryFn: async () => {
      const result = await adminRoleApi.list({ page: 1, size: 50 })
      return result.content || []
    },
    staleTime: 5 * 60 * 1000,
  })
  const roles = rolesData || []

  const defaultRoleIds = useMemo(() => {
    if (currentRow?.roles && Array.isArray(currentRow.roles) && currentRow.roles.length > 0) {
      return uniqueRoleIds((currentRow.roles as any[]).map((role) => role.roleId || role.id))
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

  const watchedValues = form.watch()
  const hasUpdateChanges = useMemo(() => {
    if (!isEdit || !currentRow) {
      return true
    }

    const currentAvatar = currentRow.avatar || currentRow.avatarUrl || ''
    const currentRoleIds = uniqueRoleIds((currentRow.roles || []).map((role: any) => role.roleId || role.id))
    const selectedRoleIds = uniqueRoleIds(watchedValues.roleIds)

    return (
      hasFieldChanged(watchedValues.email, currentRow.email) ||
      (hasFieldChanged(watchedValues.phoneNumber, currentRow.phoneNumber) && !isEmptyValue(watchedValues.phoneNumber)) ||
      hasFieldChanged(watchedValues.firstName, currentRow.firstName) ||
      hasFieldChanged(watchedValues.lastName, currentRow.lastName) ||
      (hasFieldChanged(watchedValues.nickname, currentRow.nickname) && !isEmptyValue(watchedValues.nickname)) ||
      (hasFieldChanged(watchedValues.avatar, currentAvatar) && !isEmptyValue(watchedValues.avatar)) ||
      (hasFieldChanged(watchedValues.birthDate, currentRow.birthDate) && !isEmptyValue(watchedValues.birthDate)) ||
      (hasFieldChanged(watchedValues.gender, currentRow.gender) && !isEmptyValue(watchedValues.gender)) ||
      (hasFieldChanged(watchedValues.nationality, currentRow.nationality) &&
        !isEmptyValue(watchedValues.nationality)) ||
      hasFieldChanged(watchedValues.isVerified, currentRow.isVerified) ||
      hasRoleSelectionChanged(currentRoleIds, selectedRoleIds)
    )
  }, [currentRow, isEdit, watchedValues])

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

        const currentAvatar = currentRow.avatar || currentRow.avatarUrl || ''

        if (hasFieldChanged(values.email, currentRow.email)) changedFields.email = values.email
        if (hasFieldChanged(values.phoneNumber, currentRow.phoneNumber) && !isEmptyValue(values.phoneNumber))
          changedFields.phoneNumber = values.phoneNumber
        if (hasFieldChanged(values.firstName, currentRow.firstName)) changedFields.firstName = values.firstName
        if (hasFieldChanged(values.lastName, currentRow.lastName)) changedFields.lastName = values.lastName
        if (hasFieldChanged(values.nickname, currentRow.nickname) && !isEmptyValue(values.nickname))
          changedFields.nickname = values.nickname
        if (hasFieldChanged(avatarUrl, currentAvatar) && !isEmptyValue(avatarUrl)) changedFields.avatar = avatarUrl
        if (hasFieldChanged(values.birthDate, currentRow.birthDate) && !isEmptyValue(values.birthDate))
          changedFields.birthDate = values.birthDate
        if (hasFieldChanged(values.gender, currentRow.gender) && !isEmptyValue(values.gender))
          changedFields.gender = values.gender
        if (hasFieldChanged(values.nationality, currentRow.nationality) && !isEmptyValue(values.nationality))
          changedFields.nationality = values.nationality
        if (hasFieldChanged(values.isVerified, currentRow.isVerified)) changedFields.isVerified = values.isVerified

        const currentRoleIds = uniqueRoleIds((currentRow.roles || []).map((role: any) => role.roleId || role.id))
        const selectedRoleIds = uniqueRoleIds(values.roleIds)
        const currentRoleSet = new Set(currentRoleIds)
        const selectedRoleSet = new Set(selectedRoleIds)
        const addedRoleIds = selectedRoleIds.filter((id) => !currentRoleSet.has(id))
        const removedRoleIds = currentRoleIds.filter((id) => !selectedRoleSet.has(id))

        const hasRoleChanged = addedRoleIds.length > 0 || removedRoleIds.length > 0

        if (Object.keys(changedFields).length === 0 && !hasRoleChanged) {
          toast.info(t('userManagement.noChanges'))
          setIsUploading(false)
          return
        }

        if (addedRoleIds.length > 0) {
          changedFields.roleIds = addedRoleIds
        }

        const shouldPatchUser = Object.keys(changedFields).length > 0
        const mutationPromises: Promise<unknown>[] = []

        if (removedRoleIds.length > 0) {
          mutationPromises.push(adminUserApi.deleteRoles(currentRow.userId, { roleIds: removedRoleIds }))
        }

        if (shouldPatchUser) {
          mutationPromises.push(updateUser(currentRow.userId, changedFields))
        }

        await Promise.all(mutationPromises)

        if (hasRoleChanged) {
          await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        }

        if (!shouldPatchUser) {
          toast.success(t('notification.userUpdateSuccess', 'Cập nhật người dùng thành công'))
          onOpenChange(false)
        }
      } else {
        const userData: any = {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          isVerified: values.isVerified,
        }
        const selectedRoleIds = uniqueRoleIds(values.roleIds)
        if (selectedRoleIds.length > 0) userData.roleIds = selectedRoleIds
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
      toast.error(t('userManagement.saveError'))
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
                ? t('userManagement.viewUser')
                : isEdit
                  ? t('userManagement.editUser')
                  : t('userManagement.addUser')}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {isView
                ? t('userManagement.viewUserDesc')
                : isEdit
                  ? t('userManagement.editUserDesc')
                  : t('userManagement.addUserDesc')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[65vh] px-6 py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <fieldset disabled={isView} className="space-y-6 w-full border-0 p-0 m-0">
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
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('userManagement.columns.email')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <IconMail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                  placeholder="example@email.com"
                                  {...field}
                                  className="bg-slate-50 dark:bg-zinc-800 pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('userManagement.phoneNumber')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <IconPhone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                  placeholder={t('userManagement.phoneNumberPlaceholder')}
                                  {...field}
                                  className="bg-slate-50 dark:bg-zinc-800 pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('userManagement.columns.lastName')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <IconUser className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                  placeholder={t('userManagement.lastNamePlaceholder')}
                                  {...field}
                                  className="bg-slate-50 dark:bg-zinc-800 pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('userManagement.columns.firstName')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <IconUser className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                  placeholder={t('userManagement.firstNamePlaceholder')}
                                  {...field}
                                  className="bg-slate-50 dark:bg-zinc-800 pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                      <FormField
                        control={form.control}
                        name="nickname"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('userManagement.nickname')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('userManagement.nicknamePlaceholder')}
                                {...field}
                                className="bg-slate-50 dark:bg-zinc-800"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="birthDate"
                        render={({ field }) => (
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
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
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
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nationality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('userManagement.nationality')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <IconFlag className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                  placeholder={t('userManagement.nationalityPlaceholder')}
                                  {...field}
                                  className="bg-slate-50 dark:bg-zinc-800 pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                      <FormField
                        control={form.control}
                        name="avatar"
                        render={({ field }) => {
                          const [previewUrl, setPreviewUrl] = useState<string>(field.value || '')
                          return (
                            <FormItem>
                              <FormLabel>{t('userManagement.avatar')}</FormLabel>
                              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                <Avatar className="h-20 w-20 rounded-full border-2 border-slate-200">
                                  <AvatarImage
                                    src={
                                      previewUrl ||
                                      `https://ui-avatars.com/api/?name=${form.watch('firstName')}+${form.watch('lastName')}&size=80&background=random`
                                    }
                                    alt="Avatar preview"
                                  />
                                  <AvatarFallback className="rounded-full bg-slate-100 dark:bg-slate-600">
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
                        }}
                      />
                      <FormField
                        control={form.control}
                        name="roleIds"
                        render={({ field }) => {
                          const selectedRoleIds = uniqueRoleIds(field.value || [])
                          return (
                            <FormItem className="flex flex-col gap-1 w-full">
                              <FormLabel className="text-sm font-semibold">{t('userManagement.role')}</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    disabled={isView}
                                    className="w-full justify-between h-auto min-h-10 px-3 py-2 text-left font-normal border-slate-200 bg-white shadow-sm hover:bg-slate-50 focus-visible:ring-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                                  >
                                    <div className="flex flex-wrap gap-1.5 max-w-[90%]">
                                      {selectedRoleIds.length === 0 ? (
                                        <span className="text-muted-foreground">{t('userManagement.rolePlaceholder')}</span>
                                      ) : (
                                        selectedRoleIds.map((roleId) => {
                                          const role = roles.find((r: any) => r.roleId === roleId)
                                          return (
                                            <Badge
                                              key={roleId}
                                              variant="secondary"
                                              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200"
                                            >
                                              {role?.name || roleId}
                                            </Badge>
                                          )
                                        })
                                      )}
                                    </div>
                                    <IconChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[calc(100vw-2rem)] p-0 border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                                  align="start"
                                >
                                  <Command className="bg-white dark:bg-zinc-900">
                                    <CommandInput
                                      placeholder={t('common.searchPlaceholder')}
                                      className="text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-zinc-500"
                                    />
                                    <CommandList className="max-h-[300px] overflow-y-auto">
                                      <CommandEmpty>{t('common.noData')}</CommandEmpty>
                                      <CommandGroup>
                                        {roles.map((role: any) => {
                                          const isSelected = selectedRoleIds.includes(role.roleId)
                                          return (
                                            <CommandItem
                                              key={role.roleId}
                                              value={role.name}
                                              className={cn(
                                                'flex items-center justify-between cursor-pointer py-2.5 px-3 rounded-lg transition-colors duration-150',
                                                'hover:!bg-slate-100 hover:!text-slate-950 dark:hover:!bg-zinc-800 dark:hover:!text-zinc-50',
                                                'data-[selected=true]:!bg-slate-100 data-[selected=true]:!text-slate-950 dark:data-[selected=true]:!bg-zinc-800 dark:data-[selected=true]:!text-zinc-50',
                                              )}
                                              onSelect={() => {
                                                if (isView) return
                                                const nextIds = isSelected
                                                  ? selectedRoleIds.filter((id) => id !== role.roleId)
                                                  : [...selectedRoleIds, role.roleId]
                                                field.onChange(uniqueRoleIds(nextIds))
                                              }}
                                            >
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                  {role.name}
                                                </span>
                                                {role.description && (
                                                  <span className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                                                    {role.description}
                                                  </span>
                                                )}
                                              </div>
                                              <div
                                                className={cn(
                                                  'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-200 shrink-0 ml-4',
                                                  isSelected
                                                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm scale-105 dark:border-blue-400 dark:bg-blue-500'
                                                    : 'border-slate-300 bg-white opacity-80 dark:border-zinc-600 dark:bg-zinc-900',
                                                )}
                                              >
                                                {isSelected && <IconCheck className="h-3.5 w-3.5 stroke-[3.5] text-white" />}
                                              </div>
                                            </CommandItem>
                                          )
                                        })}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )
                        }}
                      />
                    </div>
                    <div className="mt-4">
                      <FormField
                        control={form.control}
                        name="isVerified"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-zinc-800">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">{t('userManagement.emailVerification')}</FormLabel>
                              <div className="text-sm text-slate-500">
                                {field.value ? t('userManagement.userVerified') : t('userManagement.userUnverified')}
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="data-[state=checked]:bg-slate-900"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </motion.div>
                </fieldset>
              </form>
            </Form>
          </ScrollArea>
          <DialogFooter className="p-6 border-t flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="transition-all duration-200 hover:bg-slate-100"
            >
              {isView ? t('common.close') : t('userManagement.cancel')}
            </Button>
            {!isView && (
              <Button
                type="submit"
                onClick={form.handleSubmit(onSubmit)}
                disabled={form.formState.isSubmitting || isUploading || (isEdit && !hasUpdateChanges)}
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
