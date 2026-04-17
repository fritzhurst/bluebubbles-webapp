// Thin fetch() wrapper with auth injection.
//
// BlueBubbles Server accepts the server password as a query param `?password=`
// on every request (it also accepts a Guid header for some routes, but
// password-as-query is the universal form). We inject it here so callers
// don't have to think about it.

import { getSetting, SETTING_KEYS } from '@/db/db';
import type { ApiEnvelope } from '@/types/bluebubbles';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** If true, parse as Blob instead of JSON (used for attachment downloads). */
  asBlob?: boolean;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  /** Server-provided error message if present in the response body. */
  public readonly serverMessage?: string;
  /** Server-provided detail/error field (BB uses `data.error` sometimes). */
  public readonly serverError?: string;

  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly path: string,
    public readonly payload?: unknown,
  ) {
    // Pull any human-readable error text from the server's response body.
    // BB Server uses `{ status, message, data, error }` — we check both
    // `message` and `error`, and also a nested `data.error` for send failures.
    const p = (payload ?? {}) as {
      message?: unknown;
      error?: unknown;
      data?: { error?: unknown; message?: unknown };
    };
    const serverMessage =
      typeof p.message === 'string' && p.message.trim() ? p.message.trim() : undefined;
    const serverError =
      typeof p.error === 'string' && p.error.trim()
        ? p.error.trim()
        : typeof p.data?.error === 'string' && p.data.error.trim()
          ? p.data.error.trim()
          : typeof p.data?.message === 'string' && p.data.message.trim()
            ? p.data.message.trim()
            : undefined;

    const suffix = [serverMessage, serverError].filter(Boolean).join(' — ');
    super(`[${status} ${statusText}] ${path}${suffix ? ': ' + suffix : ''}`);
    this.name = 'ApiError';
    this.serverMessage = serverMessage;
    this.serverError = serverError;
  }
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('No server URL / password configured');
    this.name = 'NotAuthenticatedError';
  }
}

/** Resolve server URL + password from settings. Throws if missing. */
async function getAuth(): Promise<{ url: string; password: string }> {
  const [url, password] = await Promise.all([
    getSetting<string>(SETTING_KEYS.SERVER_URL),
    getSetting<string>(SETTING_KEYS.SERVER_PASSWORD),
  ]);
  if (!url || !password) throw new NotAuthenticatedError();
  return { url, password };
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query'], password: string): string {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
  url.searchParams.set('password', password);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Low-level request. Most callers should use `apiJson` or `apiBlob` below.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { url, password } = await getAuth();
  return apiRequestWith<T>(url, password, path, options);
}

/**
 * Variant that takes explicit credentials — used during login, before we
 * persist the settings.
 */
export async function apiRequestWith<T>(
  serverUrl: string,
  password: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const fullUrl = buildUrl(serverUrl, path, options.query, password);
  const method = options.method ?? (options.body ? 'POST' : 'GET');

  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers,
      body,
      signal: options.signal,
    });
  } catch (err) {
    // Network error (TLS failure, DNS, CORS preflight fail, etc.)
    throw new ApiError(0, 'Network error', path, String(err));
  }

  if (!response.ok) {
    // Try to pull an error payload for context.
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      // swallow
    }
    throw new ApiError(response.status, response.statusText, path, payload);
  }

  if (options.asBlob) {
    return (await response.blob()) as T;
  }

  const json = (await response.json()) as ApiEnvelope<T>;
  if (json.status !== undefined && json.status >= 400) {
    throw new ApiError(json.status, json.message ?? 'API error', path, json);
  }
  return json.data;
}

/** Shorthand for JSON GET. */
export function apiGet<T>(path: string, query?: RequestOptions['query']): Promise<T> {
  return apiRequest<T>(path, { method: 'GET', query });
}

/** Shorthand for JSON POST. */
export function apiPost<T>(path: string, body: unknown, query?: RequestOptions['query']): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body, query });
}

export function apiBlob(path: string, query?: RequestOptions['query']): Promise<Blob> {
  return apiRequest<Blob>(path, { method: 'GET', query, asBlob: true });
}
