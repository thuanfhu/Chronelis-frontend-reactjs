import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, Blocks, Bug, ClipboardList, FileText, Rocket, ShieldCheck, Tag, Wrench } from 'lucide-react'

export const TASK_TYPE_ICON_OPTIONS = [
  { value: 'tag', label: 'General', icon: Tag },
  { value: 'clipboard', label: 'Task', icon: ClipboardList },
  { value: 'sparkles', label: 'Feature', icon: Blocks },
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'wrench', label: 'Maintenance', icon: Wrench },
  { value: 'shield', label: 'Security', icon: ShieldCheck },
  { value: 'rocket', label: 'Release', icon: Rocket },
  { value: 'docs', label: 'Docs', icon: FileText },
  { value: 'quality', label: 'Quality', icon: BadgeCheck },
] as const

export type TaskTypeIconValue = (typeof TASK_TYPE_ICON_OPTIONS)[number]['value']

export function resolveTaskTypeIcon(icon?: string): LucideIcon {
  return TASK_TYPE_ICON_OPTIONS.find((option) => option.value === icon)?.icon ?? Tag
}
