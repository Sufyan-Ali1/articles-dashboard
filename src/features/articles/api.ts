import { api } from '@/lib/api';
import type {
  Article,
  ArticleFilters,
  ArticleInput,
  ArticleSummary,
  Page,
  Resource,
} from '@/types/api';
export const articlesApi = {
  list: (params: ArticleFilters, signal?: AbortSignal) =>
    api<Page<ArticleSummary>>('/admin/articles', { params, signal }),
  detail: (id: string, signal?: AbortSignal) =>
    api<Resource<Article>>(`/admin/articles/${id}`, { signal }),
  create: (body: ArticleInput) => api<Resource<Article>>('/articles', { method: 'POST', body }),
  update: (id: string, body: Partial<ArticleInput>) =>
    api<Resource<Article>>(`/articles/${id}`, { method: 'PATCH', body }),
  publish: (id: string) => api<Resource<Article>>(`/articles/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) =>
    api<Resource<Article>>(`/articles/${id}/unpublish`, { method: 'POST' }),
  status: (id: string, status: 'draft' | 'archived') =>
    api<Resource<Article>>(`/articles/${id}`, { method: 'PATCH', body: { status } }),
  schedule: (id: string, scheduled_publish_at: string) =>
    api<Resource<Article>>(`/articles/${id}/schedule`, {
      method: 'POST',
      body: { scheduled_publish_at },
    }),
  cancelSchedule: (id: string) =>
    api<Resource<Article>>(`/articles/${id}/schedule`, { method: 'DELETE' }),
  delete: (id: string) => api<void>(`/articles/${id}`, { method: 'DELETE' }),
};
