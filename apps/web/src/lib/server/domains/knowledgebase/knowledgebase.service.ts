/**
 * Knowledge Base Service - Core CRUD operations
 *
 * Handles categories and articles for the help center.
 */

import {
  db,
  knowledgebaseCategories,
  knowledgebaseArticles,
  knowledgebaseArticleFeedback,
  principal,
  eq,
  and,
  isNull,
  isNotNull,
  lte,
  lt,
  or,
  desc,
  asc,
  sql,
} from '@/lib/server/db'
import type { KnowledgebaseCategoryId, KnowledgebaseArticleId, PrincipalId } from '@quackback/ids'
import { NotFoundError, ValidationError } from '@/lib/shared/errors'
import { markdownToTiptapJson } from '@/lib/server/markdown-tiptap'
import type {
  KnowledgebaseCategory,
  KnowledgebaseCategoryWithCount,
  KnowledgebaseArticleWithCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateArticleInput,
  UpdateArticleInput,
  ListArticlesParams,
  ArticleListResult,
} from './knowledgebase.types'

// ============================================================================
// Categories
// ============================================================================

export async function listCategories(): Promise<KnowledgebaseCategoryWithCount[]> {
  const categories = await db.query.knowledgebaseCategories.findMany({
    where: isNull(knowledgebaseCategories.deletedAt),
    orderBy: [asc(knowledgebaseCategories.position), asc(knowledgebaseCategories.name)],
  })

  // Get article counts per category (published only)
  const now = new Date()
  const counts = await db
    .select({
      categoryId: knowledgebaseArticles.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(knowledgebaseArticles)
    .where(
      and(
        isNull(knowledgebaseArticles.deletedAt),
        isNotNull(knowledgebaseArticles.publishedAt),
        lte(knowledgebaseArticles.publishedAt, now)
      )
    )
    .groupBy(knowledgebaseArticles.categoryId)

  const countMap = new Map(counts.map((c) => [c.categoryId, c.count]))

  return categories.map((cat) => ({
    ...cat,
    articleCount: countMap.get(cat.id as KnowledgebaseCategoryId) ?? 0,
  }))
}

export async function listPublicCategories(): Promise<KnowledgebaseCategoryWithCount[]> {
  const all = await listCategories()
  return all.filter((cat) => cat.isPublic && cat.articleCount > 0)
}

export async function getCategoryById(id: KnowledgebaseCategoryId): Promise<KnowledgebaseCategory> {
  const category = await db.query.knowledgebaseCategories.findFirst({
    where: and(eq(knowledgebaseCategories.id, id), isNull(knowledgebaseCategories.deletedAt)),
  })
  if (!category) {
    throw new NotFoundError('CATEGORY_NOT_FOUND', `Category ${id} not found`)
  }
  return category
}

export async function getCategoryBySlug(slug: string): Promise<KnowledgebaseCategory> {
  const category = await db.query.knowledgebaseCategories.findFirst({
    where: and(eq(knowledgebaseCategories.slug, slug), isNull(knowledgebaseCategories.deletedAt)),
  })
  if (!category) {
    throw new NotFoundError('CATEGORY_NOT_FOUND', `Category with slug "${slug}" not found`)
  }
  return category
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function createCategory(input: CreateCategoryInput): Promise<KnowledgebaseCategory> {
  const name = input.name?.trim()
  if (!name) throw new ValidationError('VALIDATION_ERROR', 'Name is required')

  const slug = input.slug?.trim() || slugify(name)

  const [category] = await db
    .insert(knowledgebaseCategories)
    .values({
      name,
      slug,
      description: input.description?.trim() || null,
      isPublic: input.isPublic ?? true,
      position: input.position ?? 0,
    })
    .returning()

  return category
}

export async function updateCategory(
  id: KnowledgebaseCategoryId,
  input: UpdateCategoryInput
): Promise<KnowledgebaseCategory> {
  await getCategoryById(id)

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.slug !== undefined) updateData.slug = input.slug.trim()
  if (input.description !== undefined) updateData.description = input.description?.trim() || null
  if (input.isPublic !== undefined) updateData.isPublic = input.isPublic
  if (input.position !== undefined) updateData.position = input.position

  await db.update(knowledgebaseCategories).set(updateData).where(eq(knowledgebaseCategories.id, id))

  return getCategoryById(id)
}

export async function deleteCategory(id: KnowledgebaseCategoryId): Promise<void> {
  const result = await db
    .update(knowledgebaseCategories)
    .set({ deletedAt: new Date() })
    .where(and(eq(knowledgebaseCategories.id, id), isNull(knowledgebaseCategories.deletedAt)))
    .returning()

  if (result.length === 0) {
    throw new NotFoundError('CATEGORY_NOT_FOUND', `Category ${id} not found`)
  }
}

// ============================================================================
// Articles
// ============================================================================

async function resolveArticleWithCategory(
  article: typeof knowledgebaseArticles.$inferSelect
): Promise<KnowledgebaseArticleWithCategory> {
  const [category, authorRecord] = await Promise.all([
    db.query.knowledgebaseCategories.findFirst({
      where: eq(knowledgebaseCategories.id, article.categoryId),
      columns: { id: true, slug: true, name: true },
    }),
    article.principalId
      ? db.query.principal.findFirst({
          where: eq(principal.id, article.principalId),
          columns: { id: true, displayName: true, avatarUrl: true },
        })
      : null,
  ])

  return {
    ...article,
    category: category
      ? { id: category.id as KnowledgebaseCategoryId, slug: category.slug, name: category.name }
      : { id: article.categoryId as KnowledgebaseCategoryId, slug: '', name: 'Unknown' },
    author: authorRecord?.displayName
      ? {
          id: authorRecord.id as PrincipalId,
          name: authorRecord.displayName,
          avatarUrl: authorRecord.avatarUrl,
        }
      : null,
  }
}

export async function getArticleById(
  id: KnowledgebaseArticleId
): Promise<KnowledgebaseArticleWithCategory> {
  const article = await db.query.knowledgebaseArticles.findFirst({
    where: and(eq(knowledgebaseArticles.id, id), isNull(knowledgebaseArticles.deletedAt)),
  })
  if (!article) {
    throw new NotFoundError('ARTICLE_NOT_FOUND', `Article ${id} not found`)
  }
  return resolveArticleWithCategory(article)
}

export async function getArticleBySlug(slug: string): Promise<KnowledgebaseArticleWithCategory> {
  const article = await db.query.knowledgebaseArticles.findFirst({
    where: and(eq(knowledgebaseArticles.slug, slug), isNull(knowledgebaseArticles.deletedAt)),
  })
  if (!article) {
    throw new NotFoundError('ARTICLE_NOT_FOUND', `Article with slug "${slug}" not found`)
  }
  return resolveArticleWithCategory(article)
}

export async function getPublicArticleBySlug(
  slug: string
): Promise<KnowledgebaseArticleWithCategory> {
  const now = new Date()
  const article = await db.query.knowledgebaseArticles.findFirst({
    where: and(
      eq(knowledgebaseArticles.slug, slug),
      isNull(knowledgebaseArticles.deletedAt),
      isNotNull(knowledgebaseArticles.publishedAt),
      lte(knowledgebaseArticles.publishedAt, now)
    ),
  })
  if (!article) {
    throw new NotFoundError('ARTICLE_NOT_FOUND', `Article not found`)
  }

  // Increment view count (fire and forget)
  db.update(knowledgebaseArticles)
    .set({ viewCount: sql`${knowledgebaseArticles.viewCount} + 1` })
    .where(eq(knowledgebaseArticles.id, article.id))
    .catch(() => {})

  return resolveArticleWithCategory(article)
}

export async function listArticles(params: ListArticlesParams): Promise<ArticleListResult> {
  const { categoryId, status = 'all', search, cursor, limit = 20 } = params
  const now = new Date()

  const conditions = [isNull(knowledgebaseArticles.deletedAt)]

  if (categoryId) {
    conditions.push(eq(knowledgebaseArticles.categoryId, categoryId as KnowledgebaseCategoryId))
  }

  if (status === 'published') {
    conditions.push(isNotNull(knowledgebaseArticles.publishedAt))
    conditions.push(lte(knowledgebaseArticles.publishedAt, now))
  } else if (status === 'draft') {
    conditions.push(isNull(knowledgebaseArticles.publishedAt))
  }

  if (search?.trim()) {
    conditions.push(
      sql`${knowledgebaseArticles.searchVector} @@ websearch_to_tsquery('english', ${search.trim()})`
    )
  }

  if (cursor) {
    const cursorEntry = await db.query.knowledgebaseArticles.findFirst({
      where: eq(knowledgebaseArticles.id, cursor as KnowledgebaseArticleId),
      columns: { createdAt: true },
    })
    if (cursorEntry?.createdAt) {
      conditions.push(
        or(
          lt(knowledgebaseArticles.createdAt, cursorEntry.createdAt),
          and(
            eq(knowledgebaseArticles.createdAt, cursorEntry.createdAt),
            lt(knowledgebaseArticles.id, cursor as KnowledgebaseArticleId)
          )
        )!
      )
    }
  }

  const articles = await db.query.knowledgebaseArticles.findMany({
    where: and(...conditions),
    orderBy: [desc(knowledgebaseArticles.createdAt), desc(knowledgebaseArticles.id)],
    limit: limit + 1,
  })

  const hasMore = articles.length > limit
  const items = hasMore ? articles.slice(0, limit) : articles

  const resolved = await Promise.all(items.map(resolveArticleWithCategory))

  return {
    items: resolved,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    hasMore,
  }
}

export async function listPublicArticles(params: {
  categoryId?: string
  search?: string
  cursor?: string
  limit?: number
}): Promise<ArticleListResult> {
  return listArticles({ ...params, status: 'published' })
}

export async function createArticle(
  input: CreateArticleInput,
  principalId: PrincipalId
): Promise<KnowledgebaseArticleWithCategory> {
  const title = input.title?.trim()
  const content = input.content?.trim()
  if (!title) throw new ValidationError('VALIDATION_ERROR', 'Title is required')
  if (!content) throw new ValidationError('VALIDATION_ERROR', 'Content is required')

  const slug = input.slug?.trim() || slugify(title)

  const [article] = await db
    .insert(knowledgebaseArticles)
    .values({
      categoryId: input.categoryId as KnowledgebaseCategoryId,
      title,
      content,
      contentJson: input.contentJson ?? markdownToTiptapJson(content),
      slug,
      principalId,
    })
    .returning()

  return resolveArticleWithCategory(article)
}

export async function updateArticle(
  id: KnowledgebaseArticleId,
  input: UpdateArticleInput
): Promise<KnowledgebaseArticleWithCategory> {
  await getArticleById(id)

  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (input.title !== undefined) updateData.title = input.title.trim()
  if (input.content !== undefined) {
    updateData.content = input.content.trim()
    updateData.contentJson = input.contentJson ?? markdownToTiptapJson(input.content.trim())
  } else if (input.contentJson !== undefined) {
    updateData.contentJson = input.contentJson
  }
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId
  if (input.slug !== undefined) updateData.slug = input.slug.trim()

  await db.update(knowledgebaseArticles).set(updateData).where(eq(knowledgebaseArticles.id, id))

  return getArticleById(id)
}

export async function publishArticle(
  id: KnowledgebaseArticleId
): Promise<KnowledgebaseArticleWithCategory> {
  await getArticleById(id)
  await db
    .update(knowledgebaseArticles)
    .set({ publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(knowledgebaseArticles.id, id))
  return getArticleById(id)
}

export async function unpublishArticle(
  id: KnowledgebaseArticleId
): Promise<KnowledgebaseArticleWithCategory> {
  await getArticleById(id)
  await db
    .update(knowledgebaseArticles)
    .set({ publishedAt: null, updatedAt: new Date() })
    .where(eq(knowledgebaseArticles.id, id))
  return getArticleById(id)
}

export async function deleteArticle(id: KnowledgebaseArticleId): Promise<void> {
  const result = await db
    .update(knowledgebaseArticles)
    .set({ deletedAt: new Date() })
    .where(and(eq(knowledgebaseArticles.id, id), isNull(knowledgebaseArticles.deletedAt)))
    .returning()

  if (result.length === 0) {
    throw new NotFoundError('ARTICLE_NOT_FOUND', `Article ${id} not found`)
  }
}

// ============================================================================
// Article Feedback
// ============================================================================

export async function recordArticleFeedback(
  articleId: KnowledgebaseArticleId,
  helpful: boolean,
  principalId?: PrincipalId | null
): Promise<void> {
  // Verify article exists
  await getArticleById(articleId)

  if (principalId) {
    // Check for existing feedback
    const existing = await db.query.knowledgebaseArticleFeedback.findFirst({
      where: and(
        eq(knowledgebaseArticleFeedback.articleId, articleId),
        eq(knowledgebaseArticleFeedback.principalId, principalId)
      ),
    })

    if (existing) {
      if (existing.helpful === helpful) return // No change

      // Update existing feedback and adjust counts
      await db
        .update(knowledgebaseArticleFeedback)
        .set({ helpful })
        .where(eq(knowledgebaseArticleFeedback.id, existing.id))

      // Adjust denormalized counts
      if (helpful) {
        await db
          .update(knowledgebaseArticles)
          .set({
            helpfulCount: sql`${knowledgebaseArticles.helpfulCount} + 1`,
            notHelpfulCount: sql`${knowledgebaseArticles.notHelpfulCount} - 1`,
          })
          .where(eq(knowledgebaseArticles.id, articleId))
      } else {
        await db
          .update(knowledgebaseArticles)
          .set({
            helpfulCount: sql`${knowledgebaseArticles.helpfulCount} - 1`,
            notHelpfulCount: sql`${knowledgebaseArticles.notHelpfulCount} + 1`,
          })
          .where(eq(knowledgebaseArticles.id, articleId))
      }
      return
    }
  }

  // Insert new feedback
  await db.insert(knowledgebaseArticleFeedback).values({
    articleId,
    principalId: principalId ?? null,
    helpful,
  })

  // Update denormalized count
  if (helpful) {
    await db
      .update(knowledgebaseArticles)
      .set({ helpfulCount: sql`${knowledgebaseArticles.helpfulCount} + 1` })
      .where(eq(knowledgebaseArticles.id, articleId))
  } else {
    await db
      .update(knowledgebaseArticles)
      .set({ notHelpfulCount: sql`${knowledgebaseArticles.notHelpfulCount} + 1` })
      .where(eq(knowledgebaseArticles.id, articleId))
  }
}
