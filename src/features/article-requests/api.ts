import { api } from '@/lib/api';
import type { ArticleRequest, ListParams, Page, RequestStatus, Resource } from '@/types/api';
export const requestsApi = {
  list: (params: ListParams & { status?: RequestStatus }, signal?: AbortSignal) =>
    api<Page<ArticleRequest>>('/admin/article-requests', { params, signal }),
  detail: (id: string, signal?: AbortSignal) =>
    api<Resource<ArticleRequest>>(`/admin/article-requests/${id}`, { signal }),
  update: (id: string, body: { status: RequestStatus; admin_notes: string | null }) =>
    api<Resource<ArticleRequest>>(`/admin/article-requests/${id}`, { method: 'PATCH', body }),
  delete: (id: string) => api<void>(`/admin/article-requests/${id}`, { method: 'DELETE' }),
};
