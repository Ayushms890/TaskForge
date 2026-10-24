import { supervise } from "./processes.mjs";
import { api, web, apiRequire, webRequire, loadRootEnv } from "./workspace.mjs";

loadRootEnv();
supervise([
  {
    name: "API development server",
    cwd: api,
    args: [apiRequire.resolve("tsx/cli"), "watch", "src/server.ts"],
  },
  {
    name: "web development server",
    cwd: web,
    args: [webRequire.resolve("next/dist/bin/next"), "dev"],
  },
]);
