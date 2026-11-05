import { api } from '@/lib/api';
import type { ListParams, Page, Resource } from '@/types/api';

export interface Subscriber {
  id: string;
  email: string;
  created_at: string;
}
export interface ContactMessage extends Subscriber {
  name: string | null;
  reason: 'general' | 'correction' | 'privacy';
  article_url: string | null;
  message: string;
}
export const audienceApi = {
  subscribers: (params: ListParams, signal?: AbortSignal) =>
    api<Page<Subscriber>>('/admin/subscriptions', { params, signal }),
  messages: (params: ListParams, signal?: AbortSignal) =>
    api<Page<ContactMessage>>('/admin/contact-messages', { params, signal }),
  message: (id: string, signal?: AbortSignal) =>
    api<Resource<ContactMessage>>(`/admin/contact-messages/${id}`, { signal }),
};
