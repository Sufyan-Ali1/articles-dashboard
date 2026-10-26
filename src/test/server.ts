import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { admin, article, classification, page } from './fixtures';
export const base = 'http://localhost:8000/api/v1';
export const server = setupServer(
  http.post(`${base}/auth/refresh`, () =>
    HttpResponse.json(
      { error: { code: 'unauthorized', message: 'No saved session' } },
      { status: 401 },
    ),
  ),
  http.post(`${base}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${base}/auth/login`, () =>
    HttpResponse.json({
      data: { access_token: 'test-access-token', token_type: 'bearer', expires_in: 1800 },
    }),
  ),
  http.get(`${base}/auth/me`, () => HttpResponse.json({ data: admin })),
  http.get(`${base}/admin/analytics/sources`, () =>
    HttpResponse.json({
      data: {
        views: 0,
        sessions: 0,
        lifetime_views: article.view_count,
        legacy_views: article.view_count,
        sources: [],
        unassigned_views: 0,
        unassigned_sessions: 0,
      },
    }),
  ),
  http.get(`${base}/admin/traffic-sources`, () => HttpResponse.json(page([]))),
  http.get(`${base}/admin/tracking-links`, () => HttpResponse.json(page([]))),
  http.get(`${base}/admin/articles`, () => HttpResponse.json(page([article]))),
  http.get(`${base}/admin/articles/:id`, () => HttpResponse.json({ data: article })),
  http.get(`${base}/categories`, () => HttpResponse.json(page([]))),
  http.get(`${base}/tags`, () => HttpResponse.json(page([]))),
  http.get(`${base}/article-types`, () => HttpResponse.json(page([classification]))),
  http.get(`${base}/users`, () => HttpResponse.json(page([admin]))),
  http.get(`${base}/admin/article-requests`, () => HttpResponse.json(page([]))),
  http.get(`${base}/admin-logs`, () => HttpResponse.json(page([]))),
);
