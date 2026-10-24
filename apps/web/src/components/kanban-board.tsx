"use client";

import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BoardToolbar } from "./board-toolbar";
import { BoardPagination } from "./board-pagination";
import {
  boardDragRestricted,
  changeBoardQuery,
  emptyBoardQuery,
  readBoardQuery,
  writeBoardQuery,
  type BoardQuery,
} from "../lib/board-query";
import {
  fetchBoard,
  fetchBoardSprints,
  type Board,
  type BoardTask as Task,
  type BoardSprint,
  type Status,
} from "../services/board";
import { apiRequest } from "../lib/api";
import { moveTask } from "../lib/move-task";
import { roleFor, type WorkspaceRole } from "../lib/permissions";
import { TaskCreateForm } from "./task-create-form";
import {
  canCreateTask,
  createTask,
  type TaskCreateMember,
  type TaskDraft,
} from "../services/task-create";

const columns: { id: Status; label: string }[] = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

const statusMeta: Record<
  Status,
  {
    eyebrow: string;
    dot: string;
    border: string;
    surface: string;
    badge: string;
    progress: string;
  }
> = {
  TODO: {
    eyebrow: "Queue",
    dot: "bg-slate-400",
    border: "border-slate-200",
    surface: "bg-slate-50/90",
    badge: "bg-white text-slate-700 ring-slate-200",
    progress: "bg-slate-400",
  },
  IN_PROGRESS: {
    eyebrow: "Active work",
    dot: "bg-indigo-500",
    border: "border-indigo-200",
    surface: "bg-indigo-50/45",
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    progress: "bg-indigo-500",
  },
  DONE: {
    eyebrow: "Shipped",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
    surface: "bg-emerald-50/45",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    progress: "bg-emerald-500",
  },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function TaskCardContent({
  task,
  assigneeName,
}: {
  task: Task;
  assigneeName: string | undefined;
}) {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100" />
      <div className="flex items-start gap-2">
        <Link
          href={`/tasks/${task.id}`}
          aria-label={`${task.identifier} ${task.title}`}
          className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
            <span>{task.identifier}</span>
          </div>
          <p className="mt-2 break-words text-[15px] font-semibold leading-6 text-slate-900 group-hover:text-indigo-700">
            {task.title}
          </p>
        </Link>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-200">
          {task.type}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span
          className={`rounded-lg px-2.5 py-1.5 ${
            task.priority === "CRITICAL"
              ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100"
              : task.priority === "HIGH"
                ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100"
                : task.priority === "MEDIUM"
                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100"
                  : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
          }`}
        >
          {task.priority}
        </span>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600 ring-1 ring-inset ring-slate-200">
          {task.type}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              assigneeName
                ? "bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200"
                : "bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200"
            }`}
          >
            {assigneeName ? initials(assigneeName) : "—"}
          </span>
          <span className="truncate">{assigneeName ?? "Unassigned"}</span>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-slate-400">
          #{task.position + 1}
        </span>
      </div>
    </>
  );
}

const boardCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const cards = hits.filter(
    (hit) => !columns.some((column) => column.id === hit.id),
  );
  return cards.length ? cards : hits.length ? hits : closestCorners(args);
};

function TaskCard({
  task,
  disabled,
  assigneeName,
}: {
  task: Task;
  disabled: boolean;
  assigneeName: string | undefined;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={`Task card ${task.identifier} ${task.title}`}
      {...attributes}
      {...listeners}
      className={`group relative cursor-grab overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.42)] ring-1 ring-white/80 transition duration-150 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:shadow-lg focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 active:cursor-grabbing ${isDragging ? "scale-[1.02] opacity-40" : ""} ${disabled ? "cursor-not-allowed" : ""}`}
    >
      <TaskCardContent task={task} assigneeName={assigneeName} />
    </article>
  );
}

function BoardColumn({
  column,
  tasks,
  canMove,
  restricted,
  members,
}: {
  column: { id: Status; label: string };
  tasks: Task[];
  canMove: (task: Task) => boolean;
  restricted: boolean;
  members: TaskCreateMember[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    disabled: restricted,
  });
  return (
    <section
      ref={setNodeRef}
      className={`min-h-[440px] w-[290px] shrink-0 overflow-hidden rounded-2xl border p-3 transition sm:w-[340px] sm:p-4 xl:w-auto xl:flex-1 ${statusMeta[column.id].border} ${isOver ? "bg-indigo-50/90 shadow-inner ring-2 ring-indigo-200" : statusMeta[column.id].surface}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-white/75 px-3 py-3 shadow-sm ring-1 ring-inset ring-white/80">
        <h2 aria-label={column.label} className="min-w-0">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${statusMeta[column.id].dot}`}
            />
            {statusMeta[column.id].eyebrow}
          </span>
          <span className="mt-1 block truncate font-semibold text-slate-900">
            {column.label}
          </span>
        </h2>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset ${statusMeta[column.id].badge}`}
        >
          {tasks.length}
        </span>
      </div>
      <div className="mb-4 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <span
          className={`h-1.5 flex-1 rounded-full ${statusMeta[column.id].progress}`}
        />
        <span>{tasks.length === 1 ? "task" : "tasks"}</span>
      </div>
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              disabled={!canMove(task)}
              assigneeName={
                members.find((member) => member.user.id === task.assigneeId)
                  ?.user.name
              }
            />
          ))}
          {tasks.length === 0 && (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/65 p-6 text-center text-sm text-slate-500">
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${statusMeta[column.id].badge}`}
              >
                {restricted ? "·" : "+"}
              </span>
              <span className="mt-3 font-semibold text-slate-700">
                {restricted ? "No tasks on this page" : "Drop a task here"}
              </span>
              <span className="mt-1 max-w-[18rem] text-xs leading-relaxed text-slate-400">
                {restricted
                  ? "Clear filters to see the full column."
                  : "Move work here to keep the board flowing."}
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export function KanbanBoard({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = readBoardQuery(new URLSearchParams(searchParams.toString()));
  const queryString = writeBoardQuery(query);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedQuery, setLoadedQuery] = useState("");
  const sequence = useRef(0);
  const [sprints, setSprints] = useState<BoardSprint[]>([]);
  function updateQuery(patch: Partial<BoardQuery>) {
    setActiveTask(null);
    // Read the live URL so rapidly selected filters cannot overwrite a pending
    // search with an older render's query. Next subscribes to native history.
    const current = new URLSearchParams(window.location.search);
    const next = changeBoardQuery(readBoardQuery(current), patch);
    window.history.pushState(
      null,
      "",
      `${pathname}?${writeBoardQuery(next, current.toString())}`,
    );
  }
  function clearFilters() {
    updateQuery({ ...emptyBoardQuery, limit: query.limit });
  }
  const [board, setBoard] = useState<Board | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragOverlayRoot, setDragOverlayRoot] = useState<HTMLElement | null>(
    null,
  );
  const suppressNextTaskClick = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const [role, setRole] = useState<WorkspaceRole>();
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const [members, setMembers] = useState<TaskCreateMember[]>([]);
  const access = { role, userId, members };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    // Keep the fixed-position overlay outside page surfaces that use filters,
    // clipping, or animated layers. Those ancestors can create a different
    // containing block and make the overlay appear detached from the cursor.
    setDragOverlayRoot(document.body);
  }, []);

  useEffect(() => {
    setRole(undefined);
    setUserId(null);
    setMembers([]);
    setSprints([]);
    setShowCreate(false);
    setBoard(null);
    setError(null);
  }, [projectId]);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++sequence.current;
    const request = { signal: controller.signal };
    setLoading(true);
    setLoadError(null);
    setActiveTask(null);
    void (async () => {
      const loaded = await fetchBoard(
        projectId,
        queryString,
        controller.signal,
      );
      const [me, memberResult, sprintResult] = await Promise.all([
        apiRequest<{ user: { id: string } }>("/auth/me", request),
        apiRequest<{ members: TaskCreateMember[] }>(
          `/workspaces/${loaded.project.workspaceId}/members`,
          request,
        ),
        fetchBoardSprints(projectId, controller.signal),
      ]);
      if (controller.signal.aborted || current !== sequence.current) return;
      const id = me.data?.user.id ?? null;
      setUserId(id);
      setRole(roleFor(memberResult.data?.members, id));
      setMembers(memberResult.data?.members ?? []);
      setSprints(sprintResult);
      setBoard(loaded);
      setLoadedQuery(queryString);
    })()
      .catch((error: unknown) => {
        if (!controller.signal.aborted && current === sequence.current)
          setLoadError(
            error instanceof Error ? error.message : "Could not load board.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted && current === sequence.current)
          setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, queryString, refresh]);
  const loadedCount = board ? Object.values(board.columns).flat().length : 0;
  const restricted =
    !board || boardDragRestricted(query, board.pagination.total, loadedCount);
  const busy = loading || loadedQuery !== queryString;

  function canMove(task: Task) {
    return (
      !restricted &&
      !busy &&
      !loadError &&
      !pendingRef.current &&
      !pending &&
      !creating &&
      (role === "OWNER" ||
        role === "ADMIN" ||
        (role === "MEMBER" && !!userId && task.assigneeId === userId))
    );
  }

  async function handleCreateTask(draft: TaskDraft): Promise<boolean> {
    if (pendingRef.current || !canCreateTask(access)) return false;
    pendingRef.current = true;
    setCreating(true);
    setError(null);
    let saved = false;
    try {
      await createTask(projectId, draft, access);
      saved = true;
      setShowCreate(false);
      createButton.current?.focus();
      setRefresh((value) => value + 1);
    } catch (error) {
      setError(
        saved
          ? "Task created, but the board could not refresh. Reload to see it."
          : error instanceof Error
            ? error.message
            : "Could not create task.",
      );
    } finally {
      pendingRef.current = false;
      setCreating(false);
    }
    return saved;
  }

  function findTask(taskId: string) {
    if (!board) return undefined;
    for (const column of columns) {
      const task = board.columns[column.id].find((item) => item.id === taskId);
      if (task) return { task, status: column.id };
    }
    return undefined;
  }

  function handleDragStart(event: { active: { id: string | number } }) {
    const found = findTask(String(event.active.id));
    setActiveTask(found && canMove(found.task) ? found.task : null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (activeTask) {
      suppressNextTaskClick.current = true;
      window.setTimeout(() => {
        suppressNextTaskClick.current = false;
      }, 250);
    }
    setActiveTask(null);
    if (pendingRef.current) return;
    if (
      !board ||
      !event.over ||
      String(event.active.id) === String(event.over.id)
    )
      return;
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const source = findTask(activeId);
    if (!source || !canMove(source.task)) return;
    const targetTask = findTask(overId);
    const targetStatus =
      targetTask?.status ??
      (columns.some((column) => column.id === overId)
        ? (overId as Status)
        : source.status);
    const previous = board;
    const targetItems = board.columns[targetStatus];
    const sourceIndex = board.columns[source.status].findIndex(
      (task) => task.id === activeId,
    );
    let targetIndex = targetTask
      ? Math.max(
          0,
          targetItems.findIndex((task) => task.id === overId),
        )
      : targetItems.length;
    // The target index comes from the pre-removal column. When moving down
    // within the same column, removing the source shifts the target left.
    if (
      targetTask &&
      source.status === targetStatus &&
      sourceIndex >= 0 &&
      sourceIndex < targetIndex
    ) {
      targetIndex -= 1;
    }
    const next: Board = {
      ...board,
      columns: moveTask(
        board.columns,
        activeId,
        targetStatus,
        targetIndex,
      ) as Board["columns"],
    };
    setBoard(next);
    setError(null);
    setPending(activeId);
    pendingRef.current = true;
    let saved = false;
    try {
      await apiRequest(`/tasks/${activeId}/position`, {
        method: "PATCH",
        body: JSON.stringify({
          position: next.columns[targetStatus].findIndex(
            (task) => task.id === activeId,
          ),
          status: targetStatus,
        }),
      });
      saved = true;
      // The server is authoritative for concurrent edits and position normalization.
      setRefresh((value) => value + 1);
    } catch (requestError) {
      if (!saved)
        setBoard((current) => (current === next ? previous : current));
      setError(
        saved
          ? "Move saved, but the board could not refresh. Reload to sync the board."
          : requestError instanceof Error
            ? requestError.message
            : "Could not save task position. Your change was rolled back.",
      );
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  if (!board)
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.55)]">
          <p role={loadError ? "alert" : "status"} className="text-slate-600">
            {loadError ?? "Loading board..."}
          </p>
          {!loadError && (
            <div aria-hidden="true" className="mt-5 grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-48 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          )}
        </div>
        {loadError && (
          <button
            type="button"
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry board
          </button>
        )}
      </main>
    );
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-5 py-7 text-white shadow-[0_24px_60px_-28px_rgba(49,46,129,0.75)] sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
              <span className="rounded-lg bg-white/10 px-2.5 py-1 ring-1 ring-inset ring-white/15">
                {board.project.key}
              </span>
              <span className="text-indigo-300/70">/</span>
              <span>Board</span>
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              {board.project.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100/80 sm:text-base">
              {board.project.description ||
                "Move work forward, keep priorities visible, and see what needs attention next."}
            </p>
            <p className="mt-2 text-xs font-medium text-indigo-200/75">
              Drag tasks between columns or reorder them within a column.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-56">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-indigo-200">Visible</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {loadedCount}
              </p>
              <p className="text-indigo-100/60">tasks</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-indigo-200">Total</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {board.pagination.total}
              </p>
              <p className="text-indigo-100/60">in project</p>
            </div>
          </div>
        </div>
        <div className="relative mt-7 flex flex-wrap items-center gap-3 border-t border-white/15 pt-5">
          <button
            ref={createButton}
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            disabled={!canCreateTask(access) || !!pending || creating}
            aria-expanded={showCreate}
            aria-controls="task-create-panel"
            aria-label="+ Create task"
            className="rounded-xl bg-white px-5 py-3 font-semibold text-indigo-900 shadow-lg shadow-indigo-950/20 transition hover:bg-indigo-50 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true" className="mr-1.5 text-lg leading-none">
              +
            </span>
            Create task
          </button>
          <p className="text-xs font-medium text-indigo-100/70">
            Start with the essentials, then refine ownership and priority.
          </p>
          {pending && (
            <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
              Saving task move…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="basis-full rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
        </div>
      </div>
      {role === "MEMBER" && (
        <p className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm leading-relaxed text-indigo-900">
          You can move tasks assigned to you. Use a card’s grip to drag, or
          press Space, use arrow keys, then Space to drop.
        </p>
      )}
      <div id="task-create-panel" hidden={!showCreate}>
        <TaskCreateForm
          key={projectId}
          access={access}
          visible={showCreate}
          pending={creating || !!pending}
          onCreate={handleCreateTask}
          onClose={() => {
            setShowCreate(false);
            createButton.current?.focus();
          }}
        />
      </div>
      <BoardToolbar
        query={query}
        members={members}
        sprints={sprints}
        onChange={updateQuery}
        onClear={clearFilters}
      />
      {restricted && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          Dragging is disabled for filtered or partial boards. Clear filters and
          show all tasks on one page (up to 100) to reorder safely.{" "}
          <button
            type="button"
            className="font-semibold text-indigo-700 underline underline-offset-4 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-indigo-600"
            onClick={() => updateQuery({ ...emptyBoardQuery, limit: 100 })}
          >
            Show all tasks
          </button>
        </p>
      )}
      {loadError ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {loadError}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry board
          </button>
        </div>
      ) : busy ? (
        <p
          role="status"
          className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
        >
          Loading board...
        </p>
      ) : loadedCount === 0 ? (
        <p
          role="status"
          className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
        >
          {board.pagination.total
            ? "No tasks on this page. Choose a previous page."
            : "No tasks match your search and filters."}
        </p>
      ) : null}
      {!busy && !loadError && (
        <BoardPagination
          pagination={board.pagination}
          loaded={loadedCount}
          disabled={!!pending}
          onPage={(page) => updateQuery({ page })}
          onLimit={(limit) => updateQuery({ limit })}
        />
      )}
      {!busy && !loadError && (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={boardCollision}
            onDragCancel={() => {
              setActiveTask(null);
              suppressNextTaskClick.current = true;
              window.setTimeout(() => {
                suppressNextTaskClick.current = false;
              }, 250);
            }}
            onDragStart={handleDragStart}
            onDragEnd={(event) => void handleDragEnd(event)}
          >
            <div
              className="-mx-4 mt-7 flex snap-x gap-4 overflow-x-auto px-4 pb-6 sm:-mx-6 sm:px-6 xl:mx-0 xl:grid xl:snap-none xl:grid-cols-3 xl:gap-5 xl:overflow-visible xl:px-0"
              onClickCapture={(event) => {
                if (!suppressNextTaskClick.current) return;
                const target = event.target;
                if (
                  target instanceof Element &&
                  target.closest("a[href^='/tasks/']")
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  suppressNextTaskClick.current = false;
                }
              }}
            >
              {columns.map((column) => (
                <BoardColumn
                  key={column.id}
                  column={column}
                  tasks={board.columns[column.id]}
                  canMove={canMove}
                  restricted={restricted}
                  members={members}
                />
              ))}
            </div>
            {dragOverlayRoot
              ? createPortal(
                  <DragOverlay>
                    {activeTask ? (
                      <article
                        data-testid="task-drag-overlay"
                        aria-hidden="true"
                        className="pointer-events-none h-full w-full overflow-hidden rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl ring-4 ring-indigo-100/60"
                      >
                        <TaskCardContent
                          task={activeTask}
                          assigneeName={
                            members.find(
                              (member) =>
                                member.user.id === activeTask.assigneeId,
                            )?.user.name
                          }
                        />
                      </article>
                    ) : null}
                  </DragOverlay>,
                  dragOverlayRoot,
                )
              : null}
          </DndContext>
        </>
      )}
    </main>
  );
}
