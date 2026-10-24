import { spawn } from "node:child_process";

// Launch Node entrypoints directly: no shell syntax or platform-specific npm shims.
export function supervise(commands, options = {}) {
  const host = options.host ?? process;
  const start = options.spawn ?? spawn;
  const platform = options.platform ?? process.platform;
  const live = new Set();
  let stopping = false;
  let timer;

  function killTree(child, signal) {
    if (!child.pid) return;
    if (options.killTree) return options.killTree(child, signal);
    if (platform === "win32") {
      // Windows has no process-group signals; include watcher/server descendants.
      const killer = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        {
          stdio: "ignore",
          windowsHide: true,
        },
      );
      killer.on("error", () => child.kill());
    } else {
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
  }

  function cleanup() {
    clearTimeout(timer);
    host.removeListener("SIGINT", onInterrupt);
    host.removeListener("SIGTERM", onTerminate);
  }

  function shutdown(code, signal = "SIGTERM") {
    if (stopping) return;
    stopping = true;
    host.exitCode = code;
    for (const child of live) killTree(child, signal);
    if (!live.size) return cleanup();
    timer = setTimeout(() => {
      for (const child of live) killTree(child, "SIGKILL");
    }, 5000);
    timer.unref();
  }

  const onInterrupt = () => shutdown(130, "SIGINT");
  const onTerminate = () => shutdown(143);
  host.on("SIGINT", onInterrupt);
  host.on("SIGTERM", onTerminate);

  for (const command of commands) {
    if (stopping) break;
    let child;
    try {
      child = start(process.execPath, command.args, {
        cwd: command.cwd,
        env: command.env ?? process.env,
        stdio: "inherit",
        detached: platform !== "win32",
      });
    } catch {
      console.error(`Could not start ${command.name}.`);
      shutdown(1);
      break;
    }
    live.add(child);
    child.once("error", () => {
      console.error(`Could not start ${command.name}.`);
      live.delete(child);
      shutdown(1);
      if (!live.size) cleanup();
    });
    child.once("exit", (code, signal) => {
      // A watcher can leave descendants when it exits unexpectedly.
      if (!stopping && platform !== "win32") killTree(child, "SIGTERM");
      live.delete(child);
      shutdown(
        code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1),
      );
      if (!live.size) cleanup();
    });
  }
}
