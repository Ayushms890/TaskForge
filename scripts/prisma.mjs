import { supervise } from "./processes.mjs";
import { api, apiRequire, loadRootEnv } from "./workspace.mjs";

loadRootEnv();
supervise([
  {
    name: "Prisma CLI",
    cwd: api,
    args: [
      apiRequire.resolve("prisma/build/index.js"),
      ...process.argv.slice(2),
    ],
    env: process.env,
  },
]);
