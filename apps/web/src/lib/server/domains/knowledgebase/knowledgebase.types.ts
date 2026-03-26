/**
 * Types for Knowledge Base domain
 */

import type { TiptapContent } from '@/lib/server/db'
import type { KnowledgebaseCategoryId, KnowledgebaseArticleId, PrincipalId } from '@quackback/ids'

// ============================================================================
// Category Types
// ============================================================================

export interface KnowledgebaseCategory {
  id: KnowledgebaseCategoryId
  slug: string
  name: string
  description: string | null
  isPublic: boolean
  position: number
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgebaseCategoryWithCount extends KnowledgebaseCategory {
  articleCount: number
}

export interface CreateCategoryInput {
  name: string
  slug?: string
  description?: string
  isPublic?: boolean
  position?: number
}

export interface UpdateCategoryInput {
  name?: string
  slug?: string
  description?: string | null
  isPublic?: boolean
  position?: number
}

// ============================================================================
// Article Types
// ============================================================================

export interface KnowledgebaseArticle {
  id: KnowledgebaseArticleId
  categoryId: KnowledgebaseCategoryId
  slug: string
  title: string
  content: string
  contentJson: TiptapContent | null
  principalId: PrincipalId
  publishedAt: Date | null
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgebaseArticleWithCategory extends KnowledgebaseArticle {
  category: {
    id: KnowledgebaseCategoryId
    slug: string
    name: string
  }
  author: {
    id: PrincipalId
    name: string
    avatarUrl: string | null
  } | null
}

export interface CreateArticleInput {
  categoryId: string
  title: string
  content: string
  contentJson?: TiptapContent | null
  slug?: string
}

export interface UpdateArticleInput {
  categoryId?: string
  title?: string
  content?: string
  contentJson?: TiptapContent | null
  slug?: string
}

// ============================================================================
// List/Search Types
// ============================================================================

export interface ListArticlesParams {
  categoryId?: string
  status?: 'draft' | 'published' | 'all'
  search?: string
  cursor?: string
  limit?: number
}

export interface ArticleListResult {
  items: KnowledgebaseArticleWithCategory[]
  nextCursor: string | null
  hasMore: boolean
}

export interface PublicArticleListResult {
  items: KnowledgebaseArticleWithCategory[]
  nextCursor: string | null
  hasMore: boolean
}
