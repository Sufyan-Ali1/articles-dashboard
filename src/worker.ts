interface WorkerEnvironment {
  API_ORIGIN: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api/v1' && !url.pathname.startsWith('/api/v1/'))
      return env.ASSETS.fetch(request);

    let upstream: URL;
    try {
      upstream = new URL(env.API_ORIGIN);
      if (
        upstream.protocol !== 'https:' ||
        upstream.username ||
        upstream.password ||
        upstream.pathname !== '/' ||
        upstream.search ||
        upstream.hash ||
        upstream.origin === url.origin
      )
        throw new Error('Invalid API origin');
    } catch {
      return Response.json(
        { error: { code: 'configuration_error', message: 'API proxy is not configured.' } },
        { status: 503 },
      );
    }
    // Assign the path rather than resolving it: // paths must never select another host.
    upstream.pathname = url.pathname;
    upstream.search = url.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('forwarded');
    headers.delete('x-forwarded-host');
    headers.delete('x-forwarded-for');
    headers.delete('x-forwarded-proto');
    // Only the API's session cookie belongs on the upstream request.
    const refreshCookie = headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('blog_refresh='));
    if (refreshCookie) headers.set('cookie', refreshCookie);
    else headers.delete('cookie');
    try {
      const response = await fetch(upstream, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
        cache: 'no-store',
      });
      // Stream the response and preserve separate Set-Cookie headers. The backend's
      // host-only cookie is now stored on the dashboard origin, with its auth path.
      const outgoing = new Response(response.body, response);
      outgoing.headers.set('Cache-Control', 'no-store');
      return outgoing;
    } catch {
      return Response.json(
        {
          error: {
            code: 'upstream_unavailable',
            message: 'Cannot reach the API. Please try again.',
          },
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  },
};
