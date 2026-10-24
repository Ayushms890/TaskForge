# Local browser tests

Run against a **dedicated test stack and test database**, never the normal development database. The Playwright config does not start servers or reuse a development server. The caller must provision/start/stop the isolated stack. Defaults are web `http://localhost:3100`, API `http://localhost:4100/api`; endpoint validation rejects non-loopback hosts.

Set the web process's `NEXT_PUBLIC_API_URL=http://localhost:4100/api` and the API process's `WEB_ORIGIN=http://localhost:3100` before starting/building them. Use the same hostname on both processes (cookies are host-scoped). `E2E_API_URL` controls test requests and response matching; it does not change the already-running web bundle's API URL.

From the repository root (dependency installation is coordinated separately):

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
```

Once the isolated stack is ready:

```powershell
$env:E2E_BASE_URL = 'http://localhost:3100'
$env:E2E_API_URL = 'http://localhost:4100/api'
npx playwright test --config apps/web/playwright.config.ts
```

Discovery only, without contacting either server:

```powershell
npx playwright test --config apps/web/playwright.config.ts --list
```

Six independent Chromium tests cover session persistence/logout, rich board task creation, real pointer-grip reorder and empty-column movement with reload persistence, a member's separate browser session and assignment/deletion restrictions, sprint lifecycle/assignment, and exact-confirmation task/workspace deletion including cancellation.

Every test registers randomized `example.test` owner/member accounts via REST, creates its own workspace/project, and signs in through the browser form. No saved storage state, real credentials, token logging, traces, screenshots, or videos are used. Fixture teardown verifies the exact created workspace and owner, then deletes only that workspace using its own owner API session. A workspace already deleted by the UI test is accepted as absent. Accounts remain because the app has no account-deletion endpoint; dispose of the isolated test database through the stack's normal lifecycle. Tests never reset a database.

Failures assert status codes without dumping response headers or auth payloads. Avoid enabling tracing, HAR recording, debug network logging, or screenshots for authentication runs: those artifacts can contain session data. Tests use bounded response and DOM waits, no fixed sleeps, no retries, and one worker.
