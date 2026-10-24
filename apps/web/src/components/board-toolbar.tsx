"use client";

import { useEffect, useId, useRef, useState } from "react";
import { boardStatuses, type BoardQuery } from "../lib/board-query";
import {
  taskPriorities,
  taskTypes,
  type TaskCreateMember,
} from "../services/task-create";
import type { BoardSprint } from "../services/board";

export function BoardToolbar({
  query,
  members,
  sprints,
  onChange,
  onClear,
}: {
  query: BoardQuery;
  members: TaskCreateMember[];
  sprints: BoardSprint[];
  onChange: (patch: Partial<BoardQuery>) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState(query.q);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const activeCount = [
    query.q,
    query.status,
    query.priority,
    query.type,
    query.assigneeId,
    query.sprintId,
  ].filter(Boolean).length;
  useEffect(() => setSearch(query.q), [query.q]);
  const filters = [
    {
      key: "status",
      label: "Status",
      options: boardStatuses.map((value) => ({
        value,
        label: value.replaceAll("_", " "),
      })),
    },
    {
      key: "priority",
      label: "Priority",
      options: taskPriorities.map((value) => ({ value, label: value })),
    },
    {
      key: "type",
      label: "Type",
      options: taskTypes.map((value) => ({ value, label: value })),
    },
    {
      key: "assigneeId",
      label: "Assignee",
      options: [
        { value: "unassigned", label: "Unassigned" },
        ...members.map((member) => ({
          value: member.user.id,
          label: member.user.name,
        })),
      ],
    },
    {
      key: "sprintId",
      label: "Sprint",
      options: [
        { value: "backlog", label: "Backlog" },
        ...sprints.map((sprint) => ({ value: sprint.id, label: sprint.name })),
      ],
    },
  ] as const;
  return (
    <section
      aria-label="Board filters"
      className="mt-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)] ring-1 ring-white/70"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50/50 px-4 py-4 sm:px-5">
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-base text-indigo-700"
          >
            ⌕
          </span>
          <span>
            <span className="block">Search &amp; filters</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              Narrow the board to the work that matters now
            </span>
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">
              {activeCount} active
            </span>
          )}
        </button>
        {activeCount > 0 ? (
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
            onClick={() => {
              setSearch("");
              onClear();
            }}
          >
            Clear filters
          </button>
        ) : (
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
            Find tasks by keyword, person, or sprint
          </span>
        )}
      </div>
      <div
        id={panelId}
        hidden={!open}
        className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            trigger.current?.focus();
          }
        }}
      >
        <form
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ q: search.trim() });
          }}
        >
          <label className="min-w-48 flex-1 text-sm font-medium">
            Search tasks
            <input
              type="search"
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, description, or key"
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <button
            className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
            type="submit"
          >
            Search
          </button>
        </form>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {filters.map((filter) => (
            <label key={filter.key} className="min-w-0 text-sm font-medium">
              {filter.label}
              <select
                value={query[filter.key]}
                onChange={(event) =>
                  onChange({ [filter.key]: event.target.value })
                }
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-slate-50 px-2 py-2.5 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">All {filter.label.toLowerCase()}</option>
                {query[filter.key] &&
                  !filter.options.some(
                    (option) => option.value === query[filter.key],
                  ) && (
                    <option value={query[filter.key]}>
                      Selected: {query[filter.key]}
                    </option>
                  )}
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            Press Escape to close filters.
          </p>
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            Done
          </button>
        </div>
      </div>
    </section>
  );
}
