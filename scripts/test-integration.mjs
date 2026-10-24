import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { api, apiRequire, loadRootEnv } from "./workspace.mjs";
import { startBrowserStack } from "./test-browser-stack.mjs";

// Never reset a database: this invocation owns exactly one randomly named schema.
const schema = `taskforge_test_${randomBytes(16).toString("hex")}`;
const safeSchema = /^taskforge_test_[a-f0-9]{32}$/;
let client;
let created = false;
let stage = "environment validation";
let stopBrowserStack;
try {
  loadRootEnv();
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("Integration tests require native local PostgreSQL.");
  }
  if (!safeSchema.test(schema)) throw new Error("Invalid generated schema.");
  url.searchParams.set("schema", schema);
  const databaseUrl = url.toString();
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    TASKFORGE_INTEGRATION: "1",
    TASKFORGE_TEST_SCHEMA: schema,
    TASKFORGE_TEST_DATABASE_URL: databaseUrl,
    JWT_SECRET: randomBytes(48).toString("hex"),
    JWT_EXPIRES_IN: "15m",
    WEB_ORIGIN: "http://localhost:3000",
    AUTH_RATE_LIMIT_MAX: "1000",
    NO_COLOR: "1",
  };
  // CLI diagnostics can contain credentials; migrations intentionally report only status.
  const run = (entry, args, showOutput = false) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [entry, ...args], {
        cwd: api,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const redact = (text) =>
        text
          .replaceAll(process.env.DATABASE_URL, "[database URL]")
          .replaceAll(databaseUrl, "[test database URL]")
          .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database URL]");
      for (const stream of [child.stdout, child.stderr]) {
        let output = "";
        stream.on("data", (chunk) => {
          output += chunk.toString();
        });
        stream.on("end", () => {
          if (showOutput) process.stdout.write(redact(output));
        });
      }
      child.on("error", () =>
        reject(new Error("Child process could not start.")),
      );
      child.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error("Child process failed.")),
      );
    });
  const { PrismaClient } = apiRequire("@prisma/client");
  client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: [],
  });
  stage = "creating isolated schema";
  await client.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  console.log("Created invocation-owned integration schema.");
  stage = "deploying migrations";
  await run(apiRequire.resolve("prisma/build/index.js"), ["migrate", "deploy"]);
  console.log("Migrations deployed to integration schema.");
  if (process.argv.includes("--e2e")) {
    stage = "isolated browser stack";
    stopBrowserStack = await startBrowserStack(env);
    stage = "browser tests";
    await run(
      apiRequire.resolve("@playwright/test/cli"),
      ["test", "--config", "../web/playwright.config.ts"],
      true,
    );
  } else {
    stage = "integration tests";
    await run(
      join(dirname(apiRequire.resolve("vitest/package.json")), "vitest.mjs"),
      ["run", "--config", "vitest.integration.config.ts"],
      true,
    );
  }
} catch {
  console.error(
    `Integration run failed during ${stage}. Database credentials are not logged.`,
  );
  process.exitCode = 1;
} finally {
  if (stopBrowserStack) await stopBrowserStack();
  if (created && client && safeSchema.test(schema)) {
    try {
      await client.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      console.log("Removed invocation-owned integration schema.");
    } catch {
      console.error(`Could not remove invocation-owned schema ${schema}.`);
      process.exitCode = 1;
    }
  }
  if (client) await client.$disconnect();
}
