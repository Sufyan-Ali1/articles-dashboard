import type { Article, Classification, User } from '@/types/api';
export const admin: User = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Alex Morgan',
  email: 'alex@example.test',
  role: 'admin',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
export const editor: User = {
  ...admin,
  id: '10000000-0000-4000-8000-000000000002',
  role: 'editor',
};
export const author: User = {
  ...admin,
  id: '10000000-0000-4000-8000-000000000003',
  role: 'author',
};
export const classification: Classification = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Tutorial',
  slug: 'tutorial',
  description: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
export const article: Article = {
  id: '30000000-0000-4000-8000-000000000001',
  title: 'A useful article',
  slug: 'a-useful-article',
  content_html: '<p>A useful story.</p>',
  excerpt: null,
  featured_image: null,
  featured_image_alt: null,
  author: { id: author.id, name: author.name },
  author_id: author.id,
  article_type: classification,
  article_type_id: classification.id,
  categories: [],
  tags: [],
  is_featured: false,
  view_count: 17,
  published_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  status: 'draft',
  meta_title: null,
  meta_description: null,
  schema: null,
};
export const page = <T>(data: T[], total = data.length, pageNumber = 1, pageSize = 20) => ({
  data,
  meta: { page: pageNumber, page_size: pageSize, total, pages: Math.ceil(total / pageSize) },
});
