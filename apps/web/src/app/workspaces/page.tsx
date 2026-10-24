import { WorkspaceList } from "../../components/workspace-list";

export default function WorkspacesPage() {
  return (
    <div className="tf-page-shell">
      <div aria-hidden="true" className="tf-grid" />
      <div aria-hidden="true" className="tf-noise" />
      <div aria-hidden="true" className="tf-aurora tf-aurora--primary" />
      <div aria-hidden="true" className="tf-aurora tf-aurora--secondary" />
      <div className="tf-page-frame bg-white/20">
        <WorkspaceList />
      </div>
    </div>
  );
}
