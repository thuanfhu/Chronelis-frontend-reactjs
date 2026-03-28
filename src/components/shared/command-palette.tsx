import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  PanelsTopLeft,
  Bell,
  FolderKanban,
  Moon,
  Sun,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useUiStore } from '@/app/store/ui-store'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { queryKeys } from '@/lib/api/query-keys'

export function CommandPalette() {
  const navigate = useNavigate()
  const open = useUiStore((state) => state.commandPaletteOpen)
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const theme = useUiStore((state) => state.theme)

  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces.list(1, 10),
    queryFn: () => workspaceApi.list({ page: 1, size: 10 }),
    enabled: open,
  })

  const workspaces = workspacesQuery.data?.content ?? []

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Nhập lệnh hoặc tìm kiếm..." />
      <CommandList>
        <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>

        <CommandGroup heading="Điều hướng">
          <CommandItem onSelect={() => runCommand(() => navigate('/dashboard'))}>
            <LayoutDashboard className="mr-2 size-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/workspaces'))}>
            <PanelsTopLeft className="mr-2 size-4" />
            Workspaces
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/notifications'))}>
            <Bell className="mr-2 size-4" />
            Thông báo
          </CommandItem>
        </CommandGroup>

        {workspaces.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workspaces">
              {workspaces.map((ws) => (
                <CommandItem key={ws.id} onSelect={() => runCommand(() => navigate(`/workspaces/${ws.id}`))}>
                  <FolderKanban className="mr-2 size-4" />
                  {ws.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Cài đặt">
          <CommandItem onSelect={() => runCommand(toggleTheme)}>
            {theme === 'dark' ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
            {theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
