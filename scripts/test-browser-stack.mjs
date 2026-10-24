import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { api, web, apiRequire, webRequire } from "./workspace.mjs";

async function checkPort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Test port ${port} is occupied; no existing server will be reused.`,
        ),
      ),
    );
    server.listen(port, () => server.close(resolve));
  });
}

export async function startBrowserStack(env) {
  await checkPort(3100);
  await checkPort(4100);
  // Fixed dedicated ports match the browser config; never reuse the user's dev stack.
  env.E2E_BASE_URL = "http://localhost:3100";
  env.E2E_API_URL = "http://localhost:4100/api";
  const children = [];
  const stop = async () => {
    for (const child of children.reverse()) {
      if (!child.pid) continue;
      if (process.platform === "win32") {
        await new Promise((resolve) => {
          const killer = spawn(
            "taskkill",
            ["/PID", String(child.pid), "/T", "/F"],
            { stdio: "ignore" },
          );
          killer.once("error", resolve);
          killer.once("close", resolve);
        });
      } else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          /* already stopped */
        }
      }
    }
  };
  try {
    const launch = (cwd, entry, args) => {
      const child = spawn(process.execPath, [entry, ...args], {
        cwd,
        env: {
          ...env,
          NODE_ENV: "development",
          API_PORT: "4100",
          WEB_ORIGIN: env.E2E_BASE_URL,
          NEXT_PUBLIC_API_URL: env.E2E_API_URL,
          TASKFORGE_E2E: "1",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: "ignore",
        detached: process.platform !== "win32",
      });
      child.on("error", () => {
        child.failed = true;
      });
      children.push(child);
    };
    launch(api, apiRequire.resolve("tsx/cli"), ["src/server.ts"]);
    launch(web, webRequire.resolve("next/dist/bin/next"), [
      "dev",
      "--port",
      "3100",
    ]);
    for (const url of [
      "http://localhost:4100/api/health",
      "http://localhost:3100/login",
    ]) {
      const deadline = Date.now() + 90000;
      let ready = false;
      while (Date.now() < deadline) {
        if (children.some((child) => child.failed || child.exitCode !== null))
          throw new Error("Test server exited.");
        try {
          ready = (await fetch(url, { signal: AbortSignal.timeout(5000) })).ok;
        } catch {
          /* startup */
        }
        if (ready) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!ready) throw new Error("Test server readiness timed out.");
    }
    console.log("Isolated local browser servers ready on 3100/4100.");
    return stop;
  } catch (error) {
    await stop();
    throw error;
  }
}
