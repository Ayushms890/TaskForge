import type { CurrentUser } from "./api";

type SessionSnapshot = {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  signedOutReason: "expired" | "logout" | null;
};

const initialSnapshot: SessionSnapshot = {
  user: null,
  loading: true,
  error: null,
  signedOutReason: null,
};
const unavailable = "Could not verify your session. Please try again.";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function publicUser(value: unknown): CurrentUser {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("email" in value) ||
    typeof value.email !== "string"
  ) {
    throw new Error(unavailable);
  }
  return { id: value.id, name: value.name, email: value.email };
}

// Only public account data lives in memory. The server's HttpOnly cookie remains
// the authority; a fresh document always starts by checking /auth/me.
export function createSessionStore(
  request: typeof fetch = (...args) => fetch(...args),
) {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();
  let generation = 0;
  let pending: { controller: AbortController; promise: Promise<void> } | null =
    null;
  let signingOut: Promise<void> | null = null;

  function publish(next: SessionSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function invalidate() {
    generation += 1;
    pending?.controller.abort();
    pending = null;
  }

  function refresh(): Promise<void> {
    if (signingOut) return signingOut;
    if (pending) return pending.promise;
    const controller = new AbortController();
    const version = generation;
    const current = () => version === generation && !controller.signal.aborted;
    publish({ ...snapshot, loading: true, error: null });
    const promise = (async () => {
      // Install pending before invoking the transport, including synchronous mocks.
      await Promise.resolve();
      if (!current()) return;
      try {
        const response = await request(`${apiUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!current()) return;
        if (response.status === 401) {
          publish({
            user: null,
            loading: false,
            error: null,
            signedOutReason: "expired",
          });
          return;
        }
        if (!response.ok) throw new Error(unavailable);
        const result = await response.json();
        const user = publicUser(result?.data?.user);
        if (current()) {
          publish({ user, loading: false, error: null, signedOutReason: null });
        }
      } catch {
        if (current())
          publish({ ...snapshot, loading: false, error: unavailable });
      } finally {
        if (current()) pending = null;
      }
    })();
    pending = { controller, promise };
    return promise;
  }

  function authenticated(value: unknown) {
    const user = publicUser(value);
    invalidate();
    publish({ user, loading: false, error: null, signedOutReason: null });
  }

  function logout(): Promise<void> {
    if (signingOut) return signingOut;
    invalidate();
    const version = generation;
    publish({ ...snapshot, loading: false });
    signingOut = (async () => {
      await Promise.resolve();
      try {
        const response = await request(`${apiUrl}/auth/logout`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok && response.status !== 401) {
          throw new Error("Could not sign out. Please try again.");
        }
        if (version === generation) {
          invalidate();
          publish({
            user: null,
            loading: false,
            error: null,
            signedOutReason: "logout",
          });
        }
      } finally {
        signingOut = null;
      }
    })();
    return signingOut;
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    authenticated,
    logout,
  };
}

export const sessionStore = createSessionStore();
