const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = "ApiError"; this.status = status; }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL belum diatur pada file .env.");
  const token = sessionStorage.getItem("sodalis_access_token");
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, body: options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body) });
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : await response.text().catch(() => "");
  if (!response.ok || (payload && typeof payload === "object" && "success" in payload && payload.success === false)) {
    const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : `Request gagal (${response.status})`;
    throw new ApiError(message, response.status);
  }
  // Backend API wraps successful responses as { success, message?, data }.
  if (payload && typeof payload === "object" && "success" in payload && "data" in payload) return payload.data as T;
  return payload as T;
}
