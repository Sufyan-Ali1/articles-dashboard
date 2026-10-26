import { api, collectPages } from '@/lib/api';
import type { Resource } from '@/types/api';
export interface TrafficSource {
  id: string;
  name: string;
  slug: string;
  referrer_domains: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface SourceCounts extends TrafficSource {
  views: number;
  sessions: number;
}
export interface TrafficOverview {
  views: number;
  sessions: number;
  lifetime_views: number;
  legacy_views: number;
  sources: SourceCounts[];
  unassigned_views: number;
  unassigned_sessions: number;
}
export interface SourceInput {
  name: string;
  slug: string;
  referrer_domains: string[];
}
export interface TrackingLink {
  id: string;
  source_id: string;
  article_id: string;
  code: string;
  source: string;
  medium: string;
  campaign: string | null;
  content: string | null;
  is_active: boolean;
  created_at: string;
}
export const trafficApi = {
  overview: (params: { article_id?: string; start?: string; end?: string }, signal?: AbortSignal) =>
    api<Resource<TrafficOverview>>('/admin/analytics/sources', { params, signal }),
  sources: (signal?: AbortSignal) =>
    collectPages<TrafficSource>('/admin/traffic-sources', { sort: 'name' }, signal),
  create: (body: SourceInput) =>
    api<Resource<TrafficSource>>('/admin/traffic-sources', { method: 'POST', body }),
  update: (id: string, body: Partial<Omit<SourceInput, 'slug'>> & { is_active?: boolean }) =>
    api<Resource<TrafficSource>>(`/admin/traffic-sources/${id}`, { method: 'PATCH', body }),
  delete: (id: string) => api<void>(`/admin/traffic-sources/${id}`, { method: 'DELETE' }),
  links: (articleId: string, signal?: AbortSignal) =>
    collectPages<TrackingLink>(
      '/admin/tracking-links',
      { article_id: articleId, sort: '-created_at' },
      signal,
    ),
  createLink: (body: {
    article_id: string;
    source_id: string;
    code: string;
    medium: string;
    campaign?: string;
    content?: string;
  }) => api<Resource<TrackingLink>>('/admin/tracking-links', { method: 'POST', body }),
  toggleLink: (id: string, is_active: boolean) =>
    api<Resource<TrackingLink>>(`/admin/tracking-links/${id}`, {
      method: 'PATCH',
      body: { is_active },
    }),
};
export function trackingUrl(code: string): string | null {
  try {
    const url = new URL(import.meta.env.VITE_SITE_URL || 'https://askandexplore.com');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)
    )
      return null;
    return new URL(`/r/${code}`, url.origin).href;
  } catch {
    return null;
  }
}
