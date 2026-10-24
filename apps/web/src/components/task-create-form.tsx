"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { canAssignTasks } from "../lib/permissions";
import {
  canCreateTask,
  newTaskDraft,
  taskPriorities,
  taskTypes,
  type TaskCreateAccess,
  type TaskDraft,
} from "../services/task-create";

const fieldClass =
  "mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50";

export function TaskCreateForm({
  access,
  pending,
  visible,
  onCreate,
  onClose,
}: {
  access: TaskCreateAccess;
  pending: boolean;
  visible: boolean;
  onCreate: (draft: TaskDraft) => Promise<boolean>;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(newTaskDraft);
  const submitting = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (!visible) return;
    restoreFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      restoreFocus.current?.focus();
      restoreFocus.current = null;
    };
  }, [visible]);
  useEffect(() => {
    if (visible) titleInput.current?.focus();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, visible]);
  const disabled = pending || !canCreateTask(access);
  const self = access.members.find(
    (member) => member.user.id === access.userId,
  );
  function update<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || submitting.current || !draft.title.trim()) return;
    submitting.current = true;
    try {
      if (await onCreate(draft)) setDraft(newTaskDraft());
    } finally {
      submitting.current = false;
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 shadow-2xl"
      >
        <form
          onSubmit={(event) => void submit(event)}
          aria-label="Create task"
          aria-busy={pending}
          className="flex min-h-full flex-col"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/95 px-5 py-5 backdrop-blur sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
                New work item
              </p>
              <h2
                id={headingId}
                className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
              >
                Create a task
              </h2>
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                Add the details your team needs to get started.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              aria-label="Close create task form"
              className="rounded-xl border border-slate-200 p-2 text-lg leading-none text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40"
            >
              ×
            </button>
          </div>
          <fieldset disabled={disabled} className="flex-1 space-y-5 p-5 sm:p-8">
            <fieldset className="grid min-w-0 grid-cols-1 gap-5">
              <legend className="mb-1 text-xs font-bold uppercase tracking-widest text-indigo-600">
                Essentials
              </legend>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Title{" "}
                <span className="font-normal text-slate-400">(required)</span>
                <input
                  ref={titleInput}
                  required
                  maxLength={200}
                  value={draft.title}
                  placeholder="What needs to be done?"
                  onChange={(event) => update("title", event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Description{" "}
                <span className="font-normal text-slate-400">(optional)</span>
                <textarea
                  rows={4}
                  maxLength={10000}
                  value={draft.description}
                  placeholder="Include context, requirements, or acceptance criteria…"
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  className={`${fieldClass} resize-y`}
                />
                <span className="mt-1 block text-right text-xs font-normal text-slate-400">
                  {draft.description.length.toLocaleString()} / 10,000
                </span>
              </label>
            </fieldset>
            <fieldset className="grid min-w-0 grid-cols-1 gap-5 border-t border-slate-100 pt-5 md:grid-cols-2">
              <legend className="mb-1 text-xs font-bold uppercase tracking-widest text-indigo-600">
                Classification
              </legend>
              <label className="text-sm font-semibold text-slate-700">
                Priority
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    update(
                      "priority",
                      event.target.value as TaskDraft["priority"],
                    )
                  }
                  className={fieldClass}
                >
                  {taskPriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority[0] + priority.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Type
                <select
                  value={draft.type}
                  onChange={(event) =>
                    update("type", event.target.value as TaskDraft["type"])
                  }
                  className={fieldClass}
                >
                  {taskTypes.map((type) => (
                    <option key={type} value={type}>
                      {type[0] + type.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <fieldset className="min-w-0 border-t border-slate-100 pt-5">
              <legend className="mb-1 text-xs font-bold uppercase tracking-widest text-indigo-600">
                Ownership
              </legend>
              <label className="text-sm font-semibold text-slate-700">
                Assignee
                {canAssignTasks(access.role) ? (
                  <select
                    value={draft.assigneeId}
                    onChange={(event) =>
                      update("assigneeId", event.target.value)
                    }
                    className={fieldClass}
                  >
                    <option value="">Unassigned</option>
                    {access.members.map(({ user }) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      readOnly
                      value={
                        self
                          ? `${self.user.name} (${self.user.email})`
                          : "Loading permissions…"
                      }
                      className={fieldClass}
                    />
                    <span className="mt-2 block text-xs font-normal text-slate-500">
                      New tasks are automatically assigned to you.
                    </span>
                  </>
                )}
              </label>
            </fieldset>
            <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="w-full rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disabled || !draft.title.trim()}
                className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {pending ? "Saving…" : "Create task"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
