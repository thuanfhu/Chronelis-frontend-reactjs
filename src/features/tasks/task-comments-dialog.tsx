import { useEffect, useMemo, useState } from 'react'
import {
  CornerDownRight,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/datetime'
import type { TaskComment } from '@/types/domain'

const INITIAL_VISIBLE_TOP_LEVEL_COMMENTS = 4
const INITIAL_VISIBLE_REPLIES = 2
const LONG_COMMENT_THRESHOLD = 220

interface TaskCommentsDialogProps {
  open: boolean
  taskTitle: string
  comments: TaskComment[]
  canManageCurrentTask: boolean
  canModifyComment: (comment: TaskComment) => boolean
  newComment: string
  replyParentCommentId: number | null
  editingCommentId: number | null
  editingCommentContent: string
  addCommentPending: boolean
  updateCommentPending: boolean
  onOpenChange: (open: boolean) => void
  onNewCommentChange: (value: string) => void
  onReplyParentCommentChange: (commentId: number | null) => void
  onEditingCommentContentChange: (value: string) => void
  onStartEditing: (comment: TaskComment) => void
  onCancelEditing: () => void
  onAddComment: () => void
  onUpdateComment: () => void
  onDeleteComment: (commentId: number) => void
}

function toggleSetValue(previous: Set<number>, id: number) {
  const next = new Set(previous)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

function buildReplyMap(comments: TaskComment[]) {
  return comments.reduce<Map<number, TaskComment[]>>((map, comment) => {
    if (comment.parentCommentId == null) {
      return map
    }

    const currentReplies = map.get(comment.parentCommentId) ?? []
    currentReplies.push(comment)
    map.set(comment.parentCommentId, currentReplies)
    return map
  }, new Map<number, TaskComment[]>())
}

function hasLongCommentContent(content: string) {
  return content.trim().length > LONG_COMMENT_THRESHOLD || content.includes('\n')
}

interface ThreadCommentItemProps {
  comment: TaskComment
  depth: number
  repliesByParent: Map<number, TaskComment[]>
  expandedContentIds: Set<number>
  expandedReplyBranchIds: Set<number>
  editingCommentId: number | null
  editingCommentContent: string
  canManageCurrentTask: boolean
  canModifyComment: (comment: TaskComment) => boolean
  updateCommentPending: boolean
  onToggleContent: (commentId: number) => void
  onToggleReplyBranch: (commentId: number) => void
  onReply: (commentId: number) => void
  onStartEditing: (comment: TaskComment) => void
  onEditingCommentContentChange: (value: string) => void
  onCancelEditing: () => void
  onUpdateComment: () => void
  onDeleteComment: (commentId: number) => void
}

function ThreadCommentItem({
  comment,
  depth,
  repliesByParent,
  expandedContentIds,
  expandedReplyBranchIds,
  editingCommentId,
  editingCommentContent,
  canManageCurrentTask,
  canModifyComment,
  updateCommentPending,
  onToggleContent,
  onToggleReplyBranch,
  onReply,
  onStartEditing,
  onEditingCommentContentChange,
  onCancelEditing,
  onUpdateComment,
  onDeleteComment,
}: ThreadCommentItemProps) {
  const replies = repliesByParent.get(comment.id) ?? []
  const hasLongContent = hasLongCommentContent(comment.content)
  const contentExpanded = expandedContentIds.has(comment.id)
  const repliesExpanded = expandedReplyBranchIds.has(comment.id)
  const visibleReplies = repliesExpanded ? replies : replies.slice(0, INITIAL_VISIBLE_REPLIES)
  const isEditing = editingCommentId === comment.id

  return (
    <div className={cn('relative min-w-0', depth > 0 && 'pl-5')}>
      {depth > 0 ? (
        <span className="pointer-events-none absolute left-2 top-0 h-full w-px bg-border/70" aria-hidden />
      ) : null}

      <div className={cn(
        'rounded-2xl border p-3.5 shadow-sm transition-colors',
        depth === 0 ? 'bg-card/95' : 'bg-muted/28',
      )}>
        <div className="flex items-start gap-3">
          <Avatar className="mt-0.5 size-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {comment.user.firstName.charAt(0)}{comment.user.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" title={`${comment.user.firstName} ${comment.user.lastName}`}>
                  {comment.user.firstName} {comment.user.lastName}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(comment.createdAt)}</p>
              </div>

              {canManageCurrentTask ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground opacity-70 transition hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onReply(comment.id)}>
                      <CornerDownRight className="mr-2 size-3.5" />
                      Trả lời
                    </DropdownMenuItem>
                    {canModifyComment(comment) ? (
                      <>
                        <DropdownMenuItem onClick={() => onStartEditing(comment)}>
                          <Pencil className="mr-2 size-3.5" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDeleteComment(comment.id)}
                        >
                          <Trash2 className="mr-2 size-3.5" />
                          Xóa
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            {isEditing ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={editingCommentContent}
                  onChange={(event) => onEditingCommentContentChange(event.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" className="h-8 text-xs" onClick={onUpdateComment} disabled={updateCommentPending || !editingCommentContent.trim()}>
                    {updateCommentPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                    Lưu chỉnh sửa
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onCancelEditing}>
                    Hủy
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p
                  className={cn(
                    'mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/88',
                    hasLongContent && !contentExpanded && 'line-clamp-4',
                  )}
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {comment.content}
                </p>
                {hasLongContent ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                    onClick={() => onToggleContent(comment.id)}
                  >
                    {contentExpanded ? 'Thu gọn' : 'Xem thêm'}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {replies.length > 0 ? (
        <div className="mt-3 space-y-3">
          {visibleReplies.map((reply) => (
            <ThreadCommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              repliesByParent={repliesByParent}
              expandedContentIds={expandedContentIds}
              expandedReplyBranchIds={expandedReplyBranchIds}
              editingCommentId={editingCommentId}
              editingCommentContent={editingCommentContent}
              canManageCurrentTask={canManageCurrentTask}
              canModifyComment={canModifyComment}
              updateCommentPending={updateCommentPending}
              onToggleContent={onToggleContent}
              onToggleReplyBranch={onToggleReplyBranch}
              onReply={onReply}
              onStartEditing={onStartEditing}
              onEditingCommentContentChange={onEditingCommentContentChange}
              onCancelEditing={onCancelEditing}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
            />
          ))}

          {replies.length > INITIAL_VISIBLE_REPLIES ? (
            <button
              type="button"
              className="ml-5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onToggleReplyBranch(comment.id)}
            >
              {repliesExpanded ? 'Thu gọn nhánh trả lời' : `Xem thêm ${replies.length - INITIAL_VISIBLE_REPLIES} trả lời`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function TaskCommentsDialog({
  open,
  taskTitle,
  comments,
  canManageCurrentTask,
  canModifyComment,
  newComment,
  replyParentCommentId,
  editingCommentId,
  editingCommentContent,
  addCommentPending,
  updateCommentPending,
  onOpenChange,
  onNewCommentChange,
  onReplyParentCommentChange,
  onEditingCommentContentChange,
  onStartEditing,
  onCancelEditing,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: TaskCommentsDialogProps) {
  const [visibleRootCommentCount, setVisibleRootCommentCount] = useState(INITIAL_VISIBLE_TOP_LEVEL_COMMENTS)
  const [expandedContentIds, setExpandedContentIds] = useState<Set<number>>(new Set())
  const [expandedReplyBranchIds, setExpandedReplyBranchIds] = useState<Set<number>>(new Set())

  const repliesByParent = useMemo(() => buildReplyMap(comments), [comments])
  const topLevelComments = useMemo(
    () => comments.filter((comment) => comment.parentCommentId == null),
    [comments],
  )
  const commentById = useMemo(
    () => new Map(comments.map((comment) => [comment.id, comment] as const)),
    [comments],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    setVisibleRootCommentCount(INITIAL_VISIBLE_TOP_LEVEL_COMMENTS)
    setExpandedContentIds(new Set())
    setExpandedReplyBranchIds(new Set())
  }, [comments.length, open])

  const replyParent = replyParentCommentId != null ? commentById.get(replyParentCommentId) : null
  const visibleTopLevelComments = topLevelComments.slice(0, visibleRootCommentCount)
  const hasMoreTopLevelComments = topLevelComments.length > visibleRootCommentCount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,48rem)] w-[min(52rem,calc(100vw-1rem))] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4 text-primary" />
            Bình luận task
          </DialogTitle>
          <DialogDescription className="space-y-2 text-left leading-relaxed [&_strong]:break-all [&_strong]:font-semibold [&_strong]:text-foreground">
            <p>Thảo luận tập trung cho task này.</p>
            <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-sm font-medium text-foreground">
              <strong>{taskTitle}</strong>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="border-b bg-background/95 px-5 py-4 sm:px-6">
          {replyParent ? (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-primary">Đang trả lời {replyParent.user.firstName} {replyParent.user.lastName}</p>
                <p className="mt-1 line-clamp-2 text-muted-foreground" style={{ overflowWrap: 'anywhere' }}>{replyParent.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => onReplyParentCommentChange(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Textarea
              value={newComment}
              onChange={(event) => onNewCommentChange(event.target.value)}
              placeholder={canManageCurrentTask
                ? (replyParent ? 'Nhập nội dung trả lời...' : 'Nhập bình luận mới...')
                : 'Bạn không có quyền bình luận task này'}
              rows={3}
              className="min-h-24 flex-1 text-sm"
              disabled={!canManageCurrentTask}
            />
            <Button
              className="gap-1.5 sm:h-10 sm:self-end"
              onClick={onAddComment}
              disabled={addCommentPending || !newComment.trim() || !canManageCurrentTask}
            >
              {addCommentPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Gửi
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-5 py-4 sm:px-6">
          {topLevelComments.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-4 py-12 text-center">
              <MessageSquare className="size-9 text-muted-foreground/35" />
              <p className="mt-3 text-sm font-semibold">Chưa có bình luận nào</p>
              <p className="mt-1 max-w-sm text-xs leading-6 text-muted-foreground">
                Bắt đầu một luồng trao đổi gọn gàng để thảo luận, phản hồi và cập nhật tiến độ cho task này.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleTopLevelComments.map((comment) => (
                <div key={comment.id} className="group">
                  <ThreadCommentItem
                    comment={comment}
                    depth={0}
                    repliesByParent={repliesByParent}
                    expandedContentIds={expandedContentIds}
                    expandedReplyBranchIds={expandedReplyBranchIds}
                    editingCommentId={editingCommentId}
                    editingCommentContent={editingCommentContent}
                    canManageCurrentTask={canManageCurrentTask}
                    canModifyComment={canModifyComment}
                    updateCommentPending={updateCommentPending}
                    onToggleContent={(commentId) => setExpandedContentIds((previous) => toggleSetValue(previous, commentId))}
                    onToggleReplyBranch={(commentId) => setExpandedReplyBranchIds((previous) => toggleSetValue(previous, commentId))}
                    onReply={(commentId) => {
                      onReplyParentCommentChange(commentId)
                      onCancelEditing()
                    }}
                    onStartEditing={onStartEditing}
                    onEditingCommentContentChange={onEditingCommentContentChange}
                    onCancelEditing={onCancelEditing}
                    onUpdateComment={onUpdateComment}
                    onDeleteComment={onDeleteComment}
                  />
                </div>
              ))}

              {hasMoreTopLevelComments ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setVisibleRootCommentCount((count) => count + INITIAL_VISIBLE_TOP_LEVEL_COMMENTS)}
                  >
                    Xem thêm bình luận
                  </Button>
                </div>
              ) : topLevelComments.length > INITIAL_VISIBLE_TOP_LEVEL_COMMENTS ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => setVisibleRootCommentCount(INITIAL_VISIBLE_TOP_LEVEL_COMMENTS)}
                  >
                    Thu gọn danh sách bình luận
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}