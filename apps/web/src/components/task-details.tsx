"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { useTaskDetails } from "../hooks/use-task-details";
import { useSession } from "../hooks/use-session";
import {
  createComment,
  deleteComment,
  deleteTask,
  updateComment,
  type Activity,
  type Comment,
  updateTaskAssignee,
} from "../services/task-details";
import {
  canAssignTasks,
  canDeleteComment,
  canDeleteTask,
  canEditComment,
  roleFor,
} from "../lib/permissions";

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? "Unknown date"
    : parsed.toLocaleString();
}
function metadataText(activity: Activity) {
  const metadata = activity.metadata;
  if (
    activity.action === "COMMENT_ADDED" ||
    activity.action === "COMMENT_UPDATED" ||
    activity.action === "COMMENT_DELETED"
  ) {
    if (
      metadata &&
      typeof metadata === "object" &&
      "commentId" in metadata &&
      typeof metadata.commentId === "string"
    )
      return `Comment ${metadata.commentId}`;
    return "Comment activity";
  }
  if (
    metadata &&
    typeof metadata === "object" &&
    "from" in metadata &&
    "to" in metadata
  ) {
    const from = String(metadata.from ?? "unknown");
    const to = String(metadata.to ?? "unknown");
    return `${from} → ${to}`;
  }
  return "Details unavailable";
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function statusClasses(value: string) {
  switch (value) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "TODO":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function priorityClasses(value: string) {
  switch (value) {
    case "URGENT":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "HIGH":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "LOW":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

export function TaskDetails({ taskId }: { taskId: string }) {
  const router = useRouter();
  const detail = useTaskDetails(taskId);
  const session = useSession();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deleteInFlight = useRef(false);
  const focusConfirmation = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
  }, []);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigneeError, setAssigneeError] = useState<string | null>(null);
  const [assigneeSaving, setAssigneeSaving] = useState(false);
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const names = useMemo(
    () =>
      new Map(
        detail.members.map((member) => [member.user.id, member.user.name]),
      ),
    [detail.members],
  );
  const name = (id?: string | null) =>
    id
      ? (names.get(id) ??
        (id === detail.currentUser?.id ? detail.currentUser.name : id))
      : "Unassigned";
  const role =
    !session.loading &&
    !session.error &&
    session.user?.id === detail.currentUser?.id
      ? roleFor(detail.members, session.user?.id)
      : undefined;
  const canManage = (comment: Comment) =>
    canDeleteComment(comment.authorId, detail.currentUser?.id, role);
  const canEdit = (comment: Comment) =>
    canEditComment(comment.authorId, detail.currentUser?.id);

  async function removeTask(event: FormEvent) {
    event.preventDefault();
    const task = detail.task;
    if (
      deleteInFlight.current ||
      deleting ||
      saving ||
      assigneeSaving ||
      detail.loading ||
      detail.error ||
      !task ||
      task.id !== taskId ||
      !canDeleteTask(role) ||
      deleteConfirmation !== task.identifier
    )
      return;
    deleteInFlight.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTask(task.id);
      router.replace(`/projects/${task.projectId}`);
      router.refresh();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete task.",
      );
      setDeleting(false);
      deleteInFlight.current = false;
    }
  }

  function cancelDelete() {
    if (deleteInFlight.current) return;
    setDeleteOpen(false);
    setDeleteConfirmation("");
    setDeleteError(null);
    deleteTrigger.current?.focus();
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (deleting || saving || !content.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      await createComment(taskId, content.trim());
      setContent("");
      await detail.reloadComments(detail.commentPage);
      await detail.reloadActivities(detail.activityPage);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not add comment.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveEdit(comment: Comment) {
    if (deleting || saving || !canEdit(comment) || !editContent.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      await updateComment(comment.id, editContent.trim());
      setEditing(null);
      await detail.reloadComments(detail.commentPage);
      await detail.reloadActivities(detail.activityPage);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update comment.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove(comment: Comment) {
    if (deleting || saving || !canManage(comment)) return;
    setSaving(true);
    setActionError(null);
    try {
      await deleteComment(comment.id);
      await detail.reloadComments(detail.commentPage);
      await detail.reloadActivities(detail.activityPage);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not delete comment.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function changeAssignee(value: string) {
    if (deleting || assigneeSaving || !canAssignTasks(role)) return;
    const assigneeId = value || null;
    if (
      assigneeId &&
      !detail.members.some((member) => member.user.id === assigneeId)
    )
      return;
    setAssigneeSaving(true);
    setAssigneeError(null);
    try {
      await updateTaskAssignee(taskId, assigneeId);
      await detail.reload();
    } catch (requestError) {
      setAssigneeError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save assignee.",
      );
    } finally {
      setAssigneeSaving(false);
    }
  }

  async function changePage(kind: "comments" | "activity", page: number) {
    if (paging || saving) return;
    setPaging(true);
    setPageError(null);
    try {
      await (kind === "comments"
        ? detail.reloadComments(page)
        : detail.reloadActivities(page));
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not load this page. Try again.",
      );
    } finally {
      setPaging(false);
    }
  }

  if (detail.loading)
    return (
      <main
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12"
        aria-busy="true"
      >
        <div
          role="status"
          className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm sm:p-8"
        >
          <p className="text-sm font-medium text-slate-600">Loading task…</p>
          <div aria-hidden="true" className="mt-6 grid gap-5 lg:grid-cols-3">
            <div className="h-48 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
            <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
      </main>
    );
  if (detail.error || !detail.task)
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div
          role="alert"
          className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm sm:p-8"
        >
          <p className="font-semibold">
            {detail.error ?? "Task was not found."}
          </p>
          <p className="mt-2 text-sm text-rose-700/80">
            Refresh the task to try loading its latest details.
          </p>
        </div>
        <button
          className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={() => void detail.reload()}
        >
          Retry
        </button>
      </main>
    );
  const task = detail.task;
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-5 py-7 text-white shadow-[0_24px_60px_-28px_rgba(49,46,129,0.75)] sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
              Task detail
            </p>
            <p className="mt-3 text-sm font-bold tracking-wide text-indigo-100">
              {task.identifier}
            </p>
            <h1 className="mt-2 break-words text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              {task.title}
            </h1>
          </div>
          <div className="flex max-w-full flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
            <span
              className={`rounded-full border px-3 py-1.5 ${statusClasses(task.status)}`}
            >
              {task.status}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 ${priorityClasses(task.priority)}`}
            >
              {task.priority}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-indigo-50">
              {task.type}
            </span>
          </div>
        </div>
      </header>
      {pageError && (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm"
        >
          {pageError} Use the page controls to retry.
        </p>
      )}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <section
            aria-labelledby="description"
            className="rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ring-1 ring-white/70 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="description"
                className="text-xl font-bold tracking-tight text-slate-950"
              >
                Description
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                Context
              </span>
            </div>
            <p className="mt-5 min-h-20 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
              {task.description || "No description provided."}
            </p>
          </section>
          <section
            aria-labelledby="comments"
            className="rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ring-1 ring-white/70 sm:p-6"
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2
                  id="comments"
                  className="text-xl font-bold tracking-tight text-slate-950"
                >
                  Comments
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep the conversation close to the work.
                </p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold tabular-nums text-indigo-700">
                {detail.commentPagination?.total ?? detail.comments.length}
              </span>
            </div>
            {actionError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {actionError}
              </p>
            )}
            <form
              onSubmit={add}
              className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/55 p-4"
            >
              <label htmlFor="comment" className="sr-only">
                Add a comment
              </label>
              <textarea
                id="comment"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                disabled={saving || deleting}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm"
                placeholder="Write a comment…"
              />
              <button
                disabled={saving || deleting || !content.trim()}
                className="mt-3 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Add comment"}
              </button>
            </form>
            <div className="mt-5 space-y-3">
              {detail.comments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    No comments yet.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Start the discussion with an update or question.
                  </p>
                </div>
              ) : (
                detail.comments.map((comment) => (
                  <article
                    key={comment.id}
                    className="rounded-2xl border border-slate-200 bg-slate-100/55 p-4 transition hover:border-indigo-200 hover:bg-white"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700"
                      >
                        {(comment.author?.name ?? name(comment.authorId))
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <strong className="text-slate-900">
                            {comment.author?.name ?? name(comment.authorId)}
                          </strong>
                          <time
                            dateTime={comment.createdAt}
                            className="text-xs text-slate-500"
                          >
                            {date(comment.createdAt)}
                          </time>
                        </div>
                      </div>
                    </div>
                    {editing === comment.id ? (
                      <>
                        <textarea
                          aria-label="Edit comment"
                          value={editContent}
                          onChange={(event) =>
                            setEditContent(event.target.value)
                          }
                          disabled={saving || deleting}
                          className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            disabled={saving || deleting || !editContent.trim()}
                            onClick={() => void saveEdit(comment)}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            disabled={saving || deleting}
                            onClick={() => setEditing(null)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                        {comment.content}
                      </p>
                    )}
                    {canManage(comment) && editing !== comment.id && (
                      <div className="mt-3 flex gap-3 text-sm">
                        {canEdit(comment) && (
                          <button
                            disabled={saving || deleting}
                            onClick={() => {
                              setEditing(comment.id);
                              setEditContent(comment.content);
                            }}
                            className="font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          disabled={saving || deleting}
                          onClick={() => void remove(comment)}
                          className="font-semibold text-rose-600 hover:text-rose-800"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
            <Pager
              page={detail.commentPage}
              pagination={detail.commentPagination}
              disabled={paging || saving}
              onChange={(page) => void changePage("comments", page)}
              label="comments"
            />
          </section>
        </div>
        <aside className="space-y-6">
          {canDeleteTask(role) && (
            <section
              className="rounded-3xl border border-rose-200/80 bg-rose-50/35 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]"
              onKeyDown={(event) => {
                if (event.key === "Escape" && deleteOpen) {
                  event.preventDefault();
                  cancelDelete();
                }
              }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">
                Danger zone
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">
                Task management
              </h2>
              <button
                ref={deleteTrigger}
                type="button"
                aria-expanded={deleteOpen}
                aria-controls="delete-task-panel"
                disabled={deleting || saving || assigneeSaving}
                onClick={() =>
                  deleteOpen ? cancelDelete() : setDeleteOpen(true)
                }
                className="mt-4 rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Delete task…
              </button>
              {deleteOpen && (
                <form
                  id="delete-task-panel"
                  onSubmit={removeTask}
                  aria-busy={deleting}
                  className="mt-4 border-t border-rose-100 pt-4"
                >
                  <p className="mt-2 text-sm text-slate-600">
                    Permanently delete <strong>{task.identifier}</strong> and
                    all its comments and activity history. This cannot be
                    undone.
                  </p>
                  <label
                    htmlFor="delete-task-confirmation"
                    className="mt-3 block text-sm font-medium"
                  >
                    Type {task.identifier} to confirm
                  </label>
                  <input
                    id="delete-task-confirmation"
                    ref={focusConfirmation}
                    autoComplete="off"
                    value={deleteConfirmation}
                    onChange={(event) =>
                      setDeleteConfirmation(event.target.value)
                    }
                    disabled={deleting}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm shadow-sm"
                  />
                  {deleteError && (
                    <p
                      role="alert"
                      className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    >
                      {deleteError}
                    </p>
                  )}
                  <button
                    disabled={
                      deleting ||
                      saving ||
                      assigneeSaving ||
                      deleteConfirmation !== task.identifier
                    }
                    className="mt-3 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Permanently delete"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={cancelDelete}
                    className="mt-3 ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </section>
          )}
          <section className="rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ring-1 ring-white/70">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight text-slate-950">
                Task details
              </h2>
              <span aria-hidden="true" className="text-indigo-500">
                ◆
              </span>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Assignee
                </dt>
                <dd className="mt-1">
                  <select
                    aria-label="Assignee"
                    disabled={
                      deleting || assigneeSaving || !canAssignTasks(role)
                    }
                    value={task.assigneeId ?? ""}
                    onChange={(event) =>
                      void changeAssignee(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium shadow-sm"
                  >
                    <option value="">Unassigned</option>
                    {detail.members.map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                  {!canAssignTasks(role) ? (
                    <span className="mt-2 block text-xs leading-5 text-slate-500">
                      Owners and admins manage assignments. Tasks you create as
                      a member are assigned to you automatically.
                    </span>
                  ) : (
                    assigneeSaving && (
                      <span className="mt-2 block text-xs text-slate-500">
                        Saving…
                      </span>
                    )
                  )}
                  {assigneeError && (
                    <p role="alert" className="mt-2 text-xs text-rose-700">
                      {assigneeError}
                    </p>
                  )}
                </dd>
              </div>
              <Detail label="Reporter" value={name(task.reporterId)} />
              <Detail label="Sprint" value={task.sprintId ?? "No sprint"} />
              <Detail label="Created" value={date(task.createdAt)} />
              <Detail label="Updated" value={date(task.updatedAt)} />
            </dl>
          </section>
        </aside>
        <section
          aria-labelledby="activity"
          className="min-w-0 rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ring-1 ring-white/70 sm:p-6 lg:col-start-1"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                id="activity"
                className="text-xl font-bold tracking-tight text-slate-950"
              >
                Activity
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A timeline of changes to this task.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold tabular-nums text-emerald-700">
              {detail.activityPagination?.total ?? detail.activities.length}
            </span>
          </div>
          <ol className="mt-6 ml-1 border-l border-slate-200">
            {detail.activities.length === 0 ? (
              <li className="ml-4 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                No activity yet.
              </li>
            ) : (
              detail.activities.map((activity) => (
                <li
                  key={activity.id}
                  className="relative pb-6 pl-6 text-sm last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white"
                  />
                  <p>
                    <strong className="text-slate-900">
                      {activity.user?.name ?? name(activity.userId)}
                    </strong>{" "}
                    <span className="text-slate-600">
                      {statusLabel(activity.action).toLowerCase()}
                    </span>
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                    {metadataText(activity)}
                  </p>
                  <time
                    dateTime={activity.createdAt}
                    className="mt-1 block text-xs text-slate-400"
                  >
                    {date(activity.createdAt)}
                  </time>
                </li>
              ))
            )}
          </ol>
          <Pager
            page={detail.activityPage}
            pagination={detail.activityPagination}
            disabled={paging || saving}
            onChange={(page) => void changePage("activity", page)}
            label="activity"
          />
        </section>
      </div>
    </main>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-slate-900">{value}</dd>
    </div>
  );
}
function Pager({
  page,
  pagination,
  onChange,
  label,
  disabled,
}: {
  page: number;
  pagination: { totalPages: number } | null;
  onChange: (page: number) => void;
  label: string;
  disabled: boolean;
}) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <nav
      aria-label={`${label} pages`}
      className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm"
    >
      <button
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="font-medium tabular-nums text-slate-500">
        Page {page} of {pagination.totalPages}
      </span>
      <button
        disabled={disabled || page >= pagination.totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
