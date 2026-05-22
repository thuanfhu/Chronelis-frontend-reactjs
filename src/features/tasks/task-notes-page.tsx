import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Code,
  Heading1,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Paintbrush,
  Quote,
  Redo2,
  Save,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import FileHandler from '@tiptap/extension-file-handler'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { queryKeys } from '@/lib/api/query-keys'
import { storageApi } from '@/lib/api/modules/storage-api'
import { taskApi } from '@/lib/api/modules/task-api'
import { formatDateTime } from '@/lib/utils/datetime'
import { useProjectPermissions } from '@/lib/permissions/use-project-permissions'
import { useTaskRealtime } from '@/lib/websocket/use-domain-realtime'
import { cn } from '@/lib/utils'
import '@/styles/task-notes-editor.css'

interface NotesLocationState {
  returnTo?: string
}

const TEXT_COLORS = ['#111827', '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#DB2777']
const HIGHLIGHT_COLORS = ['#FEF3C7', '#DBEAFE', '#EDE9FE', '#DCFCE7', '#FFE4E6']
const FONT_SIZES = [
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '24', value: '24px' },
]

const RichTextStyle = Mark.create({
  name: 'textStyle',
  priority: 101,

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.color || null,
      },
      backgroundColor: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.backgroundColor || null,
      },
      fontSize: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.fontSize || null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (node) => {
          const element = node as HTMLElement
          return element.hasAttribute('style') ? {} : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { color, backgroundColor, fontSize, style, ...attrs } = HTMLAttributes
    const mergedStyle = [
      style,
      color ? `color: ${color}` : '',
      backgroundColor ? `background-color: ${backgroundColor}` : '',
      fontSize ? `font-size: ${fontSize}` : '',
    ]
      .filter(Boolean)
      .join('; ')

    return ['span', mergeAttributes(attrs, mergedStyle ? { style: mergedStyle } : {}), 0]
  },
})

const RichImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width') || (element as HTMLElement).style.width || null,
      },
      dataAlign: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const { width, dataAlign, style, ...attrs } = HTMLAttributes
    const align = dataAlign === 'left' || dataAlign === 'right' || dataAlign === 'center' ? dataAlign : 'center'
    const marginStyle =
      align === 'left'
        ? 'margin-left: 0; margin-right: auto'
        : align === 'right'
          ? 'margin-left: auto; margin-right: 0'
          : 'margin-left: auto; margin-right: auto'

    const mergedStyle = [style, width ? `width: ${width}` : '', marginStyle].filter(Boolean).join('; ')

    return ['img', mergeAttributes(attrs, { style: mergedStyle, 'data-align': align }), 0]
  },
})

