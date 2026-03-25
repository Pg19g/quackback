/**
 * Changelog Domain - Public API
 *
 * This module exports all public-facing types and functions for changelog operations.
 */

// Service functions
export {
  createChangelog,
  updateChangelog,
  deleteChangelog,
  getChangelogById,
} from './changelog.service'
export { listChangelogs, searchShippedPosts } from './changelog.query'
export { getPublicChangelogById, listPublicChangelogs } from './changelog.public'

// Types
export type {
  CreateChangelogInput,
  UpdateChangelogInput,
  PublishState,
  ListChangelogParams,
  ChangelogEntryWithDetails,
  ChangelogListResult,
  ChangelogAuthor,
  ChangelogLinkedPost,
  PublicChangelogEntry,
  PublicChangelogLinkedPost,
  PublicChangelogListResult,
} from './changelog.types'
