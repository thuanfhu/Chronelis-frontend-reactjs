import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft,
  CornerDownRight,
  Lock,
  Loader2,
  MessageSquare,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/utils/datetime'
import type { TaskComment } from '@/types/domain'

interface TaskCommentsPanelProps {
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
  onBack: () => void
  onNewCommentChange: (value: string) => void
  onReplyParentCommentChange: (commentId: number | null) => void
  onEditingCommentContentChange: (value: string) => void
  onStartEditing: (comment: TaskComment) => void
  onCancelEditing: () => void
  onAddComment: () => void
  onUpdateComment: () => void
  onDeleteComment: (commentId: number) => void
}

export function TaskCommentsPanel({
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
  onBack,
  onNewCommentChange,
  onReplyParentCommentChange,
  onEditingCommentContentChange,
  onStartEditing,
  onCancelEditing,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: TaskCommentsPanelProps) {
  const { t } = useTranslation()
  const orderedComments = useMemo(
    () => [...comments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [comments],
  )
  const featuredComments = orderedComments.slice(0, 3)

  const commentById = useMemo(() => new Map(comments.map((comment) => [comment.id, comment] as const)), [comments])

  const replyParent = replyParentCommentId != null ? commentById.get(replyParentCommentId) : null

  return (
    <div className="min-h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_32%),linear-gradient(180deg,rgba(9,14,25,0.98),rgba(9,14,25,0.94))]">
      <div className="border-b border-border/70 bg-background/80 px-6 py-5 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <MessageSquare className="size-3.5" />
              {t('task.comments')}
            </div>
            <h3 className="mt-3 text-sm font-semibold" style={{ overflowWrap: 'anywhere' }}>
              {taskTitle}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('task.commentsDialogDescription')}</p>
          </div>

          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={onBack}>
            <ChevronLeft className="size-3.5" />
            {t('task.commentDetails')}
          </Button>
        </div>

        <div className="mt-4 rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(247,250,255,0.88))] p-4 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.3)] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(10,18,32,0.78))]">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner shadow-primary/10">
              <Sparkles className="size-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{t('task.commentsFeedTitle')}</p>
                <span className="inline-flex h-6 items-center rounded-full border border-border/70 bg-background/70 px-2.5 text-[11px] font-medium text-muted-foreground dark:bg-background/20">
                  {t('task.commentsCount', { count: comments.length })}
                </span>
              </div>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{t('task.commentsFeedDescription')}</p>

              {featuredComments.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {featuredComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm dark:bg-background/15"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {comment.user.firstName.charAt(0)}
                        {comment.user.lastName.charAt(0)}
                      </span>
                      <span className="truncate" style={{ maxWidth: '10rem' }}>
                        {comment.user.firstName} {comment.user.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {replyParent ? (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-3xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-primary">
                {t('task.commentsReplyingTo', { name: `${replyParent.user.firstName} ${replyParent.user.lastName}` })}
              </p>
              <p className="mt-1 line-clamp-2 text-muted-foreground" style={{ overflowWrap: 'anywhere' }}>
                {replyParent.content}
              </p>
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

        {canManageCurrentTask ? (
          <div className="mt-4 rounded-[30px] border border-border/70 bg-card/95 p-4 shadow-[0_24px_52px_-38px_rgba(15,23,42,0.35)]">
            <Textarea
              value={newComment}
              onChange={(event) => onNewCommentChange(event.target.value)}
              placeholder={replyParent ? t('task.commentReplyPlaceholder') : t('task.commentPlaceholder')}
              rows={4}
              className="min-h-28 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
            />

            <div className="mt-3 flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                {comments.length === 0
                  ? t('task.commentsFirstThreadHint')
                  : t('task.commentsVisibleCount', { count: comments.length })}
              </p>
              <Button
                className="gap-1.5 sm:h-9"
                onClick={onAddComment}
                disabled={addCommentPending || !newComment.trim()}
              >
                {addCommentPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {t('task.commentSend')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[30px] border border-border/70 bg-card/95 p-4 shadow-[0_22px_50px_-38px_rgba(15,23,42,0.3)]">
            <div className="flex items-start gap-3 rounded-[22px] border border-dashed border-border/80 bg-muted/25 px-4 py-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Lock className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t('task.commentsReadOnlyTitle')}</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{t('task.commentsReadOnlyDescription')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 px-6 py-5">
        {orderedComments.length === 0 ? (
          <div className="rounded-[30px] border border-dashed bg-muted/15 px-5 py-10 text-center">
            <MessageSquare className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-semibold">{t('task.noComments')}</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{t('task.commentsEmptyDescription')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orderedComments.map((comment, index) => {
              const replyTarget = comment.parentCommentId != null ? commentById.get(comment.parentCommentId) : null
              const isEditing = editingCommentId === comment.id

              return (
                <div key={comment.id} className="relative pl-14">
                  {index < orderedComments.length - 1 ? (
                    <span className="absolute left-[1.2rem] top-11 -bottom-5 w-px rounded-full bg-[linear-gradient(180deg,rgba(148,163,184,0.45),rgba(148,163,184,0.08))]" />
                  ) : null}

                  <Avatar className="absolute left-0 top-0 size-10 shrink-0 border border-border/70 shadow-sm">
                    <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                      {comment.user.firstName.charAt(0)}
                      {comment.user.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <article className="overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 shadow-[0_24px_52px_-36px_rgba(15,23,42,0.35)] dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(10,18,32,0.82))]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">
                            {comment.user.firstName} {comment.user.lastName}
                          </p>
                          <span className="text-[11px] text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                          {replyTarget ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
                              <CornerDownRight className="size-3" />
                              {t('task.commentReplyTo', { name: replyTarget.user.firstName })}
                            </span>
                          ) : null}
                        </div>

                        {replyTarget ? (
                          <div className="mt-3 rounded-[22px] border border-border/70 bg-muted/25 px-3 py-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">
                              {replyTarget.user.firstName} {replyTarget.user.lastName}
                            </p>
                            <p
                              className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground"
                              style={{ overflowWrap: 'anywhere' }}
                            >
                              {replyTarget.content}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 space-y-2">
                        <Textarea
                          value={editingCommentContent}
                          onChange={(event) => onEditingCommentContentChange(event.target.value)}
                          rows={3}
                          className="rounded-[20px] border-border/70 bg-background/80 text-sm"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={onUpdateComment}
                            disabled={updateCommentPending || !editingCommentContent.trim()}
                          >
                            {updateCommentPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                            {t('task.commentSave')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={onCancelEditing}
                          >
                            {t('task.commentCancelEdit')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p
                          className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90"
                          style={{ overflowWrap: 'anywhere' }}
                        >
                          {comment.content}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {canManageCurrentTask ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-full border border-transparent bg-background/60 px-3 text-xs shadow-sm hover:border-border/70 hover:bg-background"
                              onClick={() => {
                                onReplyParentCommentChange(comment.id)
                                onCancelEditing()
                              }}
                            >
                              <CornerDownRight className="mr-1.5 size-3.5" />
                              {t('task.commentReply')}
                            </Button>
                          ) : null}

                          {canModifyComment(comment) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-full border border-transparent bg-background/60 px-3 text-xs shadow-sm hover:border-border/70 hover:bg-background"
                              onClick={() => onStartEditing(comment)}
                            >
                              <Pencil className="mr-1.5 size-3.5" />
                              {t('task.commentEdit')}
                            </Button>
                          ) : null}

                          {canModifyComment(comment) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-full border border-transparent bg-background/60 px-3 text-xs text-destructive shadow-sm hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                              onClick={() => onDeleteComment(comment.id)}
                            >
                              <Trash2 className="mr-1.5 size-3.5" />
                              {t('task.commentDelete')}
                            </Button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </article>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
