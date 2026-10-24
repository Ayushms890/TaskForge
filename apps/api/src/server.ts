import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const port = env.PORT ?? env.API_PORT;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`TaskForge API listening on port ${port}`);
});

const shutdown = (signal: string): void => {
  console.log(`TaskForge API received ${signal}; shutting down.`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
