'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlassIcon, Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/solid'
import { LightBulbIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/shared/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WidgetVoteButton } from './widget-vote-button'
import { useWidgetAuth } from './widget-auth-provider'
import type { PostId } from '@quackback/ids'

interface WidgetPost {
  id: string
  title: string
  voteCount: number
  statusId: string | null
  commentCount: number
  board?: { id: string; name: string; slug: string }
}

interface StatusInfo {
  id: string
  name: string
  color: string
}

interface BoardInfo {
  id: string
  name: string
  slug: string
}

interface WidgetHomeProps {
  initialPosts: WidgetPost[]
  statuses: StatusInfo[]
  boards: BoardInfo[]
  defaultBoard?: string
  onPostSelect?: (postId: string) => void
  onPostCreated?: (post: {
    id: string
    title: string
    voteCount: number
    statusId: string | null
    board: { id: string; name: string; slug: string }
  }) => void
  anonymousVotingEnabled?: boolean
  anonymousPostingEnabled?: boolean
}

interface SearchResult {
  posts: WidgetPost[]
}

const searchCache = new Map<string, SearchResult>()

export function WidgetHome({
  initialPosts,
  statuses,
  boards,
  onPostSelect,
  onPostCreated,
  anonymousVotingEnabled = true,
  anonymousPostingEnabled = false,
}: WidgetHomeProps) {
  const {
    ensureSession,
    isIdentified,
    hmacRequired,
    user,
    emitEvent,
    metadata,
    identifyWithEmail,
  } = useWidgetAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const canVote = isIdentified || anonymousVotingEnabled
  const canPost = isIdentified || anonymousPostingEnabled
  const needsEmail = !isIdentified && !hmacRequired && !anonymousPostingEnabled

  const handleAuthRequired = useCallback(
    (postId: string) => {
      if (!hmacRequired && onPostSelect) {
        onPostSelect(postId)
      } else {
        window.parent.postMessage(
          { type: 'quackback:navigate', url: `${window.location.origin}/auth/login` },
          '*'
        )
      }
    },
    [hmacRequired, onPostSelect]
  )

  // Input + search state
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Expanded create form state
  const [expanded, setExpanded] = useState(false)
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id ?? '')
  const [content, setContent] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses])

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = query.trim()
    if (!q) {
      setSearchResults(null)
      setIsSearching(false)
      return
    }

    const cached = searchCache.get(q)
    if (cached) {
      setSearchResults(cached)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, limit: '5' })
        const res = await fetch(`/api/widget/search?${params}`)
        const json = await res.json()
        const result: SearchResult = { posts: json.data?.posts ?? [] }
        searchCache.set(q, result)
        setSearchResults(result)
      } catch {
        setSearchResults({ posts: [] })
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (expanded) {
        e.nativeEvent.stopImmediatePropagation()
        collapseForm()
      } else if (query) {
        e.nativeEvent.stopImmediatePropagation()
        setQuery('')
      }
    }
    if (e.key === 'Enter' && query.trim() && !expanded) {
      e.preventDefault()
      expandForm()
    }
  }

  function expandForm() {
    setExpanded(true)
  }

  function collapseForm() {
    setExpanded(false)
    setContent('')
    setEmail('')
    setName('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || !selectedBoardId || isSubmitting) return
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
      } else if (!canPost) {
        if (hmacRequired) {
          window.parent.postMessage(
            { type: 'quackback:navigate', url: `${window.location.origin}/auth/login` },
            '*'
          )
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
          boardId: selectedBoardId,
          title: query.trim(),
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

      onPostCreated?.({
        id: result.id,
        title: result.title,
        voteCount: 0,
        statusId: result.statusId ?? null,
        board: result.board,
      })

      // Reset form
      setQuery('')
      collapseForm()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSearchMode = query.trim().length > 0
  const displayPosts = isSearchMode ? (searchResults?.posts ?? []) : initialPosts
  const sectionLabel = isSearchMode
    ? isSearching
      ? 'Searching...'
      : displayPosts.length > 0
        ? 'Similar ideas'
        : null
    : 'Popular ideas'

  const truncatedQuery = query.trim().length > 30 ? query.trim().slice(0, 30) + '...' : query.trim()

  const canSubmitForm = query.trim() && (!needsEmail || email.trim()) && (canPost || needsEmail)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Title input — doubles as search */}
      <div className="px-3 pt-1 pb-1 shrink-0">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="What's your idea?"
            className={cn(
              'w-full pl-8 pr-8 py-2 text-sm rounded-lg border bg-muted/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-background transition-colors',
              expanded ? 'border-primary font-semibold bg-background' : 'border-border'
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                if (expanded) collapseForm()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-sm hover:bg-muted transition-colors"
              aria-label="Clear"
            >
              <XMarkIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded create form */}
      {expanded && (
        <div className="px-3 shrink-0">
          <div className="px-1 pb-2 space-y-2">
            {boards.length > 1 && (
              <div className="flex items-center">
                <span className="text-[11px] text-muted-foreground/70">Posting to</span>
                <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
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
            <textarea
              placeholder="Add more details..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={10000}
              rows={3}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 border-0 outline-none caret-primary resize-none leading-relaxed"
            />
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post list */}
      <ScrollArea className="flex-1 min-h-0 px-3 pb-2">
        {sectionLabel && (
          <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide px-1 py-1.5">
            {sectionLabel}
          </p>
        )}

        {!isSearchMode && !expanded && displayPosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <LightBulbIcon className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground/70">No ideas yet</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">Be the first to share one!</p>
          </div>
        )}

        {displayPosts.length > 0 && (
          <div className="space-y-1">
            {displayPosts.map((post) => {
              const status = post.statusId ? (statusMap.get(post.statusId) ?? null) : null

              return (
                <div
                  key={post.id}
                  className="flex items-center gap-2 rounded-lg hover:bg-muted/30 transition-colors px-2 py-1.5 cursor-pointer"
                  onClick={() => onPostSelect?.(post.id)}
                >
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <WidgetVoteButton
                      postId={post.id as PostId}
                      voteCount={post.voteCount}
                      onBeforeVote={canVote ? ensureSession : undefined}
                      onAuthRequired={!canVote ? () => handleAuthRequired(post.id) : undefined}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground line-clamp-1">
                      {post.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {status && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <span
                            className="size-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </span>
                      )}
                      {post.board && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                          <Squares2X2Icon className="h-2.5 w-2.5 text-muted-foreground/40" />
                          {post.board.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Search mode: show create CTA */}
        {isSearchMode && !isSearching && searchResults && !expanded && (
          <div
            className={cn(
              'mt-2 px-1',
              searchResults.posts.length > 0 && 'border-t border-border/50 pt-2'
            )}
          >
            {searchResults.posts.length === 0 && (
              <p className="text-sm text-muted-foreground mb-1">No matching ideas found</p>
            )}
            {searchResults.posts.length > 0 && (
              <p className="text-xs text-muted-foreground/60 mb-0.5">Don&apos;t see your idea?</p>
            )}
            <button
              type="button"
              onClick={expandForm}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Submit &ldquo;{truncatedQuery}&rdquo; as new idea &rarr;
            </button>
          </div>
        )}
      </ScrollArea>

      {/* Pinned footer — only when expanded */}
      {expanded && (
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
              disabled={!canSubmitForm || isSubmitting}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
