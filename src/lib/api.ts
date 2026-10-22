import type { Page } from '@/types/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
    public requestId?: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
type SessionAccess = { token: string | null; epoch: number; expire: () => void };
const errorName = (error: unknown) =>
  typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
let renewSession: (() => Promise<void>) | null = null;
export function setSessionRenewal(renew: (() => Promise<void>) | null) {
  renewSession = renew;
}
let session: SessionAccess = { token: null, epoch: 0, expire: () => undefined };
export function setApiSession(token: string | null, expire: () => void, preserveEpoch = false) {
  session = { token, expire, epoch: session.epoch + (preserveEpoch ? 0 : 1) };
}
export async function withSessionLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request('blog-auth-session', work);
  return work();
}
export function getApiEpoch() {
  return session.epoch;
}
export function apiBase(): string {
  const value = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
  if (!value)
    throw new ApiError(
      0,
      'configuration_error',
      'Set VITE_API_BASE_URL in your environment, then restart or rebuild the dashboard.',
    );
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new ApiError(
      0,
      'configuration_error',
      'VITE_API_BASE_URL must be an absolute HTTP(S) API URL without credentials, query, or fragment.',
    );
  }
  return value;
}
export const queryString = (params: object = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  return query.size ? `?${query}` : '';
};
export async function api<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    rawBody?: Blob;
    params?: object;
    signal?: AbortSignal;
    token?: string | null;
    anonymous?: boolean;
    retried?: boolean;
  } = {},
): Promise<T> {
  const captured = session;
  const token = options.anonymous
    ? null
    : options.token === undefined
      ? captured.token
      : options.token;
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Request deadline exceeded', 'TimeoutError')),
    35_000,
  );
  try {
    const response = await fetch(`${apiBase()}${path}${queryString(options.params)}`, {
      method: options.method ?? 'GET',
      signal: controller.signal,
      credentials: path.startsWith('/auth/') ? 'include' : 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(path.startsWith('/auth/') ? { 'X-CSRF-Protection': '1' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.rawBody
          ? { 'Content-Type': options.rawBody.type || 'application/octet-stream' }
          : options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
      },
      ...(options.rawBody
        ? { body: options.rawBody }
        : options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
    });
    const payload: unknown =
      response.status === 204
        ? undefined
        : await response.json().catch((error: unknown) => {
            if (['AbortError', 'TimeoutError'].includes(errorName(error))) throw error;
            return null;
          });
    if (
      response.status === 401 &&
      token &&
      options.token === undefined &&
      !options.anonymous &&
      !options.retried &&
      renewSession &&
      captured.epoch === session.epoch
    ) {
      if (token === session.token) await renewSession();
      if (captured.epoch !== session.epoch) throw new DOMException('Session changed', 'AbortError');
      return api<T>(path, { ...options, retried: true });
    }
    if (token && captured.epoch !== session.epoch && options.token === undefined)
      throw new DOMException('Session changed', 'AbortError');
    if (!response.ok) {
      const envelope = payload as {
        error?: { code?: string; message?: string; details?: unknown; request_id?: string };
      } | null;
      const error = new ApiError(
        response.status,
        envelope?.error?.code ?? 'http_error',
        envelope?.error?.message ?? `Request failed (${response.status}).`,
        envelope?.error?.details,
        envelope?.error?.request_id ?? response.headers.get('X-Request-ID') ?? undefined,
        Number(response.headers.get('Retry-After')) || undefined,
      );
      if (
        response.status === 401 &&
        token &&
        options.token === undefined &&
        session.epoch === captured.epoch &&
        !options.anonymous
      )
        captured.expire();
      throw error;
    }
    if (response.status !== 204 && payload === null)
      throw new ApiError(
        response.status,
        'invalid_response',
        'The API returned an invalid response.',
      );
    return payload as T;
  } catch (error) {
    if (errorName(error) === 'TimeoutError')
      throw new ApiError(
        0,
        'request_timeout',
        options.method && options.method !== 'GET'
          ? 'The request timed out. The server may have saved this change. Reload the record before trying again.'
          : 'The API took too long to respond. Please try again.',
      );
    if (error instanceof ApiError || errorName(error) === 'AbortError') throw error;
    throw new ApiError(
      0,
      'network_error',
      'Cannot reach the API. Check your connection, API URL, and backend CORS configuration.',
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
export async function collectPages<T extends { id: string }>(
  path: string,
  params: object = {},
  signal?: AbortSignal,
  progress?: (loaded: number, total: number) => void,
): Promise<T[]> {
  const first = await api<Page<T>>(path, {
    params: { ...params, page: 1, page_size: 100 },
    signal,
  });
  const records = new Map(first.data.map((row) => [row.id, row]));
  progress?.(records.size, first.meta.total);
  for (let page = 2; page <= first.meta.pages; page += 3) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(3, first.meta.pages - page + 1) }, (_, i) =>
        api<Page<T>>(path, { params: { ...params, page: page + i, page_size: 100 }, signal }),
      ),
    );
    for (const result of batch) for (const row of result.data) records.set(row.id, row);
    progress?.(records.size, first.meta.total);
  }
  if (records.size !== first.meta.total)
    throw new ApiError(
      409,
      'collection_changed',
      'Records changed while loading. Refresh to calculate a complete snapshot.',
    );
  return [...records.values()];
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
