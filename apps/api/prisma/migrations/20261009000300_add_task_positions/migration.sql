-- Add stable ordering within each Kanban column.
ALTER TABLE "Task" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Task_projectId_status_position_idx" ON "Task"("projectId", "status", "position");
