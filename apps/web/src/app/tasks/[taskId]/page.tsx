import { TaskDetails } from "../../../components/task-details";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return (
    <div className="tf-page-shell">
      <div aria-hidden="true" className="tf-grid" />
      <div aria-hidden="true" className="tf-noise" />
      <div aria-hidden="true" className="tf-aurora tf-aurora--primary" />
      <div aria-hidden="true" className="tf-aurora tf-aurora--secondary" />
      <div className="tf-page-frame bg-white/20">
        <TaskDetails key={taskId} taskId={taskId} />
      </div>
    </div>
  );
}