const WordLikeShortcuts = Extension.create({
  name: 'wordLikeShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-u': () => this.editor.commands.toggleUnderline(),
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-Alt-1': () => this.editor.commands.toggleHeading({ level: 1 }),
      'Mod-Alt-2': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
    }
  },
})

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
  const [, setEditorRevision] = useState(0)
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
      RichTextStyle,
      RichImage.configure({
        allowBase64: false,
      }),
      WordLikeShortcuts,
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
      setEditorRevision((value) => value + 1)
      if (isHydratingRef.current) {
        return
      }

      const html = currentEditor.getHTML()
      setIsDirty(html !== lastSavedHtmlRef.current)
    },
    onSelectionUpdate: () => {
      setEditorRevision((value) => value + 1)
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

  const canEditNotes = permissionsReady && canManageTask()
  const imageSelected = editor?.isActive('image') ?? false
  const selectedImageWidth = getImageWidth(editor?.getAttributes('image').width)

  useEffect(() => {
    editor?.setEditable(canEditNotes)
  }, [canEditNotes, editor])

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

    let insertAt = dropPosition ?? editor.state.selection.anchor
    for (const file of imageFiles) {
      try {
        const uploaded = await storageApi.uploadSingle(file, `task-notes/${taskId}`)

        editor
          .chain()
          .insertContentAt(insertAt, {
            type: 'image',
            attrs: {
              src: uploaded.fileUrl,
              alt: uploaded.fileName,
              width: '100%',
              dataAlign: 'center',
            },
          })
          .focus()
          .run()
        insertAt += 1
      } catch (error) {
        const description = error instanceof Error ? error.message : 'Không thể upload ảnh'
        toast.error(t('task.notesUploadFailed'), { description })
      }
    }
  }

  const applyTextColor = (color: string) => {
    editor?.chain().focus().setMark('textStyle', { color }).run()
  }

  const applyHighlight = (backgroundColor: string) => {
    editor?.chain().focus().setMark('textStyle', { backgroundColor }).run()
  }

  const applyFontSize = (fontSize: string) => {
    editor?.chain().focus().setMark('textStyle', { fontSize }).run()
  }

  const clearMarks = () => {
    editor?.chain().focus().unsetAllMarks().run()
  }

  const updateImageWidth = (delta: number) => {
    if (!editor || !imageSelected) return
    const nextWidth = Math.min(100, Math.max(25, selectedImageWidth + delta))
    editor
      .chain()
      .focus()
      .updateAttributes('image', { width: `${nextWidth}%` })
      .run()
  }

  const alignImage = (dataAlign: 'left' | 'center' | 'right') => {
    editor?.chain().focus().updateAttributes('image', { dataAlign }).run()
  }

  const deleteSelectedImage = () => {
    editor?.chain().focus().deleteSelection().run()
  }

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
        actions={
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
        }
      />

      {!canEditNotes && permissionsReady && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="font-medium">{t('task.notesViewOnlyTitle')}</span> {t('task.notesViewOnlyDescription')}
        </div>
      )}

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/20 pb-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base">{taskQuery.data?.title ?? t('task.notesTaskFallback')}</CardTitle>
              <CardDescription>
                {lastSavedAt
                  ? t('task.notesLastSaved', { date: formatDateTime(lastSavedAt) })
                  : t('task.notesNoRecentSave')}
              </CardDescription>
            </div>
            <div className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              Ctrl/Cmd+B, I, U · Ctrl/Cmd+Alt+1/2 · Ctrl/Cmd+Shift+7/8
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {taskQuery.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('task.notesLoading')}
            </div>
          ) : !taskQuery.data ? (
            <div className="p-6 text-sm text-muted-foreground">{t('task.notesLoadFailed')}</div>
          ) : (
            <>
              <div className="sticky top-0 z-10 space-y-2 border-b border-border/70 bg-background/95 p-3 backdrop-blur">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ToolbarButton
                    title="Heading 1"
                    active={editor?.isActive('heading', { level: 1 })}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  >
                    <Heading1 className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Heading 2"
                    active={editor?.isActive('heading', { level: 2 })}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  >
                    <Heading2 className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Bold (Ctrl/Cmd+B)"
                    active={editor?.isActive('bold')}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                  >
                    <Bold className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Italic (Ctrl/Cmd+I)"
                    active={editor?.isActive('italic')}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                  >
                    <Italic className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Underline (Ctrl/Cmd+U)"
                    active={editor?.isActive('underline')}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  >
                    <UnderlineIcon className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Strike"
                    active={editor?.isActive('strike')}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleStrike().run()}
                  >
                    <Strikethrough className="size-4" />
                  </ToolbarButton>
                  <ToolbarDivider />
                  <ToolbarButton
                    title="Bulleted list"
                    active={editor?.isActive('bulletList')}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  >
                    <List className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Ordered list"
                    active={editor?.isActive('orderedList')}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  >
                    <ListOrdered className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Quote"
                    active={editor?.isActive('blockquote')}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  >
                    <Quote className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Code block"
                    active={editor?.isActive('codeBlock')}
                    disabled={!canEditNotes}
                    onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                  >
                    <Code className="size-4" />
                  </ToolbarButton>
                  <ToolbarDivider />
                  <ToolbarButton
                    title="Undo"
                    disabled={!canEditNotes || !editor?.can().undo()}
                    onClick={() => editor?.chain().focus().undo().run()}
                  >
                    <Undo2 className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Redo"
                    disabled={!canEditNotes || !editor?.can().redo()}
                    onClick={() => editor?.chain().focus().redo().run()}
                  >
                    <Redo2 className="size-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    title="Upload image"
                    disabled={!canEditNotes}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="size-4" />
                  </ToolbarButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const selectedFiles = Array.from(event.target.files ?? [])
                      void handleUploadImages(selectedFiles)
                      event.target.value = ''
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-border/70 bg-muted/25 px-2 py-1">
                    <Paintbrush className="size-3.5 text-muted-foreground" />
                    {TEXT_COLORS.map((color) => (
                      <ColorButton
                        key={color}
                        color={color}
                        disabled={!canEditNotes}
                        onClick={() => applyTextColor(color)}
                      />
                    ))}
                    <Input
                      type="color"
                      className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                      disabled={!canEditNotes}
                      onChange={(event) => applyTextColor(event.target.value)}
                      title="Custom text color"
                    />
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-border/70 bg-muted/25 px-2 py-1">
                    <Highlighter className="size-3.5 text-muted-foreground" />
                    {HIGHLIGHT_COLORS.map((color) => (
                      <ColorButton
                        key={color}
                        color={color}
                        disabled={!canEditNotes}
                        onClick={() => applyHighlight(color)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-border/70 bg-muted/25 px-2 py-1">
                    <span className="text-xs font-semibold text-muted-foreground">Size</span>
                    {FONT_SIZES.map((size) => (
                      <Button
                        key={size.value}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={!canEditNotes}
                        onClick={() => applyFontSize(size.value)}
                      >
                        {size.label}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={!canEditNotes}
                      onClick={clearMarks}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {imageSelected && (
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5">
                    <span className="px-1 text-xs font-semibold text-primary">Image {selectedImageWidth}%</span>
                    <ToolbarButton
                      title="Zoom out image"
                      disabled={!canEditNotes}
                      onClick={() => updateImageWidth(-10)}
                    >
                      <ZoomOut className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Zoom in image" disabled={!canEditNotes} onClick={() => updateImageWidth(10)}>
                      <ZoomIn className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Align image left" disabled={!canEditNotes} onClick={() => alignImage('left')}>
                      <AlignLeft className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Align image center"
                      disabled={!canEditNotes}
                      onClick={() => alignImage('center')}
                    >
                      <AlignCenter className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Align image right"
                      disabled={!canEditNotes}
                      onClick={() => alignImage('right')}
                    >
                      <AlignRight className="size-4" />
                    </ToolbarButton>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 gap-1 px-2"
                      disabled={!canEditNotes}
                      onClick={deleteSelectedImage}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  'task-notes-editor bg-background px-5 py-4',
                  !canEditNotes && 'pointer-events-none opacity-75',
                )}
              >
                <EditorContent editor={editor} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ToolbarButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      title={title}
      aria-label={title}
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-8 w-8 p-0"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function ToolbarDivider() {
  return <span className="mx-1 h-6 w-px bg-border" />
}

function ColorButton({ color, disabled, onClick }: { color: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="size-5 rounded-full border border-background shadow-sm ring-1 ring-border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: color }}
      disabled={disabled}
      onClick={onClick}
      aria-label={`Apply ${color}`}
    />
  )
}

function getImageWidth(value: unknown): number {
  if (typeof value !== 'string' || !value.trim()) {
    return 100
  }

  const parsed = Number.parseInt(value.replace('%', ''), 10)
  if (!Number.isFinite(parsed)) {
    return 100
  }

  return Math.min(100, Math.max(25, parsed))
}
