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

/**
 * Retry only what is genuinely transient: connection failures, timeouts, and
 * 5xx/429 from the server. A 4xx is the server telling us the request itself is
 * wrong — repeating it just wastes the user's battery and our capacity.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status >= 500 || err.status === 429 || err.status === 0;
  }
  return true; // network/abort errors
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
): Promise<T> {
  const url = `${BASE_URL}/api${path}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
      if (!isRetryable(err) || attempt === MAX_RETRIES) break;
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
    // The server has rejected the session itself — sign out once, centrally.
    if (res.status === 401 || res.status === 403) {
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
  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>("POST", path, body ?? {}),
  postForm: <T = unknown>(path: string, form: FormData) =>
    postForm<T>(path, form),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>("PUT", path, body ?? {}),
  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>("PATCH", path, body ?? {}),
  delete: <T = unknown>(path: string) => request<T>("DELETE", path),
};

export { ApiError };
