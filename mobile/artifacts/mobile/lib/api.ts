import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@wegotcha/auth_token";

/**
 * React Native's fetch has no default timeout — a request to an unreachable or
 * stalled host hangs until the OS gives up (often minutes), which leaves every
 * screen's spinner running forever. These bound it.
 */
const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  // Fallback for local dev — relies on same-origin (web preview only)
  return "";
}

const BASE_URL = resolveBaseUrl();

class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** True when the request never got an HTTP response (offline, DNS, timeout). */
function isOffline(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 0;
}

/**
 * fetch with a hard deadline. Timeouts and transport failures both surface as
 * an ApiError with status 0 so callers can tell "no response" apart from a
 * real HTTP error, and so the message shown to the user is readable.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError(
        0,
        "The server is taking too long to respond. Check your connection and try again.",
        err,
      );
    }
    throw new ApiError(
      0,
      "Can't reach the server. Check your connection and try again.",
      err,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the body, then throws ApiError on a non-2xx response. */
async function parseResponse<T>(
  res: Response,
  failureMessage: string,
): Promise<T> {
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
    let msg = `${failureMessage} (${res.status})`;
    if (data && typeof data === "object") {
      const errVal = (data as Record<string, unknown>).error;
      if (typeof errVal === "string" && errVal.length > 0) msg = errVal;
    }
    throw new ApiError(res.status, msg, data);
  }

  return data as T;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetchWithTimeout(
    `${BASE_URL}/api${path}`,
    {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    REQUEST_TIMEOUT_MS,
  );

  return parseResponse<T>(res, "Request failed");
}

/**
 * Multipart POST (file uploads). Content-Type is left unset so fetch can
 * write the multipart boundary itself.
 */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetchWithTimeout(
    `${BASE_URL}/api${path}`,
    {
      method: "POST",
      headers,
      body: form,
    },
    UPLOAD_TIMEOUT_MS,
  );

  return parseResponse<T>(res, "Upload failed");
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

export { ApiError, isOffline };
