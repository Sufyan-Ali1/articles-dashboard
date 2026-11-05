import type { ArticleSummary, Role, User } from '@/types/api';
export const isAdmin = (role?: Role) => role === 'admin';
export const canReview = (role?: Role) => role === 'admin' || role === 'editor';
export const canEditArticle = (user: User, article: ArticleSummary) =>
  canReview(user.role) ||
  ((article.created_by_id === undefined ? article.author_id : article.created_by_id) === user.id &&
    article.status === 'draft');
export const allowedPage = (role: Role, page: string) =>
  ['users', 'activity-logs', 'subscribers', 'contact-messages'].includes(page)
    ? isAdmin(role)
    : ['article-requests', 'traffic-sources'].includes(page)
      ? canReview(role)
      : true;
