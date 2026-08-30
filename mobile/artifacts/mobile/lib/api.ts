import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@wegotcha/auth_token";

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  // Fallback for local dev — relies on same-origin (web preview only)
  return "";
}

const BASE_URL = resolveBaseUrl();

/** Network attempts are retried; the server rejecting us is not. */
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;
/** Nothing should hang forever on a flaky mobile connection. */
const REQUEST_TIMEOUT_MS = 20_000;

type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

/**
 * Registered by AuthContext so a genuine 401/403 signs the user out once,
 * centrally, instead of every screen inventing its own handling.
 */
export function setSessionExpiredHandler(fn: SessionExpiredHandler | null) {
  onSessionExpired = fn;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RequestOptions {
  /**
   * Override whether this request may be retried. Set `true` only for a POST or
   * PATCH the server treats as a no-op when repeated. Defaults to the HTTP
   * semantics of the method.
   */
  retry?: boolean;
}

/**
 * Retry only what is genuinely transient: connection failures, timeouts, and
 * 5xx/429 from the server. A 4xx is the server telling us the request itself is
 * wrong — repeating it just wastes the user's battery and our capacity.
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status >= 500 || err.status === 429 || err.status === 0;
  }
  return true; // network/abort errors
}

/**
 * Whether the request itself may be repeated at all.
 *
 * A timeout tells us nothing about whether the server acted — only that we
 * stopped waiting. Repeating a GET is free; repeating a POST can happen twice
 * for real. `POST /safety/sos` opens a Noonlight alarm with no de-duplication,
 * so a retry during the flaky connection an emergency is most likely to involve
 * would dispatch responders **twice**. `POST /bookings/prepare` likewise leaves
 * a second booking and a second PaymentIntent behind.
 *
 * GET, PUT and DELETE are idempotent by HTTP semantics and stay retryable. POST
 * and PATCH must opt in, and only when the endpoint is keyed on something that
 * makes a repeat a no-op — `/bookings/confirm` is, because it returns early on
 * an already-confirmed booking.
 */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE"]);

function isRepeatable(method: string, optIn: boolean | undefined): boolean {
  return optIn ?? IDEMPOTENT_METHODS.has(method.toUpperCase());
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  const url = `${BASE_URL}/api${path}`;
  const repeatable = isRepeatable(method, opts?.retry);
  const maxAttempts = repeatable ? MAX_RETRIES : 0;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    // Re-read the token each attempt so a refresh between retries is picked up.
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetchWithTimeout(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return await handleResponse<T>(res);
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === maxAttempts) break;
      // Exponential backoff so a struggling server isn't hammered.
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastErr;
}

/** Shared response handling for both JSON and multipart requests. */
async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    if (data && typeof data === "object") {
      const errVal = (data as Record<string, unknown>).error;
      if (typeof errVal === "string" && errVal.length > 0) msg = errVal;
    }
    // Only 401 means the session itself is bad. The mobile auth guard throws
    // UnauthorizedException for every session failure — missing token, invalid
    // session, expired session, unknown user — and never 403. A 403 here is
    // always a business rule ("Only the Voyager can delete this group"), so
    // signing the user out on one would eject them from the app for tapping a
    // button they were not entitled to.
    if (res.status === 401) {
      onSessionExpired?.();
    }
    throw new ApiError(res.status, msg, data);
  }

  return data as T;
}

/**
 * Multipart POST (file uploads). Content-Type is left unset so fetch can
 * write the multipart boundary itself.
 */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Uploads are not retried: the body is a stream that may already be consumed,
  // and a duplicate upload is worse than a clear failure the user can retry.
  const res = await fetchWithTimeout(`${BASE_URL}/api${path}`, {
    method: "POST",
    headers,
    body: form,
  });
  return handleResponse<T>(res);
}

export const apiClient = {
  get: <T = unknown>(path: string, opts?: RequestOptions) =>
    request<T>("GET", path, undefined, opts),
  post: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("POST", path, body ?? {}, opts),
  postForm: <T = unknown>(path: string, form: FormData) =>
    postForm<T>(path, form),
  put: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PUT", path, body ?? {}, opts),
  patch: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PATCH", path, body ?? {}, opts),
  delete: <T = unknown>(path: string, opts?: RequestOptions) =>
    request<T>("DELETE", path, undefined, opts),
};

export { ApiError };
