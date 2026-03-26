/**
 * Knowledge Base Domain - Public API
 */

export {
  // Categories
  listCategories,
  listPublicCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  // Articles
  getArticleById,
  getArticleBySlug,
  getPublicArticleBySlug,
  listArticles,
  listPublicArticles,
  createArticle,
  updateArticle,
  publishArticle,
  unpublishArticle,
  deleteArticle,
  // Feedback
  recordArticleFeedback,
} from './knowledgebase.service'

export type {
  KnowledgebaseCategory,
  KnowledgebaseCategoryWithCount,
  KnowledgebaseArticle,
  KnowledgebaseArticleWithCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateArticleInput,
  UpdateArticleInput,
  ListArticlesParams,
  ArticleListResult,
  PublicArticleListResult,
} from './knowledgebase.types'
