import worker from './worker';

const origin = 'https://dashboard.example';
const environment = () => ({
  API_ORIGIN: 'https://api.example',
  ASSETS: { fetch: vi.fn(async () => new Response('dashboard')) },
});

it('forwards a refresh cookie and preserves its rotated HttpOnly cookie', async () => {
  const proxy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('{"data":{}}', {
      headers: {
        'Set-Cookie': 'blog_refresh=rotated; HttpOnly; Secure; Path=/api/v1/auth; SameSite=Lax',
      },
    }),
  );
  const response = await worker.fetch(
    new Request(`${origin}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: 'unrelated=private; blog_refresh=existing',
        Origin: origin,
        'X-CSRF-Protection': '1',
      },
    }),
    environment(),
  );
  const [url, options] = proxy.mock.calls[0];
  expect(String(url)).toBe('https://api.example/api/v1/auth/refresh');
  const headers = new Headers(options?.headers);
  expect(headers.get('cookie')).toBe('blog_refresh=existing');
  expect(headers.get('origin')).toBe(origin);
  expect(headers.get('x-csrf-protection')).toBe('1');
  expect(options?.redirect).toBe('manual');
  expect(response.headers.get('set-cookie')).toContain('blog_refresh=rotated; HttpOnly; Secure');
  expect(response.headers.get('cache-control')).toBe('no-store');
});

it('preserves login request bodies, query strings, and bearer tokens', async () => {
  const proxy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  const request = new Request(`${origin}/api/v1/auth/login?test=1`, {
    method: 'POST',
    body: JSON.stringify({ email: 'staff@example.com', password: 'test-only' }),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer example' },
  });
  await worker.fetch(request, environment());
  const [url, options] = proxy.mock.calls[0];
  expect(String(url)).toBe('https://api.example/api/v1/auth/login?test=1');
  expect(new Headers(options?.headers).get('authorization')).toBe('Bearer example');
  expect(await new Response(options?.body).json()).toEqual({
    email: 'staff@example.com',
    password: 'test-only',
  });
});

it('serves article navigation through assets rather than the API', async () => {
  const env = environment();
  const proxy = vi.spyOn(globalThis, 'fetch');
  const response = await worker.fetch(new Request(`${origin}/articles/new`), env);
  expect(await response.text()).toBe('dashboard');
  expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
  expect(proxy).not.toHaveBeenCalled();
});

it('preserves API failures instead of returning the SPA or caching authentication', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('{"error":{"code":"unauthorized"}}', { status: 401 }),
  );
  const env = environment();
  const response = await worker.fetch(
    new Request(`${origin}/api/v1/auth/refresh`, { method: 'POST' }),
    env,
  );
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(env.ASSETS.fetch).not.toHaveBeenCalled();
});

it('returns a retryable error when Render is unavailable', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failure'));
  const response = await worker.fetch(
    new Request(`${origin}/api/v1/auth/refresh`, { method: 'POST' }),
    environment(),
  );
  expect(response.status).toBe(502);
  expect((await response.json()).error.code).toBe('upstream_unavailable');
});

it.each([
  'http://api.example',
  origin,
  'https://api.example/unexpected',
  'https://user:secret@api.example',
])('rejects unsafe proxy origin %s', async (API_ORIGIN) => {
  const proxy = vi.spyOn(globalThis, 'fetch');
  const response = await worker.fetch(new Request(`${origin}/api/v1/articles`), {
    ...environment(),
    API_ORIGIN,
  });
  expect(response.status).toBe(503);
  expect(proxy).not.toHaveBeenCalled();
});
