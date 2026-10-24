-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD COLUMN "sprintId" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sprint_projectId_idx" ON "Sprint"("projectId");
CREATE INDEX "Sprint_projectId_status_idx" ON "Sprint"("projectId", "status");
CREATE INDEX "Sprint_startDate_endDate_idx" ON "Sprint"("startDate", "endDate");
CREATE INDEX "Task_sprintId_idx" ON "Task"("sprintId");
CREATE UNIQUE INDEX "Sprint_one_active_per_project" ON "Sprint"("projectId") WHERE "status" = 'ACTIVE';
