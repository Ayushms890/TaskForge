"use client";

import { useEffect, useState } from "react";
import { getDashboard, type Dashboard } from "../services/dashboard";

export function useDashboard(projectId: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    projectId: string;
    attempt: number;
    data?: Dashboard;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getDashboard(projectId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ projectId, attempt, data });
      },
      (cause: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            projectId,
            attempt,
            error:
              cause instanceof Error
                ? cause.message
                : "Could not load dashboard.",
          });
      },
    );
    return () => controller.abort();
  }, [projectId, attempt]);
  const current =
    result?.projectId === projectId && result.attempt === attempt
      ? result
      : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    retry: () => setAttempt((value) => value + 1),
  };
}
