import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  ImagePlus,
  Save,
  Loader2,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
} from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import FileHandler from '@tiptap/extension-file-handler'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { queryKeys } from '@/lib/api/query-keys'
import { storageApi } from '@/lib/api/modules/storage-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { formatDateTime } from '@/lib/utils/datetime'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { useTaskRealtime } from '@/lib/websocket/use-domain-realtime'
import '@/styles/task-notes-editor.css'

interface NotesLocationState {
  returnTo?: string
}

export function TaskNotesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const queryClient = useQueryClient()

  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const taskId = Number(params.taskId)

  useTaskRealtime(
    Number.isFinite(workspaceId) ? workspaceId : null,
    Number.isFinite(projectId) ? projectId : null,
    Number.isFinite(taskId) && taskId > 0 ? taskId : null,
  )

  const { canManageTask, permissionsReady } = useProjectPermissions({
    workspaceId,
    projectId,
    enabled: Number.isFinite(workspaceId) && Number.isFinite(projectId),
  })

  const [isDirty, setIsDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isHydratingRef = useRef(false)
  const isContentSeededRef = useRef(false)
  const lastSavedHtmlRef = useRef('')

  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => taskApi.detail(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
  })

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        allowBase64: false,
      }),
      FileHandler.configure({
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        onDrop: (_editor, files, pos) => {
          void handleUploadImages(files, pos)
        },
        onPaste: (_editor, files, htmlContent) => {
          if (htmlContent && htmlContent.length > 0) {
            return
          }
          void handleUploadImages(files)
        },
      }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'task-notes-prosemirror',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (isHydratingRef.current) {
        return
      }

      const html = currentEditor.getHTML()
      setIsDirty(html !== lastSavedHtmlRef.current)
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editor) {
        throw new Error('Editor chưa sẵn sàng')
      }
      return taskApi.update(taskId, {
        notesHtml: editor.getHTML(),
      })
    },
    onSuccess: (updatedTask) => {
      const savedHtml = updatedTask.notesHtml ?? '<p></p>'
      lastSavedHtmlRef.current = savedHtml
      setIsDirty(false)
      setLastSavedAt(new Date().toISOString())

      queryClient.setQueryData(queryKeys.tasks.detail(taskId), updatedTask)
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'project', updatedTask.projectId] })
      toast.success(t('task.notesSaved'))
    },
    onError: (error: Error) => {
      toast.error(t('task.notesSaveFailed'), { description: error.message })
    },
  })

  useEffect(() => {
    isContentSeededRef.current = false
    isHydratingRef.current = false
    setIsDirty(false)
    setLastSavedAt(null)
    lastSavedHtmlRef.current = ''
  }, [taskId])

  useEffect(() => {
    if (!editor || !taskQuery.data || isContentSeededRef.current) {
      return
    }

    const notesHtml = taskQuery.data.notesHtml?.trim() ? taskQuery.data.notesHtml : '<p></p>'
    isHydratingRef.current = true
    editor.commands.setContent(notesHtml)
    isHydratingRef.current = false

    lastSavedHtmlRef.current = notesHtml
    setIsDirty(false)
    isContentSeededRef.current = true
  }, [editor, taskQuery.data])

  const handleBack = () => {
    const state = location.state as NotesLocationState | null
    if (state?.returnTo) {
      navigate(state.returnTo)
      return
    }

    if (Number.isFinite(workspaceId) && Number.isFinite(projectId)) {
      navigate(`/workspaces/${workspaceId}/projects/${projectId}?view=todo`)
      return
    }

    navigate('/dashboard')
  }

  const handleUploadImages = async (files: File[], dropPosition?: number) => {
    if (!editor || files.length === 0) {
      return
    }

    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      toast.error(t('task.notesImageOnlyError'))
      return
    }

    for (const file of imageFiles) {
      try {
        const uploaded = await storageApi.uploadSingle(file, `task-notes/${taskId}`)
        const insertAt = dropPosition ?? editor.state.selection.anchor

        editor
          .chain()
          .insertContentAt(insertAt, {
            type: 'image',
            attrs: {
              src: uploaded.fileUrl,
              alt: uploaded.fileName,
            },
          })
          .focus()
          .run()
      } catch (error) {
        const description = error instanceof Error ? error.message : 'Không thể upload ảnh'
        toast.error(t('task.notesUploadFailed'), { description })
      }
    }
  }

  const toolbarButtons = useMemo(() => {
    if (!editor) {
      return null
    }

    const items = [
      {
        label: 'H1',
        icon: Heading1,
        active: editor.isActive('heading', { level: 1 }),
        onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        label: 'H2',
        icon: Heading2,
        active: editor.isActive('heading', { level: 2 }),
        onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: 'Bold',
        icon: Bold,
        active: editor.isActive('bold'),
        onClick: () => editor.chain().focus().toggleBold().run(),
      },
      {
        label: 'Italic',
        icon: Italic,
        active: editor.isActive('italic'),
        onClick: () => editor.chain().focus().toggleItalic().run(),
      },
      {
        label: 'Underline',
        icon: UnderlineIcon,
        active: editor.isActive('underline'),
        onClick: () => editor.chain().focus().toggleUnderline().run(),
      },
      {
        label: 'Strike',
        icon: Strikethrough,
        active: editor.isActive('strike'),
        onClick: () => editor.chain().focus().toggleStrike().run(),
      },
      {
        label: 'Bulleted list',
        icon: List,
        active: editor.isActive('bulletList'),
        onClick: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: 'Ordered list',
        icon: ListOrdered,
        active: editor.isActive('orderedList'),
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        label: 'Quote',
        icon: Quote,
        active: editor.isActive('blockquote'),
        onClick: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        label: 'Code block',
        icon: Code,
        active: editor.isActive('codeBlock'),
        onClick: () => editor.chain().focus().toggleCodeBlock().run(),
      },
    ]

    return items.map((item) => (
      <Button
        key={item.label}
        type="button"
        variant={item.active ? 'default' : 'outline'}
        size="sm"
        className="h-8 px-2"
        onClick={item.onClick}
      >
        <item.icon className="size-3.5" />
      </Button>
    ))
  }, [editor])

  const canEditNotes = permissionsReady && canManageTask()

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('task.notesTitle')} description={t('task.notesInvalidDescription')} />
        <Button variant="outline" className="w-fit" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          {t('common.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('task.notesTitle')}
        description={t('task.notesPageDescription')}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4" />
              {t('common.back')}
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!editor || saveMutation.isPending || !isDirty || !canEditNotes}
            >
              {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t('task.notesSaveAction')}
            </Button>
          </>
        )}
      />

      {!canEditNotes && permissionsReady && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="font-medium">{t('task.notesViewOnlyTitle')}</span> {t('task.notesViewOnlyDescription')}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{taskQuery.data?.title ?? t('task.notesTaskFallback')}</CardTitle>
          <CardDescription>
            {lastSavedAt ? t('task.notesLastSaved', { date: formatDateTime(lastSavedAt) }) : t('task.notesNoRecentSave')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {taskQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('task.notesLoading')}
            </div>
          ) : !taskQuery.data ? (
            <div className="text-sm text-muted-foreground">{t('task.notesLoadFailed')}</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
                {toolbarButtons}
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => editor?.chain().focus().undo().run()}
                    disabled={!editor?.can().undo()}
                  >
                    <Undo2 className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => editor?.chain().focus().redo().run()}
                    disabled={!editor?.can().redo()}
                  >
                    <Redo2 className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!editor}
                  >
                    <ImagePlus className="size-3.5" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const selectedFiles = Array.from(event.target.files ?? [])
                      void handleUploadImages(selectedFiles)
                      event.target.value = ''
                    }}
                  />
                </div>
              </div>

              <div className={`task-notes-editor rounded-md border bg-background px-4 py-3 ${!canEditNotes ? 'pointer-events-none opacity-70' : ''}`}>
                <EditorContent editor={editor} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
