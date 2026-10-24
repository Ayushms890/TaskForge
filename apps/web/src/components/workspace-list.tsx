"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  members: { role: string }[];
};

export function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ workspaces: Workspace[] }>(
        "/workspaces",
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setWorkspaces(result.data?.workspaces ?? []);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load workspaces.",
      );
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadWorkspaces();
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, [loadWorkspaces]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const result = await apiRequest<{ workspace: Workspace }>("/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || name.trim(),
        }),
      });
      if (!mounted.current) return;
      if (result.data?.workspace)
        setWorkspaces((current) => [...current, result.data!.workspace]);
      setName("");
      setSlug("");
      void loadWorkspaces();
    } catch (requestError) {
      if (!mounted.current) return;
      setCreateError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create workspace.",
      );
    } finally {
      if (mounted.current) setIsCreating(false);
    }
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-5 py-8 text-white shadow-[0_24px_60px_-28px_rgba(49,46,129,0.75)] sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
              Team spaces
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Your workspaces
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100/80 sm:text-base">
              Choose a team space to pick up where you left off, or create a
              focused home for the next project.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Available spaces
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {isLoading ? "—" : workspaces.length}
            </p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0" aria-busy={isLoading}>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                Overview
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                Pick a workspace
              </h2>
            </div>
            {!isLoading && !error && workspaces.length > 0 && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                {workspaces.length} space{workspaces.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {isLoading && (
            <div role="status" className="grid gap-4 sm:grid-cols-2">
              <span className="sr-only">Loading workspaces…</span>
              {[1, 2].map((item) => (
                <div
                  key={item}
                  aria-hidden="true"
                  className="h-44 animate-pulse rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm"
                >
                  <div className="h-10 w-10 rounded-xl bg-slate-100" />
                  <div className="mt-6 h-4 w-2/3 rounded bg-slate-100" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 shadow-sm"
            >
              <div className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-100 font-bold text-rose-700">
                  !
                </span>
                <div>
                  <p className="font-semibold">
                    We couldn&apos;t load your workspaces.
                  </p>
                  <p className="mt-1 text-rose-700/90">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadWorkspaces()}
                    className="mt-4 rounded-lg border border-rose-300 bg-white px-3 py-2 font-semibold text-rose-800 shadow-sm hover:bg-rose-100"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}
          {!isLoading && !error && workspaces.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/65 p-10 text-center shadow-sm">
              <span
                aria-hidden="true"
                className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-xl text-indigo-600"
              >
                +
              </span>
              <h2 className="mt-4 font-semibold text-slate-900">
                A place for your team
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
                Create your first workspace to start organizing projects.
              </p>
            </div>
          )}
          {!isLoading && !error && workspaces.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspaces/${workspace.id}`}
                  className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.7)] ring-1 ring-white/70 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-[0_18px_36px_-22px_rgba(79,70,229,0.35)]"
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 opacity-70 transition group-hover:opacity-100"
                  />
                  <div className="flex items-center justify-between gap-4">
                    <span
                      aria-hidden="true"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 font-bold text-indigo-700 ring-1 ring-indigo-100"
                    >
                      {workspace.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600"
                    >
                      ↗
                    </span>
                  </div>
                  <p className="mt-6 break-words font-semibold text-slate-950">
                    {workspace.name}
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-500">
                    {workspace.slug}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-500">
                      {workspace.members.length} member
                      {workspace.members.length === 1 ? "" : "s"}
                    </p>
                    <span className="text-xs font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">
                      Open workspace
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="h-fit rounded-2xl border border-indigo-100/90 bg-indigo-50/45 p-6 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.65)]">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl text-white shadow-sm"
            >
              +
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Create workspace
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                You will become the workspace owner.
              </p>
            </div>
          </div>
          <form className="mt-6" onSubmit={handleCreate} aria-busy={isCreating}>
            <fieldset disabled={isCreating} className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Name
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white/80 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Slug{" "}
                <span className="font-normal text-slate-500">(optional)</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="engineering"
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white/80 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </label>
              {createError && (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {createError}
                </p>
              )}
              <button
                disabled={isCreating || !name.trim()}
                className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 disabled:opacity-60"
              >
                {isCreating ? "Creating..." : "Create workspace"}
              </button>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  );
}
