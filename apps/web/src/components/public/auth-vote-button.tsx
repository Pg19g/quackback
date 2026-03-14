import { useAuthPopover } from '@/components/auth/auth-popover-context'
import { useEnsureAnonSession } from '@/lib/client/hooks/use-ensure-anon-session'
import { VoteButton } from './vote-button'
import type { PostId } from '@quackback/ids'

interface AuthVoteButtonProps {
  postId: PostId
  voteCount: number
  /** Whether voting is disabled (e.g. merged post) */
  disabled?: boolean
  /** Whether anonymous voting is allowed (sign in silently instead of showing auth dialog) */
  canVote?: boolean
  /** Compact horizontal variant for inline use */
  compact?: boolean
  /** Pill variant — vertical, self-stretches to parent height */
  pill?: boolean
}

/**
 * VoteButton wrapper that shows auth dialog when unauthenticated user tries to vote.
 * When canVote is true, silently signs in anonymously before the vote fires.
 */
export function AuthVoteButton({
  postId,
  voteCount,
  disabled = false,
  canVote = false,
  compact = false,
  pill = false,
}: AuthVoteButtonProps): React.ReactElement {
  const { openAuthPopover } = useAuthPopover()
  const ensureAnonSession = useEnsureAnonSession()

  function handleAuthRequired(): void {
    openAuthPopover({ mode: 'login' })
  }

  return (
    <VoteButton
      postId={postId}
      voteCount={voteCount}
      disabled={disabled}
      onAuthRequired={disabled ? handleAuthRequired : undefined}
      onBeforeVote={canVote ? ensureAnonSession : undefined}
      compact={compact}
      pill={pill}
    />
  )
}
