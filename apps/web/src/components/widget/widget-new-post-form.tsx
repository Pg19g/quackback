'use client'

import { useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWidgetAuth } from './widget-auth-provider'

interface WidgetNewPostFormProps {
  boards: { id: string; name: string; slug: string }[]
  prefilledTitle?: string
  selectedBoardSlug?: string
  onSuccess: (post: {
    id: string
    title: string
    voteCount: number
    statusId: string | null
    board: { id: string; name: string; slug: string }
  }) => void
  anonymousPostingEnabled?: boolean
}

export function WidgetNewPostForm({
  boards,
  prefilledTitle,
  selectedBoardSlug,
  onSuccess,
  anonymousPostingEnabled = false,
}: WidgetNewPostFormProps) {
  const {
    isIdentified,
    hmacRequired,
    user,
    emitEvent,
    metadata,
    ensureSession,
    identifyWithEmail,
  } = useWidgetAuth()
  const canPost = isIdentified || anonymousPostingEnabled

  if (!canPost && hmacRequired) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm font-medium text-foreground">Want to share an idea?</p>
        <button
          type="button"
          onClick={() =>
            window.parent.postMessage(
              { type: 'quackback:navigate', url: `${window.location.origin}/auth/login` },
              '*'
            )
          }
          className="text-xs text-primary hover:text-primary/80 transition-colors mt-1"
        >
          Log in to submit your feedback
        </button>
      </div>
    )
  }

  const needsEmail = !isIdentified && !hmacRequired && !anonymousPostingEnabled

  const defaultBoard = selectedBoardSlug
    ? boards.find((b) => b.slug === selectedBoardSlug)
    : boards[0]

  const [boardId, setBoardId] = useState(defaultBoard?.id ?? boards[0]?.id ?? '')
  const [title, setTitle] = useState(prefilledTitle ?? '')
  const [content, setContent] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (prefilledTitle) {
        descriptionRef.current?.focus()
      } else {
        titleRef.current?.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [prefilledTitle])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !boardId || isSubmitting) return
    if (needsEmail && !email.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      if (needsEmail) {
        const identified = await identifyWithEmail(email.trim(), name.trim() || undefined)
        if (!identified) {
          setError('Could not verify your email. Please try again.')
          setIsSubmitting(false)
          return
        }
      } else if (!isIdentified) {
        const ok = await ensureSession()
        if (!ok) {
          setError('Could not create session. Please try again.')
          setIsSubmitting(false)
          return
        }
      }

      const { getWidgetAuthHeaders } = await import('@/lib/client/widget-auth')
      const { createPublicPostFn } = await import('@/lib/server/functions/public-posts')
      const result = await createPublicPostFn({
        data: {
          boardId,
          title: title.trim(),
          content: content.trim(),
          metadata: metadata ?? undefined,
        },
        headers: getWidgetAuthHeaders(),
      })

      emitEvent('post:created', {
        id: result.id,
        title: result.title,
        board: result.board,
        statusId: result.statusId ?? null,
      })

      onSuccess({
        id: result.id,
        title: result.title,
        voteCount: 0,
        statusId: result.statusId ?? null,
        board: result.board,
      })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = title.trim() && (!needsEmail || email.trim())

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Scrollable body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 pt-1 pb-3">
          {/* Board selector */}
          {boards.length > 1 && (
            <div className="flex items-center pb-1">
              <span className="text-xs text-muted-foreground mr-1">Posting to</span>
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger
                  size="xs"
                  className="border-0 bg-transparent shadow-none font-medium text-foreground hover:text-foreground/80 focus-visible:ring-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {boards.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs py-1">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            placeholder="What's your idea?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full bg-transparent text-base font-semibold text-foreground placeholder:text-muted-foreground/50 placeholder:font-normal border-0 outline-none caret-primary py-1"
          />

          {/* Description */}
          <textarea
            ref={descriptionRef}
            placeholder="Add more details..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={10000}
            rows={5}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 border-0 outline-none caret-primary resize-none leading-relaxed mt-1"
          />

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive mt-2">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Pinned footer */}
      <div className="border-t border-border bg-muted/30 shrink-0">
        {needsEmail && (
          <div className="px-4 pt-2.5 pb-1 flex gap-2">
            <input
              type="email"
              required
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-0 bg-background rounded-md border border-border/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-[110px] bg-background rounded-md border border-border/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-2.5">
          <p className="text-xs text-muted-foreground truncate mr-2">
            {user ? (
              <>
                Posting as{' '}
                <span className="font-medium text-foreground">{user.name || user.email}</span>
              </>
            ) : needsEmail ? (
              email.trim() ? (
                <>
                  Posting as <span className="font-medium text-foreground">{email.trim()}</span>
                </>
              ) : (
                'Your email is required'
              )
            ) : (
              'Posting anonymously'
            )}
          </p>
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </form>
  )
}
