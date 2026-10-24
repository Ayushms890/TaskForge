import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const api = fileURLToPath(new URL("../apps/api/", import.meta.url));
export const web = fileURLToPath(new URL("../apps/web/", import.meta.url));
export const apiRequire = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
export const webRequire = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);

export function loadRootEnv() {
  const { config } = apiRequire("dotenv");
  const result = config({
    path: fileURLToPath(new URL("../.env", import.meta.url)),
    quiet: true,
    override: false,
  });
  // A fully supplied process environment is also valid (for CI/deployment).
  if (result.error && result.error.code !== "ENOENT") {
    throw new Error("Could not load the repository root environment file.");
  }
}
