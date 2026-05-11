import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { WorkspaceMember, WorkspaceMemberRoleType, WorkspaceTeam } from '@/types/domain'

interface ProjectFormFieldsProps {
  name: string
  description: string
  managerUserId: string
  managerTeamId: string
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onManagerUserChange: (value: string) => void
  onManagerTeamChange: (value: string) => void
  members: WorkspaceMember[]
  teams: WorkspaceTeam[]
  isOwner: boolean
}

export function ProjectFormFields({
  name,
  description,
  managerUserId,
  managerTeamId,
  onNameChange,
  onDescriptionChange,
  onManagerUserChange,
  onManagerTeamChange,
  members,
  teams,
  isOwner,
}: ProjectFormFieldsProps) {
  const { t } = useTranslation()
  const baseId = useId()
  const nameId = `${baseId}-project-name`
  const descriptionId = `${baseId}-project-description`

  const roleDisplayName = useMemo<Record<WorkspaceMemberRoleType, string>>(() => ({
    OWNER: t('workspace.role.owner'),
    ADMIN: t('workspace.role.admin'),
    MEMBER: t('workspace.role.member'),
  }), [t])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={nameId}>{t('workspace.field.projectName')}</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={t('workspace.placeholder.projectName')}
        />
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
      {isOwner ? (
        <>
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
        </>
      ) : null}
    </div>
  )
}
