import { sessionStore } from "./session-store";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  message?: string;
};

export async function postAuth<T>(
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const request: RequestInit = {
    method: "POST",
    credentials: "include",
  };
  if (body !== undefined) {
    request.headers = { "Content-Type": "application/json" };
    request.body = JSON.stringify(body);
  }

  const response = await fetch(`${apiUrl}${path}`, request);

  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(
      result.error?.message ?? "The request could not be completed.",
    );
  }

  return result;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.headers ?? {}),
      ...(init.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
  });
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(
      result.error?.message ?? "The request could not be completed.",
    );
  }
  return result;
}

export type CurrentUser = { id: string; name: string; email: string };

export function logout() {
  return sessionStore.logout();
}
