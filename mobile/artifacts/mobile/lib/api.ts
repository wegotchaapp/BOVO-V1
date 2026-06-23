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
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${BASE_URL}/api${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
    throw new ApiError(res.status, msg, data);
  }

  return data as T;
}

export const apiClient = {
  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>("POST", path, body ?? {}),
  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>("PATCH", path, body ?? {}),
  delete: <T = unknown>(path: string) => request<T>("DELETE", path),
};

export { ApiError };
