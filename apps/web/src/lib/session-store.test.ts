import { describe, expect, it, vi } from "vitest";
import { createSessionStore } from "./session-store";

const user = { id: "u1", name: "Ada Lovelace", email: "ada@example.com" };
const otherUser = {
  id: "u2",
  name: "Grace Hopper",
  email: "grace@example.com",
};
const ok = (account = user) =>
  new Response(JSON.stringify({ data: { user: account } }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("shared cookie session", () => {
  it("starts unknown on a reload, then reads the cookie without caching the response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok());
    const store = createSessionStore(fetcher);
    expect(store.getSnapshot()).toMatchObject({
      user: null,
      loading: true,
      signedOutReason: null,
    });
    await store.refresh();
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/me$/),
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(store.getSnapshot()).toEqual({
      user,
      loading: false,
      error: null,
      signedOutReason: null,
    });
    // A new document/server render never trusts another document's account data.
    expect(createSessionStore(fetcher).getSnapshot().user).toBeNull();
    expect(store.getServerSnapshot()).toMatchObject({
      user: null,
      loading: true,
    });
  });

  it("keeps the name across repeated navigation/remounts and coalesces concurrent consumers", async () => {
    const response = deferred<Response>();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok())
      .mockReturnValue(response.promise);
    const store = createSessionStore(fetcher);
    const firstListener = vi.fn();
    const unsubscribe = store.subscribe(firstListener);
    await store.refresh();
    unsubscribe();
    const nextListener = vi.fn();
    store.subscribe(nextListener);
    expect(store.getSnapshot().user?.name).toBe(user.name);
    const navigation = store.refresh();
    expect(store.refresh()).toBe(navigation);
    expect(store.refresh()).toBe(navigation);
    expect(store.getSnapshot()).toMatchObject({ user, loading: true });
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
    response.resolve(ok());
    await navigation;
    expect(nextListener).toHaveBeenCalledTimes(2);
    expect(firstListener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toMatchObject({ user, loading: false });
  });

  it.each([429, 500, 403])(
    "preserves a verified account after HTTP %s and recovers on retry",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(ok())
        .mockResolvedValueOnce(new Response("unavailable", { status }))
        .mockResolvedValueOnce(ok());
      const store = createSessionStore(fetcher);
      await store.refresh();
      await store.refresh();
      expect(store.getSnapshot()).toMatchObject({
        user,
        loading: false,
        signedOutReason: null,
        error: expect.any(String),
      });
      await store.refresh();
      expect(store.getSnapshot()).toMatchObject({ user, error: null });
    },
  );

  it("preserves the account on network errors and malformed successful responses", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok())
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("not json"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} })));
    const store = createSessionStore(fetcher);
    await store.refresh();
    for (let i = 0; i < 3; i += 1) {
      await store.refresh();
      expect(store.getSnapshot()).toMatchObject({
        user,
        loading: false,
        error: expect.any(String),
        signedOutReason: null,
      });
    }
  });

  it.each([429, 500, "network"])(
    "does not claim signed out when the initial check fails with %s",
    async (failure) => {
      const fetcher = vi.fn<typeof fetch>();
      if (typeof failure === "number")
        fetcher.mockResolvedValue(new Response(null, { status: failure }));
      else fetcher.mockRejectedValue(new TypeError("offline"));
      const store = createSessionStore(fetcher);
      await store.refresh();
      expect(store.getSnapshot()).toEqual({
        user: null,
        loading: false,
        error: expect.any(String),
        signedOutReason: null,
      });
    },
  );

  it("clears the account only on confirmed 401, with an expiry explanation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok())
      .mockResolvedValue(new Response(null, { status: 401 }));
    const store = createSessionStore(fetcher);
    await store.refresh();
    await store.refresh();
    expect(store.getSnapshot()).toEqual({
      user: null,
      loading: false,
      error: null,
      signedOutReason: "expired",
    });
  });

  it.each([200, 401, "network"])(
    "ignores a pre-login response (%s) even if transport ignores abort",
    async (status) => {
      const stale = deferred<Response>();
      const fetcher = vi.fn<typeof fetch>().mockReturnValue(stale.promise);
      const store = createSessionStore(fetcher);
      const refresh = store.refresh();
      await Promise.resolve();
      const signal = fetcher.mock.calls[0]?.[1]?.signal;
      store.authenticated(otherUser);
      expect(signal?.aborted).toBe(true);
      if (typeof status !== "number") stale.reject(new TypeError("offline"));
      else
        stale.resolve(status === 200 ? ok() : new Response(null, { status }));
      await refresh;
      expect(store.getSnapshot()).toEqual({
        user: otherUser,
        loading: false,
        error: null,
        signedOutReason: null,
      });
    },
  );

  it("does not let a stale check finish or clear a newer in-flight request", async () => {
    const stale = deferred<Response>();
    const fresh = deferred<Response>();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(fresh.promise);
    const store = createSessionStore(fetcher);
    const first = store.refresh();
    await Promise.resolve();
    store.authenticated(otherUser);
    const second = store.refresh();
    stale.resolve(new Response(null, { status: 401 }));
    await first;
    expect(store.refresh()).toBe(second);
    expect(store.getSnapshot()).toMatchObject({
      user: otherUser,
      loading: true,
    });
    fresh.resolve(ok(otherUser));
    await second;
    expect(store.getSnapshot()).toMatchObject({
      user: otherUser,
      loading: false,
    });
  });

  it("aborts a check on logout, dedupes logout, and blocks checks until logout completes", async () => {
    const stale = deferred<Response>();
    const logoutResponse = deferred<Response>();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(logoutResponse.promise);
    const store = createSessionStore(fetcher);
    store.authenticated(user);
    const refresh = store.refresh();
    await Promise.resolve();
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    const logout = store.logout();
    expect(store.logout()).toBe(logout);
    expect(store.refresh()).toBe(logout);
    expect(signal?.aborted).toBe(true);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]).toEqual([
      expect.stringMatching(/\/auth\/logout$/),
      { method: "POST", credentials: "include", cache: "no-store" },
    ]);
    logoutResponse.resolve(new Response(null, { status: 204 }));
    await logout;
    stale.resolve(ok());
    await refresh;
    expect(store.getSnapshot()).toEqual({
      user: null,
      loading: false,
      error: null,
      signedOutReason: "logout",
    });
  });

  it("ignores JSON parsing that completes after logout", async () => {
    const body = deferred<unknown>();
    const response = ok();
    const json = vi.spyOn(response, "json").mockReturnValue(body.promise);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response)
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createSessionStore(fetcher);
    store.authenticated(user);
    const refresh = store.refresh();
    await Promise.resolve();
    await Promise.resolve();
    expect(json).toHaveBeenCalledOnce();
    await store.logout();
    body.resolve({ data: { user } });
    await refresh;
    expect(store.getSnapshot()).toMatchObject({
      user: null,
      signedOutReason: "logout",
    });
  });

  it.each([500, "network"])(
    "keeps the account when logout fails with %s and allows a new check",
    async (failure) => {
      const fetcher = vi.fn<typeof fetch>();
      if (typeof failure === "number")
        fetcher.mockResolvedValueOnce(new Response(null, { status: failure }));
      else fetcher.mockRejectedValueOnce(new TypeError("offline"));
      fetcher.mockResolvedValueOnce(ok());
      const store = createSessionStore(fetcher);
      store.authenticated(user);
      await expect(store.logout()).rejects.toThrow();
      expect(store.getSnapshot()).toMatchObject({
        user,
        signedOutReason: null,
      });
      await store.refresh();
      expect(store.getSnapshot()).toMatchObject({
        user,
        loading: false,
        error: null,
      });
    },
  );

  it("treats an already expired logout as signed out", async () => {
    const store = createSessionStore(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 401 })),
    );
    store.authenticated(user);
    await store.logout();
    expect(store.getSnapshot()).toMatchObject({
      user: null,
      signedOutReason: "logout",
    });
  });

  it("publishes only public account fields from authentication and rejects malformed data", () => {
    const store = createSessionStore();
    store.authenticated({ ...user, token: "must-not-be-retained" });
    expect(store.getSnapshot().user).toEqual(user);
    expect(() => store.authenticated(undefined)).toThrow();
    expect(store.getSnapshot().user).toEqual(user);
  });
});
