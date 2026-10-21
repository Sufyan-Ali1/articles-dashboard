import type { ArticleSummary, Role, User } from '@/types/api';
export const isAdmin = (role?: Role) => role === 'admin';
export const canReview = (role?: Role) => role === 'admin' || role === 'editor';
export const canEditArticle = (user: User, article: ArticleSummary) =>
  canReview(user.role) || (article.author_id === user.id && article.status === 'draft');
export const allowedPage = (role: Role, page: string) =>
  ['users', 'activity-logs'].includes(page)
    ? isAdmin(role)
    : page === 'article-requests'
      ? canReview(role)
      : true;
