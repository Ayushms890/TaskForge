"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import {
  canManageWorkspace,
  roleFor,
  type Membership,
} from "../lib/permissions";

type Project = {
  id: string;
  name: string;
  key: string;
  description?: string | null;
};

export function ProjectList({ workspaceId }: { workspaceId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const request = useRef<AbortController | null>(null);
  const scope = useRef(0);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    setPermissionError(null);
    setCanCreate(false);
    const loadProjects = async () => {
      try {
        const result = await apiRequest<{ projects: Project[] }>(
          `/workspaces/${workspaceId}/projects`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setProjects(result.data?.projects ?? []);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load projects.",
        );
      }
    };
    const loadPermissions = async () => {
      try {
        const [members, me] = await Promise.all([
          apiRequest<{ members: Membership[] }>(
            `/workspaces/${workspaceId}/members`,
            { signal: controller.signal },
          ),
          apiRequest<{ user: { id: string } }>("/auth/me", {
            signal: controller.signal,
          }),
        ]);
        if (!controller.signal.aborted) {
          setCanCreate(
            canManageWorkspace(
              roleFor(members.data?.members, me.data?.user.id),
            ),
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setPermissionError("Project permissions could not be loaded.");
        }
      }
    };
    await Promise.all([loadProjects(), loadPermissions()]);
    if (!controller.signal.aborted) setLoading(false);
  }, [workspaceId]);
  useEffect(() => {
    scope.current += 1;
    setCreateError(null);
    setCreating(false);
    void load();
    return () => {
      scope.current += 1;
      request.current?.abort();
    };
  }, [load]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || creating) return;
    const currentScope = scope.current;
    setCreateError(null);
    setCreating(true);
    try {
      const result = await apiRequest<{ project: Project }>(
        `/workspaces/${workspaceId}/projects`,
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            key: key.trim(),
            description: description.trim(),
          }),
        },
      );
      if (currentScope !== scope.current) return;
      if (result.data?.project)
        setProjects((current) => [...current, result.data!.project]);
      setName("");
      setKey("");
      setDescription("");
    } catch (requestError) {
      if (currentScope !== scope.current) return;
      setCreateError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create project.",
      );
    } finally {
      if (currentScope === scope.current) setCreating(false);
    }
  }

  return (
    <section
      className={`mt-7 grid items-start gap-6 ${canCreate ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}
    >
      <div
        className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/75 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.65)] ring-1 ring-white/70"
        aria-busy={loading}
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/70 px-5 py-5 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
              Work in motion
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              Projects{" "}
              <span className="ml-1 text-sm font-semibold text-slate-400">
                {!loading && !error ? projects.length : ""}
              </span>
            </h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200/80">
            Your team&apos;s work
          </span>
        </div>
        {loading ? (
          <div role="status" className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <span className="sr-only">Loading projects…</span>
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="h-36 animate-pulse rounded-2xl border border-slate-100 bg-white/55 p-4"
              >
                <div className="flex justify-between">
                  <div className="h-9 w-9 rounded-xl bg-slate-200/70" />
                  <div className="h-6 w-12 rounded-lg bg-slate-200/70" />
                </div>
                <div className="mt-5 h-4 w-2/3 rounded bg-slate-200/70" />
                <div className="mt-3 h-3 w-full rounded bg-slate-200/70" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="p-6 text-sm text-rose-700">
            <div className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-100 font-bold text-rose-700">
                !
              </span>
              <div>
                <p className="font-semibold">
                  We couldn&apos;t load the projects.
                </p>
                <p className="mt-1 text-rose-700/90">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-lg border border-rose-300 bg-white px-3 py-2 font-semibold shadow-sm hover:bg-rose-50"
            >
              Try again
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <span
              aria-hidden="true"
              className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-xl text-indigo-600"
            >
              ◇
            </span>
            <p className="mt-4 font-semibold text-slate-900">No projects yet</p>
            <p className="mx-auto mt-2 max-w-md leading-6">
              {canCreate
                ? "Create a project to give your team's work a home."
                : "A workspace owner or admin can create the first project."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            {projects.map((project) => (
              <li key={project.id} className="min-w-0">
                <Link
                  href={`/projects/${project.id}`}
                  className="group relative flex h-full min-h-36 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-sm ring-1 ring-white/70 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-[0_16px_32px_-24px_rgba(79,70,229,0.6)]"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-sky-400 opacity-70 transition group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600 transition group-hover:bg-indigo-50 group-hover:text-indigo-700"
                    >
                      {project.key.slice(0, 2)}
                    </span>
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold tracking-wide text-indigo-700">
                      {project.key}
                    </span>
                  </div>
                  <div className="mt-5 min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-950 group-hover:text-indigo-700">
                      {project.name}
                    </p>
                    <p className="mt-1 break-words text-sm leading-5 text-slate-500">
                      {project.description || "No description"}
                    </p>
                  </div>
                  <span className="mt-4 text-xs font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">
                    Open project ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!loading && permissionError && (
          <div
            role="alert"
            className="border-t border-amber-100 bg-amber-50/70 px-5 py-3 text-sm text-amber-800 sm:px-6"
          >
            {permissionError}{" "}
            <button
              type="button"
              onClick={() => void load()}
              className="rounded font-semibold underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        )}
      </div>
      {!loading && canCreate && (
        <form
          className="h-fit rounded-2xl border border-indigo-100/90 bg-indigo-50/45 p-6 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.65)]"
          onSubmit={createProject}
          aria-busy={creating}
        >
          <fieldset disabled={creating} className="space-y-4">
            <div className="mb-5 flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl text-white shadow-sm"
              >
                +
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">Create project</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  Give the team a clear home for the next body of work.
                </p>
              </div>
            </div>
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
              Key
              <input
                required
                maxLength={10}
                value={key}
                onChange={(event) => setKey(event.target.value.toUpperCase())}
                placeholder="WEB"
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white/80 px-3.5 py-2.5 text-sm uppercase shadow-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white/80 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                rows={3}
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
              disabled={creating || !name.trim() || !key.trim()}
              className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create project"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
