export function localURL(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "E2E endpoints must be local HTTP(S) URLs without credentials, query, or fragment.",
    );
  }
  return url.toString().replace(/\/$/, "");
}

export const apiURL = localURL(
  process.env.E2E_API_URL ?? "http://localhost:4100/api",
);
