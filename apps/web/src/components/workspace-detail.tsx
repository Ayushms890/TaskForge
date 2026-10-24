"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, type CurrentUser } from "../lib/api";
import { useRouter } from "next/navigation";
import { ProjectList } from "./project-list";
import { canConfirmWorkspaceDeletion } from "../lib/workspace-deletion";
import {
  canManageWorkspace,
  canRemoveMember,
  roleFor,
} from "../lib/permissions";

type Member = {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: { id: string; name: string; email: string };
};
type Workspace = { id: string; name: string; slug: string; members: Member[] };

function focusConfirmation(element: HTMLInputElement | null) {
  element?.focus();
}

function roleLabel(role: Member["role"]) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function WorkspaceDetail({ workspaceId }: { workspaceId: string }) {
  // Route changes remount all workspace-scoped state before rendering ownership.
  return <WorkspaceDetailContent key={workspaceId} workspaceId={workspaceId} />;
}

function WorkspaceDetailContent({ workspaceId }: { workspaceId: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deleteInFlight = useRef(false);
  const membershipInFlight = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    if (lifetime.current?.signal.aborted) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setError(null);
    try {
      const [result, me] = await Promise.all([
        apiRequest<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
          signal: controller.signal,
        }),
        apiRequest<{ user: CurrentUser }>("/auth/me", {
          signal: controller.signal,
        }),
      ]);
      if (controller.signal.aborted) return;
      setWorkspace(result.data?.workspace ?? null);
      setCurrentUser(me.data?.user ?? null);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load workspace.",
      );
    }
  }, [workspaceId]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void load();
    return () => {
      controller.abort();
      loadController.current?.abort();
    };
  }, [load]);

  const isOwner = Boolean(
    workspace?.id === workspaceId &&
    currentUser &&
    workspace.members.some(
      (member) => member.user.id === currentUser.id && member.role === "OWNER",
    ),
  );
  const currentRole =
    workspace?.id === workspaceId
      ? roleFor(workspace?.members, currentUser?.id)
      : undefined;
  const canManage = canManageWorkspace(currentRole);
  const canDelete = canConfirmWorkspaceDeletion({
    role: currentRole,
    workspaceId,
    loadedWorkspaceId: workspace?.id,
    name: workspace?.name,
    confirmation: deleteName,
    busy: deleting || !!pending,
  });

  function cancelDelete() {
    if (deleteInFlight.current) return;
    setDeleteOpen(false);
    setDeleteName("");
    setDeleteError(null);
    deleteTrigger.current?.focus();
  }

  async function deleteWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !deleteOpen ||
      !canDelete ||
      deleteInFlight.current ||
      membershipInFlight.current
    )
      return;
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    deleteInFlight.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest(`/workspaces/${workspaceId}`, {
        method: "DELETE",
        signal,
      });
      if (signal.aborted) return;
      router.replace("/workspaces");
      router.refresh();
    } catch (requestError) {
      if (signal.aborted) return;
      setDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete workspace.",
      );
      deleteInFlight.current = false;
      setDeleting(false);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      pending ||
      membershipInFlight.current ||
      deleteInFlight.current ||
      !canManage
    )
      return;
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    membershipInFlight.current = true;
    setPending("add");
    setError(null);
    try {
      await apiRequest(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        signal,
        body: JSON.stringify({ email, role: isOwner ? inviteRole : "MEMBER" }),
      });
      if (signal.aborted) return;
      setEmail("");
      await load();
    } catch (requestError) {
      if (signal.aborted) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not add member.",
      );
    } finally {
      if (!signal.aborted) {
        membershipInFlight.current = false;
        setPending(null);
      }
    }
  }

  async function removeMember(userId: string) {
    const target = workspace?.members.find(
      (member) => member.user.id === userId,
    );
    if (
      pending ||
      membershipInFlight.current ||
      deleteInFlight.current ||
      !target ||
      !canRemoveMember(currentRole, target.role)
    )
      return;
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    membershipInFlight.current = true;
    setPending(userId);
    setError(null);
    try {
      await apiRequest(`/workspaces/${workspaceId}/members/${userId}`, {
        method: "DELETE",
        signal,
      });
      if (signal.aborted) return;
      await load();
    } catch (requestError) {
      if (signal.aborted) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not remove member.",
      );
    } finally {
      if (!signal.aborted) {
        membershipInFlight.current = false;
        setPending(null);
      }
    }
  }

  if (!workspace)
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div
          role={error ? "alert" : "status"}
          className={`${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white/70 text-slate-600"} rounded-2xl border p-6 shadow-sm`}
        >
          <div className="flex items-center gap-3">
            {!error && (
              <span
                aria-hidden="true"
                className="h-5 w-5 animate-pulse rounded-full bg-indigo-100"
              />
            )}
            <p className={error ? "font-medium" : ""}>
              {error ?? "Loading workspace..."}
            </p>
          </div>
        </div>
        {error && (
          <button
            onClick={() => void load()}
            className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 font-semibold text-rose-800 shadow-sm hover:bg-rose-50"
          >
            Retry
          </button>
        )}
      </main>
    );
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
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
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
              Workspace
            </p>
            <h1 className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl">
              {workspace.name}
            </h1>
            <p className="mt-2 break-all text-sm text-indigo-100/75">
              {workspace.slug}
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-indigo-100/80 sm:text-base">
              A shared home for projects, people, and the work moving your team
              forward.
            </p>
          </div>
          <div className="grid min-w-44 grid-cols-2 gap-2 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                Members
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {workspace.members.length}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                Access
              </p>
              <p className="mt-1 text-sm font-bold">
                {currentRole ? roleLabel(currentRole) : "Member"}
              </p>
            </div>
          </div>
        </div>
      </section>
      <ProjectList workspaceId={workspaceId} />
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm"
        >
          {error}
        </p>
      )}
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/75 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.65)] ring-1 ring-white/70">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/70 px-5 py-5 sm:px-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
                Your team
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                Members
              </h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200/80">
              {workspace.members.length} member
              {workspace.members.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {workspace.members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-slate-50/70 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700 ring-1 ring-indigo-100"
                  >
                    {(member.user.name.trim() || member.user.email)
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">
                      {member.user.name}
                    </p>
                    <p className="break-all text-sm text-slate-500">
                      {member.user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.role === "OWNER" ? "bg-amber-50 text-amber-700" : member.role === "ADMIN" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {member.role}
                  </span>
                  {canRemoveMember(currentRole, member.role) && (
                    <button
                      disabled={!!pending || deleting}
                      onClick={() => void removeMember(member.user.id)}
                      className="rounded-lg px-2 py-1 text-sm font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      {pending === member.user.id ? "Removing…" : "Remove"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
        {canManage && (
          <section className="h-fit rounded-2xl border border-indigo-100/90 bg-indigo-50/45 p-6 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.65)]">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl text-white shadow-sm"
              >
                +
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">Add member</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {isOwner
                    ? "Add existing users as members or admins."
                    : "Admins can add and remove members. Only the owner manages admins."}
                </p>
              </div>
            </div>
            <form className="mt-6 space-y-4" onSubmit={addMember}>
              <fieldset disabled={!!pending || deleting} className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Email
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Role
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as "ADMIN" | "MEMBER")
                    }
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="MEMBER">Member</option>
                    {isOwner && <option value="ADMIN">Admin</option>}
                  </select>
                </label>
                <button className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50">
                  {pending === "add" ? "Adding…" : "Add member"}
                </button>
              </fieldset>
            </form>
          </section>
        )}
      </div>
      {isOwner && (
        <section
          className="mt-7 rounded-2xl border border-rose-200/80 bg-rose-50/35 p-5 shadow-sm sm:p-6"
          onKeyDown={(event) => {
            if (event.key === "Escape" && deleteOpen) {
              event.preventDefault();
              cancelDelete();
            }
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-600">
            Owner controls
          </p>
          <h2 className="mt-1 font-semibold text-slate-950">
            Workspace management
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
            Destructive actions permanently remove this workspace and its work.
          </p>
          <button
            ref={deleteTrigger}
            type="button"
            aria-expanded={deleteOpen}
            aria-controls="delete-workspace-panel"
            disabled={deleting}
            aria-disabled={deleting || !!pending}
            onClick={() => {
              if (pending || membershipInFlight.current) return;
              if (deleteOpen) cancelDelete();
              else setDeleteOpen(true);
            }}
            className="mt-4 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 aria-disabled:opacity-50"
          >
            Delete workspace…
          </button>
          {deleteOpen && (
            <form
              id="delete-workspace-panel"
              onSubmit={deleteWorkspace}
              aria-busy={deleting}
              className="mt-5 border-t border-rose-100 pt-5"
            >
              <p
                id="delete-workspace-warning"
                className="text-sm leading-6 text-slate-600"
              >
                Permanently delete <strong>{workspace.name}</strong> and all its
                projects, tasks, sprints, comments, activity history, and
                workspace memberships. User accounts are retained. This is
                irreversible and cannot be undone.
              </p>
              <label
                htmlFor="delete-workspace-confirmation"
                className="mt-4 block text-sm font-semibold text-slate-700"
              >
                Type {workspace.name} exactly to confirm
              </label>
              <input
                id="delete-workspace-confirmation"
                ref={focusConfirmation}
                aria-describedby="delete-workspace-warning"
                autoComplete="off"
                spellCheck={false}
                disabled={deleting || !!pending}
                value={deleteName}
                onChange={(event) => setDeleteName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white/80 p-2.5 shadow-sm outline-none focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-100"
              />
              {deleteError && (
                <p
                  role="alert"
                  className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {deleteError} Your confirmation is saved; try again.
                </p>
              )}
              <button
                disabled={!canDelete}
                className="mt-4 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Permanently delete workspace"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={cancelDelete}
                className="mt-4 ml-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
