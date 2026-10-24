// Run before importing the real app/Prisma, including when Vitest is invoked directly.
const schema = process.env.TASKFORGE_TEST_SCHEMA ?? "";
let valid = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  valid =
    process.env.NODE_ENV === "test" &&
    process.env.TASKFORGE_INTEGRATION === "1" &&
    /^taskforge_test_[a-f0-9]{32}$/.test(schema) &&
    process.env.DATABASE_URL === process.env.TASKFORGE_TEST_DATABASE_URL &&
    url.searchParams.get("schema") === schema &&
    ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
} catch {
  /* Fail closed without exposing the connection string. */
}
if (!valid)
  throw new Error(
    "Use npm run test:integration: an isolated local schema is required.",
  );
