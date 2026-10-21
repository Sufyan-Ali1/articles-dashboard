import { http, HttpResponse, delay } from 'msw';
import { api, ApiError, collectPages, queryString, setApiSession } from './api';
import { base, server } from '@/test/server';
import { page } from '@/test/fixtures';
describe('API integration boundary', () => {
  it('serializes false values and omits unsupported empty inputs', () => {
    expect(queryString({ is_featured: false, search: '', category: undefined })).toBe(
      '?is_featured=false',
    );
  });
  it('sends bearer tokens and JSON while handling 204 without parsing a body', async () => {
    setApiSession('short-lived', vi.fn());
    server.use(
      http.delete(`${base}/articles/:id`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer short-lived');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(api('/articles/id', { method: 'DELETE' })).resolves.toBeUndefined();
  });
  it('preserves safe error details and expires an invalid session once', async () => {
    const expire = vi.fn(() => setApiSession(null, vi.fn()));
    setApiSession('expired', expire);
    server.use(
      http.get(`${base}/auth/me`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'unauthorized',
              message: 'Expired token',
              details: null,
              request_id: 'request-123',
            },
          },
          { status: 401 },
        ),
      ),
    );
    const error = await api('/auth/me').catch((e) => e as ApiError);
    expect(error).toMatchObject({ status: 401, code: 'unauthorized', requestId: 'request-123' });
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it('does not expire a staff session when a login attempt fails', async () => {
    const expire = vi.fn();
    setApiSession('valid', expire);
    server.use(
      http.post(`${base}/auth/login`, () =>
        HttpResponse.json(
          { error: { code: 'invalid_credentials', message: 'Invalid credentials' } },
          { status: 401 },
        ),
      ),
    );
    await expect(
      api('/auth/login', { method: 'POST', anonymous: true, body: {} }),
    ).rejects.toMatchObject({ status: 401 });
    expect(expire).not.toHaveBeenCalled();
  });
  it('respects request cancellation', async () => {
    server.use(
      http.get(`${base}/admin/articles`, async () => {
        await delay(100);
        return HttpResponse.json(page([]));
      }),
    );
    const controller = new AbortController();
    const request = api('/admin/articles', { signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects a response that arrives after logout', async () => {
    setApiSession('old-token', vi.fn());
    server.use(
      http.get(`${base}/auth/me`, async () => {
        await delay(30);
        return HttpResponse.json({ data: { id: 'old' } });
      }),
    );
    const request = api('/auth/me');
    setApiSession(null, vi.fn());
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('propagates Retry-After for rate limits without retrying', async () => {
    const handler = vi.fn(() =>
      HttpResponse.json(
        { error: { code: 'rate_limited', message: 'Please wait' } },
        { status: 429, headers: { 'Retry-After': '60' } },
      ),
    );
    server.use(http.get(`${base}/admin/articles`, handler));
    await expect(api('/admin/articles')).rejects.toMatchObject({ status: 429, retryAfter: 60 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it('collects every page before calculating a complete snapshot', async () => {
    server.use(
      http.get(`${base}/admin/articles`, ({ request }) => {
        const current = Number(new URL(request.url).searchParams.get('page'));
        const records =
          current === 1
            ? Array.from({ length: 100 }, (_, index) => ({ id: String(index), view_count: 2 }))
            : [{ id: '100', view_count: 3 }];
        return HttpResponse.json(page(records, 101, current, 100));
      }),
    );
    const progress = vi.fn();
    const rows = await collectPages<{ id: string; view_count: number }>(
      '/admin/articles',
      {},
      undefined,
      progress,
    );
    expect(rows.reduce((sum, row) => sum + row.view_count, 0)).toBe(203);
    expect(progress).toHaveBeenLastCalledWith(101, 101);
  });
  it('never labels partial or inconsistent pagination as a complete total', async () => {
    server.use(
      http.get(`${base}/admin/articles`, () =>
        HttpResponse.json(page([{ id: 'duplicate' }], 101, 1, 100)),
      ),
    );
    await expect(collectPages('/admin/articles')).rejects.toMatchObject({
      code: 'collection_changed',
    });
  });
});
