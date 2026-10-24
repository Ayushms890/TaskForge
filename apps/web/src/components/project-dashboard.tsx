"use client";

import Link from "next/link";
import { useDashboard } from "../hooks/use-dashboard";
import {
  activityDescription,
  boundedPercent,
  dashboardDate,
  dashboardLabel,
  displayPercent,
  taskPercent,
} from "../lib/dashboard-format";
import type { Dashboard } from "../services/dashboard";

const card =
  "min-w-0 rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ring-1 ring-white/70 sm:p-6";
const statusColors: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  DONE: "bg-emerald-50 text-emerald-700",
};

function StatusDistribution({ summary }: { summary: Dashboard["summary"] }) {
  const statuses = [
    { label: "To do", value: summary.todo, color: "bg-slate-400" },
    { label: "In progress", value: summary.inProgress, color: "bg-indigo-500" },
    { label: "Done", value: summary.done, color: "bg-emerald-500" },
  ];
  return (
    <section
      className={`${card} overflow-hidden`}
      aria-labelledby="distribution-heading"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
            At a glance
          </p>
          <h2
            id="distribution-heading"
            className="mt-1 text-lg font-semibold tracking-tight text-slate-950"
          >
            Status distribution
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            All tasks in this project
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tabular-nums text-slate-600">
          {summary.total} total
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-7 flex h-4 overflow-hidden rounded-full bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200"
      >
        {statuses.map((status) => (
          <span
            key={status.label}
            className={`${status.color} first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${taskPercent(status.value, summary.total)}%` }}
          />
        ))}
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {statuses.map((status) => (
          <div
            key={status.label}
            className="rounded-2xl bg-slate-100/70 p-3 ring-1 ring-inset ring-slate-200/70"
          >
            <dt className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${status.color}`}
              />
              {status.label}
            </dt>
            <dd className="mt-2 flex items-baseline gap-1 tabular-nums">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                {status.value}
              </span>
              <span className="text-xs text-slate-500">
                {displayPercent(taskPercent(status.value, summary.total))}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {summary.total === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          No tasks yet. Tasks created on the Board will appear here.
        </p>
      )}
    </section>
  );
}

function ActiveSprint({ sprint }: { sprint: Dashboard["activeSprint"] }) {
  return (
    <section
      className={`${card} relative overflow-hidden`}
      aria-labelledby="sprint-heading"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400" />
      <h2
        id="sprint-heading"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-indigo-500"
        />
        Active sprint
      </h2>
      {sprint ? (
        <>
          <h3 className="mt-5 break-words text-2xl font-bold tracking-tight text-slate-950">
            {sprint.name}
          </h3>
          <p className="mt-1 break-words text-sm text-slate-600">
            {sprint.goal || "No goal set for this sprint."}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            <time dateTime={sprint.startDate}>
              {dashboardDate(sprint.startDate)}
            </time>{" "}
            –{" "}
            <time dateTime={sprint.endDate}>
              {dashboardDate(sprint.endDate)}
            </time>
          </p>
          <div className="mt-7 flex items-end justify-between gap-2 text-sm">
            <p className="text-slate-600">
              {sprint.doneTasks} of {sprint.totalTasks} tasks done
            </p>
            <span className="text-2xl font-bold tracking-tight text-indigo-700 tabular-nums">
              {displayPercent(sprint.progressPercent)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Active sprint completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={boundedPercent(sprint.progressPercent)}
            aria-valuetext={`${sprint.doneTasks} of ${sprint.totalTasks} tasks done`}
            className="mt-3 h-3 overflow-hidden rounded-full bg-indigo-50 ring-1 ring-inset ring-indigo-100"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-[width]"
              style={{ width: `${boundedPercent(sprint.progressPercent)}%` }}
            />
          </div>
          {sprint.totalTasks === 0 && (
            <p className="mt-3 text-sm text-slate-500">
              No tasks assigned to this sprint yet.
            </p>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
          <p className="font-semibold text-slate-800">No active sprint</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Planned sprints appear here once started. Workspace owners and
            admins can plan and start an iteration from the Sprints tab.
          </p>
        </div>
      )}
    </section>
  );
}

function RecentTasks({ tasks }: { tasks: Dashboard["recentTasks"] }) {
  return (
    <section
      className={`${card} overflow-hidden`}
      aria-labelledby="recent-tasks-heading"
    >
      <h2
        id="recent-tasks-heading"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-indigo-500"
        />
        Recent tasks
      </h2>
      <p className="mt-1 text-sm text-slate-500">Most recently updated work</p>
      {tasks.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">
          No tasks yet. Create a task on the Board to get started.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {tasks.map((task) => (
            <li key={task.id} className="group rounded-2xl py-4 first:pt-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  href={`/tasks/${task.id}`}
                  className="min-w-0 flex-1 rounded-sm text-base font-semibold text-slate-900 transition hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600"
                >
                  <span className="mr-2 text-xs font-semibold text-indigo-600">
                    {task.identifier}
                  </span>{" "}
                  <span className="break-words">{task.title}</span>
                </Link>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusColors[task.status] ?? "bg-slate-100 text-slate-700"}`}
                >
                  {dashboardLabel(task.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">
                  {dashboardLabel(task.priority)} priority
                </span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">
                  {dashboardLabel(task.type)}
                </span>
                <span className="break-words">
                  {task.assignee?.name ?? "Unassigned"}
                </span>
                <time dateTime={task.updatedAt}>
                  Updated {dashboardDate(task.updatedAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentActivity({
  activities,
}: {
  activities: Dashboard["recentActivity"];
}) {
  return (
    <section
      className={`${card} overflow-hidden`}
      aria-labelledby="activity-heading"
    >
      <h2
        id="activity-heading"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-emerald-500"
        />
        Recent activity
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        The latest changes across this project
      </p>
      {activities.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">
          No activity yet. Task changes and discussions will appear here.
        </p>
      ) : (
        <ol className="ml-1 mt-5 border-l border-slate-200">
          {activities.map((activity) => (
            <li key={activity.id} className="relative pb-5 pl-5 last:pb-0">
              <span
                aria-hidden="true"
                className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-4 ring-white"
              />
              <p className="break-words text-sm leading-relaxed text-slate-600">
                <span className="font-medium text-slate-900">
                  {activity.user.name}
                </span>{" "}
                {activityDescription(activity.action, activity.metadata)}
              </p>
              <Link
                href={`/tasks/${activity.task.id}`}
                className="mt-1 block break-words rounded-sm text-sm font-medium text-indigo-700 transition hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                {activity.task.identifier} · {activity.task.title}
              </Link>
              <time
                dateTime={activity.createdAt}
                className="mt-1 block text-xs text-slate-500"
              >
                {dashboardDate(activity.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const { data, error, loading, retry } = useDashboard(projectId);
  return (
    <main
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12"
      aria-busy={loading}
    >
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-5 py-7 text-white shadow-[0_24px_60px_-28px_rgba(49,46,129,0.75)] sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
              Project overview{data ? ` · ${data.project.key}` : ""}
            </p>
            {data && (
              <p className="mt-3 break-words text-lg font-semibold text-indigo-100 sm:text-xl">
                {data.project.name}
              </p>
            )}
            <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
              Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100/80 sm:text-base">
              {data?.project.description ??
                "A focused view of the work moving through your project."}
            </p>
          </div>
          {data && (
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                Total workload
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {data.summary.total}
              </p>
              <p className="text-xs text-indigo-100/70">
                tasks in this project
              </p>
            </div>
          )}
        </div>
      </div>
      {loading && (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-500 shadow-sm"
        >
          <p>Loading project dashboard…</p>
          <div
            aria-hidden="true"
            className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 rounded-md border border-rose-300 px-3 py-2 font-semibold hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-rose-600"
          >
            Retry loading
          </button>
        </div>
      )}
      {data && (
        <>
          <section aria-label="Task summary" className="mt-6">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                [
                  "Total tasks",
                  data.summary.total,
                  "text-slate-950",
                  "border-t-slate-300",
                  "bg-slate-50",
                ],
                [
                  "To do",
                  data.summary.todo,
                  "text-slate-700",
                  "border-t-slate-400",
                  "bg-slate-50",
                ],
                [
                  "In progress",
                  data.summary.inProgress,
                  "text-indigo-700",
                  "border-t-indigo-500",
                  "bg-indigo-50/50",
                ],
                [
                  "Done",
                  data.summary.done,
                  "text-emerald-700",
                  "border-t-emerald-500",
                  "bg-emerald-50/50",
                ],
              ].map(([label, value, valueClass, borderClass, surfaceClass]) => (
                <div
                  key={label}
                  className={`${card} ${surfaceClass} border-t-4 ${borderClass} p-4 sm:p-5`}
                >
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {label}
                  </dt>
                  <dd
                    className={`mt-3 text-4xl font-bold tabular-nums tracking-tight ${valueClass}`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="mt-5 grid items-start gap-5 md:grid-cols-2">
            <StatusDistribution summary={data.summary} />
            <ActiveSprint sprint={data.activeSprint} />
          </div>
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <RecentTasks tasks={data.recentTasks} />
            <RecentActivity activities={data.recentActivity} />
          </div>
        </>
      )}
    </main>
  );
}
