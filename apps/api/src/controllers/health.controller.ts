import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

export const getHealth: RequestHandler = (_request, response) => {
  response.json({
    success: true,
    data: { status: "ok", service: "taskforge-api" },
    message: "API is healthy",
  });
};

export const getReadiness: RequestHandler = async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({
      success: true,
      data: { status: "ready", service: "taskforge-api", database: "ok" },
      message: "API is ready",
    });
  } catch {
    response.status(503).json({
      success: false,
      error: {
        code: "SERVICE_NOT_READY",
        message: "The API dependencies are not ready.",
      },
    });
  }
};
