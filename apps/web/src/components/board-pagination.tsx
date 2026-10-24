import type { Board } from "../services/board";

export function BoardPagination({
  pagination,
  loaded,
  disabled,
  onPage,
  onLimit,
}: {
  pagination: Board["pagination"];
  loaded: number;
  disabled: boolean;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
}) {
  const { page, limit, total, totalPages } = pagination;
  return (
    <section
      aria-label="Board pagination"
      className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3.5 text-sm shadow-[0_12px_30px_-26px_rgba(15,23,42,0.55)] ring-1 ring-white/70 sm:px-5"
    >
      <p aria-live="polite" className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold tabular-nums text-indigo-700 ring-1 ring-inset ring-indigo-100">
          {page}
        </span>
        <span>
          <span className="block font-semibold text-slate-800">
            {loaded} of {total} tasks
          </span>
          <span className="block text-xs text-slate-500">
            Page {page} of {Math.max(1, totalPages)}
          </span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold text-slate-500">
          Tasks per page{" "}
          <select
            className="ml-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            value={limit}
            disabled={disabled}
            onChange={(event) => onLimit(Number(event.target.value))}
          >
            {[...new Set([limit, 20, 50, 100])]
              .sort((a, b) => a - b)
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <span aria-hidden="true" className="mr-1">
            ←
          </span>
          Previous page
        </button>
        <button
          type="button"
          className="rounded-xl border border-indigo-200 bg-indigo-600 px-3 py-2 font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next page
          <span aria-hidden="true" className="ml-1">
            →
          </span>
        </button>
      </div>
    </section>
  );
}
