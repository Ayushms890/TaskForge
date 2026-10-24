import { ProjectDashboard } from "../../../../components/project-dashboard";

export default async function DashboardPage({
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
        <ProjectDashboard projectId={projectId} />
      </div>
    </div>
  );
}
