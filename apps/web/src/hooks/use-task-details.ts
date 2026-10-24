"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getTaskActivities,
  getTaskComments,
  getTaskDetails,
  getTaskPeople,
  type Activity,
  type Comment,
  type Member,
  type Pagination,
  type Task,
  type User,
} from "../services/task-details";

export function useTaskDetails(taskId: string) {
  const [task, setTask] = useState<Task | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [commentPagination, setCommentPagination] = useState<Pagination | null>(
    null,
  );
  const [activityPagination, setActivityPagination] =
    useState<Pagination | null>(null);
  const [commentPage, setCommentPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const commentsRequest = useRef<AbortController | null>(null);
  const activitiesRequest = useRef<AbortController | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const detail = await getTaskDetails(taskId, signal);
        if (!detail.task) throw new Error("Task was not found.");
        const [people, commentResult, activityResult] = await Promise.all([
          getTaskPeople(detail.task, signal),
          getTaskComments(taskId, 1, signal),
          getTaskActivities(taskId, 1, signal),
        ]);
        if (signal?.aborted) return;
        setTask(detail.task);
        setCurrentUser(detail.currentUser);
        setMembers(people);
        setComments(commentResult.comments);
        setCommentPagination(commentResult.pagination);
        setActivities(activityResult.activities);
        setActivityPagination(activityResult.pagination);
        setCommentPage(1);
        setActivityPage(1);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        )
          return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load task.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reloadComments = useCallback(
    async (page: number) => {
      commentsRequest.current?.abort();
      const controller = new AbortController();
      commentsRequest.current = controller;
      try {
        const result = await getTaskComments(taskId, page, controller.signal);
        if (controller.signal.aborted) return;
        setComments(result.comments);
        setCommentPagination(result.pagination);
        setCommentPage(page);
      } catch (requestError) {
        if (!(
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ))
          throw requestError;
      }
    },
    [taskId],
  );
  const reloadActivities = useCallback(
    async (page: number) => {
      activitiesRequest.current?.abort();
      const controller = new AbortController();
      activitiesRequest.current = controller;
      try {
        const result = await getTaskActivities(taskId, page, controller.signal);
        if (controller.signal.aborted) return;
        setActivities(result.activities);
        setActivityPagination(result.pagination);
        setActivityPage(page);
      } catch (requestError) {
        if (!(
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ))
          throw requestError;
      }
    },
    [taskId],
  );
  return {
    task,
    currentUser,
    members,
    comments,
    activities,
    commentPagination,
    activityPagination,
    commentPage,
    activityPage,
    loading: loading || (task !== null && task.id !== taskId),
    error,
    reload: () => load(),
    reloadComments,
    reloadActivities,
  };
}
