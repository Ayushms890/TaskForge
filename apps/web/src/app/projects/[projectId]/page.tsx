import { KanbanBoard } from "../../../components/kanban-board";
import { Suspense } from "react";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className="tf-page-shell">
      <div aria-hidden="true" className="tf-grid" />
      <div aria-hidden="true" className="tf-noise" />
      <div aria-hidden="true" className="tf-aurora tf-aurora--primary" />
      <div aria-hidden="true" className="tf-aurora tf-aurora--secondary" />
      <div className="tf-page-frame bg-white/20">
        <Suspense
          fallback={
            <p
              className="rounded-2xl border border-slate-200 bg-white/75 p-5 text-sm text-slate-600 shadow-sm"
              role="status"
            >
              Loading board...
            </p>
          }
        >
          <KanbanBoard projectId={projectId} />
        </Suspense>
      </div>
    </div>
  );
}
