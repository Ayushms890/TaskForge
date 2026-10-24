"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { canManageSprints, roleFor, type Membership } from "../lib/permissions";
import { completeTaskCounts } from "../lib/sprint-summary";

type Sprint = {
  id: string;
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
};
type Task = {
  id: string;
  identifier: string;
  title: string;
  sprintId?: string | null;
};

function toIso(value: string) {
  return new Date(value).toISOString();
}
function displayDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function SprintManager({ projectId }: { projectId: string }) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskCounts, setTaskCounts] = useState<Map<string, number> | null>(
    null,
  );
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  async function load() {
    setLoading(true);
    setCanManage(false);
    setError(null);
    try {
      const [sprintResult, taskResult, projectResult, meResult] =
        await Promise.all([
          apiRequest<{ sprints: Sprint[] }>(`/projects/${projectId}/sprints`),
          apiRequest<{
            tasks: Task[];
            pagination?: { page: number; total: number; totalPages: number };
          }>(`/tasks?projectId=${projectId}&limit=100`),
          apiRequest<{ project: { workspaceId: string } }>(
            `/projects/${projectId}`,
          ),
          apiRequest<{ user: { id: string } }>("/auth/me"),
        ]);
      setSprints(sprintResult.data?.sprints ?? []);
      setTasks(taskResult.data?.tasks ?? []);
      setTaskCounts(
        completeTaskCounts(
          taskResult.data?.tasks ?? [],
          taskResult.data?.pagination,
        ),
      );
      const workspaceId = projectResult.data?.project.workspaceId;
      if (workspaceId) {
        const members = await apiRequest<{ members: Membership[] }>(
          `/workspaces/${workspaceId}/members`,
        );
        setCanManage(
          canManageSprints(
            roleFor(members.data?.members, meResult.data?.user.id),
          ),
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load sprints.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [projectId]);

  async function createSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || loading || !canManage || !name.trim()) return;
    if (
      !Number.isFinite(Date.parse(startDate)) ||
      !Number.isFinite(Date.parse(endDate)) ||
      new Date(endDate) <= new Date(startDate)
    ) {
      setError("End date must be after the start date.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/sprints`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          goal: goal.trim() || undefined,
          startDate: toIso(startDate),
          endDate: toIso(endDate),
        }),
      });
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create sprint.",
      );
    } finally {
      setPending(false);
    }
  }
  async function transition(sprintId: string, action: "start" | "complete") {
    if (pending || loading || !canManage) return;
    const sprint = sprints.find((item) => item.id === sprintId);
    if (
      !sprint ||
      (action === "start"
        ? sprint.status !== "PLANNED" ||
          sprints.some((item) => item.status === "ACTIVE")
        : sprint.status !== "ACTIVE")
    )
      return;
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/sprints/${sprintId}/${action}`, { method: "POST" });
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update sprint.",
      );
    } finally {
      setPending(false);
    }
  }
  async function assignTask(taskId: string, sprintId: string) {
    if (pending || loading || !canManage) return;
    if (
      sprintId &&
      !sprints.some(
        (sprint) => sprint.id === sprintId && sprint.status !== "COMPLETED",
      )
    )
      return;
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ sprintId: sprintId || null }),
      });
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not assign task.",
      );
    } finally {
      setPending(false);
    }
  }

  const active = sprints.find((sprint) => sprint.status === "ACTIVE");
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-5 py-7 text-white shadow-[0_24px_60px_-28px_rgba(49,46,129,0.75)] sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
              Delivery planning
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Sprints
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100/80 sm:text-base">
              Plan, start, and complete focused iterations for this project.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Current focus
            </p>
            <p className="mt-1 text-lg font-bold">
              {active?.name ?? "Planning ahead"}
            </p>
            <p className="text-xs text-indigo-100/70">
              {active ? "Active sprint" : "No active sprint"}
            </p>
          </div>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm"
        >
          <p className="font-medium">{error}</p>
          <button
            disabled={pending || loading}
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-rose-300 px-3 py-2 font-semibold hover:bg-rose-100 disabled:opacity-50"
          >
            Retry loading
          </button>
        </div>
      )}
      {loading && (
        <div
          role="status"
          aria-busy="true"
          className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-600">
            Loading sprints and assignments…
          </p>
          <div aria-hidden="true" className="mt-5 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        </div>
      )}
      {pending && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700"
        >
          Saving changes…
        </p>
      )}
      {!loading && !canManage && (
        <p className="mt-5 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-sm">
          Follow sprint progress and task assignments here. Workspace owners and
          admins manage sprint planning.
        </p>
      )}
      {!loading && (
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          {(["PLANNED", "ACTIVE", "COMPLETED"] as const).map((status) => (
            <div
              key={status}
              className={`rounded-2xl border p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ${status === "ACTIVE" ? "border-indigo-200 bg-indigo-50/60" : status === "COMPLETED" ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white/70"}`}
            >
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                {status === "PLANNED"
                  ? "Planned sprints"
                  : status === "ACTIVE"
                    ? "Active sprints"
                    : "Completed sprints"}
              </dt>
              <dd className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
                {sprints.filter((sprint) => sprint.status === status).length}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!loading && (
        <div
          className={`mt-8 grid items-start gap-6 ${canManage ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}
        >
          <section className="space-y-4">
            {sprints.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/65 p-10 text-center shadow-sm">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <span aria-hidden="true" className="text-xl">
                    ✦
                  </span>
                </div>
                <p className="mt-4 font-semibold text-slate-900">
                  No sprints created yet.
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Create a sprint to give the team a shared delivery target and
                  a clear place for upcoming work.
                </p>
              </div>
            ) : (
              (["ACTIVE", "PLANNED", "COMPLETED"] as const).map((status) => (
                <section key={status} className="space-y-4">
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                      {status === "ACTIVE"
                        ? "In progress"
                        : status === "PLANNED"
                          ? "Planned sprints"
                          : "Sprint history"}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-500">
                      {
                        sprints.filter((sprint) => sprint.status === status)
                          .length
                      }
                    </span>
                  </div>
                  {!sprints.some((sprint) => sprint.status === status) && (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                      {status === "COMPLETED"
                        ? "Completed sprints will appear here."
                        : status === "ACTIVE"
                          ? "No active sprint."
                          : "No planned sprints."}
                    </p>
                  )}
                  {sprints
                    .filter((sprint) => sprint.status === status)
                    .map((sprint) => (
                      <article
                        key={sprint.id}
                        className="rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ring-1 ring-white/70 transition hover:border-indigo-200 hover:bg-white hover:shadow-[0_20px_50px_-30px_rgba(79,70,229,0.25)] sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="break-words text-xl font-bold tracking-tight text-slate-950">
                              {sprint.name}
                            </h3>
                            <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-slate-600">
                              {sprint.goal || "No goal"}
                            </p>
                            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
                              <span
                                aria-hidden="true"
                                className="text-indigo-500"
                              >
                                ◷
                              </span>
                              <time dateTime={sprint.startDate}>
                                {displayDate(sprint.startDate)}
                              </time>{" "}
                              –{" "}
                              <time dateTime={sprint.endDate}>
                                {displayDate(sprint.endDate)}
                              </time>
                            </p>
                            {taskCounts && (
                              <p className="mt-3 inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                {taskCounts.get(sprint.id) ?? 0} assigned tasks
                              </p>
                            )}
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${sprint.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : sprint.status === "COMPLETED" ? "border-slate-200 bg-slate-100 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}
                          >
                            {sprint.status === "ACTIVE"
                              ? "Active"
                              : sprint.status === "PLANNED"
                                ? "Planned"
                                : "Completed"}
                          </span>
                        </div>
                        {canManage && (
                          <div className="mt-5 border-t border-slate-100 pt-4">
                            {sprint.status === "PLANNED" && (
                              <button
                                disabled={pending || !!active}
                                onClick={() =>
                                  void transition(sprint.id, "start")
                                }
                                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                              >
                                Start sprint
                              </button>
                            )}
                            {sprint.status === "PLANNED" && active && (
                              <p className="mt-2 text-xs leading-5 text-slate-500">
                                Complete the active sprint before starting
                                another.
                              </p>
                            )}
                            {sprint.status === "ACTIVE" && (
                              <button
                                disabled={pending}
                                onClick={() =>
                                  void transition(sprint.id, "complete")
                                }
                                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                              >
                                Complete sprint
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                </section>
              ))
            )}
          </section>
          {canManage && (
            <form
              className="h-fit space-y-5 rounded-3xl border border-indigo-100 bg-indigo-50/45 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] sm:p-6"
              onSubmit={createSprint}
            >
              <fieldset disabled={pending} className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                    New iteration
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                    Create sprint
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Set a goal and timebox the next delivery cycle.
                  </p>
                </div>
                <label className="block text-sm font-medium">
                  <span className="text-slate-700">Name</span>
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                    placeholder="Sprint 1"
                  />
                </label>
                <label className="block text-sm font-medium">
                  <span className="text-slate-700">Goal</span>
                  <textarea
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                    rows={2}
                  />
                </label>
                <label className="block text-sm font-medium">
                  <span className="text-slate-700">Start date</span>
                  <input
                    required
                    type="datetime-local"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                  />
                </label>
                <label className="block text-sm font-medium">
                  <span className="text-slate-700">End date</span>
                  <input
                    required
                    type="datetime-local"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                  />
                </label>
                <button
                  disabled={pending || !name.trim()}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create sprint
                </button>
              </fieldset>
            </form>
          )}
        </div>
      )}
      {!loading && (
        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ring-1 ring-white/70">
          <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  {canManage ? "Task assignments" : "Tasks in this project"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {canManage
                    ? "Choose a planned or active sprint, or leave work in the backlog."
                    : "Open a task to see its details and discussion."}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </span>
            </div>
            {!taskCounts && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Showing up to the first 100 project tasks. Sprint task totals
                are hidden because the complete task list is unavailable.
              </p>
            )}
          </div>
          {tasks.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No tasks available.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-slate-50/70 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                      {task.identifier}
                    </p>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="mt-1 block break-words font-semibold text-slate-900 hover:text-indigo-600"
                    >
                      {task.title}
                    </Link>
                  </div>
                  {canManage ? (
                    <select
                      aria-label={`Sprint for ${task.identifier}`}
                      disabled={pending}
                      value={task.sprintId ?? ""}
                      onChange={(event) =>
                        void assignTask(task.id, event.target.value)
                      }
                      className="min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm"
                    >
                      <option value="">Backlog</option>
                      {task.sprintId &&
                        !sprints.some(
                          (sprint) => sprint.id === task.sprintId,
                        ) && (
                          <option value={task.sprintId} disabled>
                            Sprint unavailable
                          </option>
                        )}
                      {sprints
                        .filter(
                          (sprint) =>
                            sprint.status !== "COMPLETED" ||
                            sprint.id === task.sprintId,
                        )
                        .map((sprint) => (
                          <option
                            key={sprint.id}
                            value={sprint.id}
                            disabled={sprint.status === "COMPLETED"}
                          >
                            {sprint.name}
                            {sprint.status === "COMPLETED"
                              ? " · Completed"
                              : ""}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
                      {sprints.find((sprint) => sprint.id === task.sprintId)
                        ?.name ??
                        (task.sprintId ? "Sprint unavailable" : "Backlog")}
                      {sprints.find((sprint) => sprint.id === task.sprintId)
                        ?.status === "COMPLETED"
                        ? " · Completed"
                        : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
