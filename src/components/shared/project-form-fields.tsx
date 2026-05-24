import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkspaceImageUpload } from '@/components/shared/workspace-image-upload'
import type { WorkspaceMember, WorkspaceMemberRoleType, WorkspaceTeam } from '@/types/domain'

interface ProjectFormFieldsProps {
  name: string
  imageUrl: string
  description: string
  visibility: 'PUBLIC' | 'PRIVATE'
  managerUserId: string
  managerTeamId: string
  onNameChange: (value: string) => void
  onImageUrlChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onVisibilityChange: (value: 'PUBLIC' | 'PRIVATE') => void
  onManagerUserChange: (value: string) => void
  onManagerTeamChange: (value: string) => void
  members: WorkspaceMember[]
  teams: WorkspaceTeam[]
  isOwner: boolean
}

export function ProjectFormFields({
  name,
  imageUrl,
  description,
  visibility,
  managerUserId,
  managerTeamId,
  onNameChange,
  onImageUrlChange,
  onDescriptionChange,
  onVisibilityChange,
  onManagerUserChange,
  onManagerTeamChange,
  members,
  teams,
  isOwner,
}: ProjectFormFieldsProps) {
  const { t } = useTranslation()
  const baseId = useId()
  const nameId = `${baseId}-project-name`
  const descriptionId = `${baseId}-description`

  const roleDisplayName = useMemo<Record<WorkspaceMemberRoleType, string>>(
    () => ({
      OWNER: t('workspace.role.owner'),
      MEMBER: t('workspace.role.member'),
    }),
    [t],
  )

  if (!isOwner) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <WorkspaceImageUpload
            value={imageUrl}
            onChange={onImageUrlChange}
            alt={name || t('workspace.field.projectImage')}
            folder="project-images"
            fileName="project.jpg"
          />
          <div className="flex-1 space-y-2">
            <Label htmlFor={nameId}>{t('workspace.field.projectName')}</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={t('workspace.placeholder.projectName')}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={descriptionId}>{t('workspace.field.descriptionOptional')}</Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={t('workspace.placeholder.projectDescription')}
            rows={3}
          />
        </div>
      </div>
    )
  }

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="general">{t('common.general')}</TabsTrigger>
        <TabsTrigger value="manager">{t('common.manager')}</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="space-y-3 pt-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <WorkspaceImageUpload
            value={imageUrl}
            onChange={onImageUrlChange}
            alt={name || t('workspace.field.projectImage')}
            folder="project-images"
            fileName="project.jpg"
          />
          <div className="flex-1 space-y-2">
            <Label htmlFor={nameId}>{t('workspace.field.projectName')}</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={t('workspace.placeholder.projectName')}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={descriptionId}>{t('workspace.field.descriptionOptional')}</Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={t('workspace.placeholder.projectDescription')}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('workspace.field.visibility')}</Label>
          <Select value={visibility} onValueChange={(value: 'PUBLIC' | 'PRIVATE') => onVisibilityChange(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">{t('workspace.visibility.public')}</SelectItem>
              <SelectItem value="PRIVATE">{t('workspace.visibility.private')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {visibility === 'PUBLIC'
              ? t('workspace.visibility.publicDescription')
              : t('workspace.visibility.privateDescription')}
          </p>
        </div>
      </TabsContent>
      <TabsContent value="manager" className="space-y-3 pt-3">
        <div className="space-y-2">
          <Label>{t('workspace.field.managerUserOptional')}</Label>
          <Select
            value={managerUserId || 'none'}
            onValueChange={(value) => onManagerUserChange(value === 'none' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('workspace.placeholder.noManagerUser')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('workspace.select.noAssignment')}</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.user.userId} value={member.user.userId}>
                  {member.user.firstName} {member.user.lastName} ({roleDisplayName[member.role]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('workspace.field.managerTeamOptional')}</Label>
          <Select
            value={managerTeamId || 'none'}
            onValueChange={(value) => onManagerTeamChange(value === 'none' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('workspace.placeholder.noManagerTeam')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('workspace.select.noAssignment')}</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={String(team.id)}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TabsContent>
    </Tabs>
  )
}
