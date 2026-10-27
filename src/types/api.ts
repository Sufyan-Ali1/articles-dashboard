export type Role = 'admin' | 'editor' | 'author';
export type ArticleStatus = 'draft' | 'published' | 'archived' | 'scheduled';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed';
export interface Resource<T> {
  data: T;
}
export interface Page<T> {
  data: T[];
  meta: { page: number; page_size: number; total: number; pages: number };
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}
export type ClassificationKind = 'categories' | 'tags' | 'article-types';
export interface Classification {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parent_id?: string | null;
}
export interface ClassificationInput {
  name: string;
  slug?: string;
  description: string | null;
  is_active: boolean;
  parent_id?: string | null;
}
export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  featured_image_alt: string | null;
  author: { id: string; name: string; specialization?: string } | null;
  author_id: string | null;
  article_type: Classification | null;
  article_type_id: string | null;
  categories: Classification[];
  tags: Classification[];
  is_featured: boolean;
  view_count: number;
  published_at: string | null;
  scheduled_publish_at: string | null;
  created_at: string;
  updated_at: string;
  status: ArticleStatus;
}
export interface Article extends ArticleSummary {
  content_html: string;
  meta_title: string | null;
  meta_description: string | null;
  schema: Record<string, unknown> | null;
}
export interface ArticleInput {
  title: string;
  slug?: string;
  content_html: string;
  article_type_id: string;
  author_id: string;
  category_ids: string[];
  tag_ids: string[];
  is_featured?: boolean;
  excerpt: string | null;
  featured_image: string | null;
  featured_image_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  schema: Record<string, unknown> | null;
}
export interface ArticleRequest {
  id: string;
  topic: string;
  description: string | null;
  name: string | null;
  email: string | null;
  status: RequestStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
export interface ListParams {
  page?: number;
  page_size?: number;
  sort?: string;
  search?: string;
}
export interface ArticleFilters extends ListParams {
  category?: string;
  tag?: string;
  article_type?: string;
  status?: ArticleStatus;
  is_featured?: boolean;
  published_from?: string;
  published_to?: string;
}
export interface UserInput {
  name: string;
  email: string;
  password?: string;
  role: Role;
  is_active: boolean;
}
