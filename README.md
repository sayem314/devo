# Devo

Devo is a self-hosted automation builder where the main interface is an AI chat plus a TypeScript editor. Instead of wiring node-based workflows, you describe a task, review the generated TypeScript files, edit them directly, and deploy them behind a trigger.

Tasks can run from:

- Manual UI runs
- Opaque webhook endpoints
- Cron schedules with timezone support

Each task owns its own `main.ts`, `.env`, and `package.json` files. Task settings live in the local database and are edited with normal UI controls. Devo stores app data locally and runs task code as child processes.

## Status

Devo is early MVP software for local and self-hosted use by trusted users.

Do not treat the current runtime as a secure multi-tenant sandbox. Task code runs in a separate process with timeouts and output limits, but it still runs on the host with the permissions available to that process.

## Stack

- SvelteKit and Svelte 5
- Better Auth for local email/password auth
- Kysely with libSQL/SQLite
- Bun or Node for task execution
- Monaco editor
- OpenAI Agents SDK for OpenAI-compatible task generation

## Requirements

- Bun for local development commands
- Node-compatible runtime for the SvelteKit app and optional Node task execution

By default, task execution follows the runtime that starts Devo: Bun when Devo runs under Bun, Node when Devo runs under Node. Set `DEVO_TASK_RUNTIME=bun` or `DEVO_TASK_RUNTIME=node` to force one.

## Quick Start

Install dependencies:

```sh
bun install
```

Create a local env file:

```sh
cp .env.example .env
```

Set a real auth secret:

```sh
openssl rand -base64 32
```

Update `.env`:

```sh
AUTH_SECRET=replace-with-your-generated-secret
SITE_URL=http://127.0.0.1:5173
```

Run the dev server:

```sh
bun run dev
```

Open:

```text
http://127.0.0.1:5173
```

The first registered account becomes the admin account. After the first account exists, public registration is blocked. Admin users can add more users from the Users page.

## Docker

Run Devo with Docker:

```sh
docker run --rm \
  -p 3000:3000 \
  -v devo-data:/data \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e SITE_URL="http://127.0.0.1:3000" \
  sayem314/devo:latest
```

Open:

```text
http://127.0.0.1:3000
```

The image stores Devo data in `/data` by default. Mount a persistent volume there for users, tasks, provider settings, task files, installed packages, and run history.

## Environment

App-level configuration lives in environment variables. For local development, copy `.env.example` to `.env`; Vite reads that file while running the dev server. For production, set the same variables in your process manager, container, or hosting environment.

| Variable                       | Default   | Required | Description                                                   |
| ------------------------------ | --------- | -------- | ------------------------------------------------------------- |
| `AUTH_SECRET`                  | none      | Yes      | Secret used by auth. Must be at least 16 characters.          |
| `SITE_URL`                     | none      | Yes      | Public base URL for auth cookies and redirects.               |
| `DEVO_DATA_DIR`                | `.devo`   | No       | Local DB, task files, run files, and installed task packages. |
| `DEVO_TASK_RUNTIME`            | `auto`    | No       | Task runtime: `auto`, `bun`, or `node`.                       |
| `DEVO_WORKERS`                 | `2`       | No       | Number of task workers.                                       |
| `DEVO_TASK_TIMEOUT_MS`         | `30000`   | No       | Maximum runtime for a task process before it is killed.       |
| `DEVO_TASK_MAX_OUTPUT_BYTES`   | `1048576` | No       | Maximum captured stdout/stderr per run.                       |
| `DEVO_TASK_MAX_LOG_LINE_BYTES` | `16384`   | No       | Maximum stored bytes for one log line.                        |
| `DEVO_TERMINAL_TIMEOUT_MS`     | `120000`  | No       | Maximum time for an editor terminal command.                  |
| `DEVO_SCHEDULER_INTERVAL_MS`   | `15000`   | No       | How often cron tasks are checked.                             |
| `DEVO_RUN_RETENTION_DAYS`      | `30`      | No       | Run history retention by age. Use `0` to disable.             |
| `DEVO_MAX_RUNS_PER_TASK`       | `100`     | No       | Run history retention by count per task. Use `0` to disable.  |

Use task-level `.env` files for task secrets such as API keys, database URLs, and integration tokens. Task env values are edited per task in the editor and are passed only to that task's run process.

Devo validates app-level environment variables at startup with Zod. If a required value is missing or malformed, startup fails with an `Invalid Devo environment` error.

## AI Providers

Configure AI providers in Settings. API keys are stored in the local Devo database and are scoped to the user that saved them.

Supported provider entries:

- OpenAI
- Anthropic Claude
- DeepSeek
- Kimi
- GLM / Z.ai
- OpenRouter
- Custom OpenAI-compatible provider

Each provider can have its own API key, base URL, model list, and default model. Model lists use SDK metadata as a fallback and can be refreshed from the provider API after an API key is saved.

The task editor chat lets you switch provider and model before sending a prompt.

## Task Files

Each task is edited as files:

- `main.ts`: task code
- `.env`: task environment variables
- `package.json`: task dependencies

Task name, description, trigger type, cron expression, timezone, and webhook URL are stored in the database and edited from the task editor settings panel.

If `main.ts` imports a package that is missing from `package.json`, Devo shows a warning in the editor. Install dependencies from the task Terminal, for example:

```bash
bun add zod
```

For Node task runtime, use the package manager you want for that task, such as `npm install zod`.

Task runs execute from that task directory, so dependencies installed from Terminal are available to later manual, cron, and webhook runs.

### Manual Task

`main.ts`:

```ts
export async function run(payload: unknown, ctx: { run_id: string; task_id: string; trigger: string }) {
  console.log("manual payload", payload);

  return {
    ok: true,
    run_id: ctx.run_id,
    at: new Date().toISOString()
  };
}
```

### Webhook Task

`main.ts`:

```ts
export async function webhook(req: Request, ctx: DevoWebhookContext) {
  const raw_body = await req.text();
  const body = JSON.parse(raw_body) as { id: string };

  console.log("received order", {
    id: body.id,
    run_id: ctx.run_id,
    signature: req.headers.get("x-shopify-hmac-sha256")
  });

  return Response.json({
    ok: true,
    orderId: body.id
  });
}
```

Webhook tasks get an opaque endpoint generated by Devo. Treat that URL like a secret. Rotate it if it is exposed. `req` is reconstructed with the original method, URL, query string, headers, and raw body. Use `await req.text()` when signature verification needs the raw body; otherwise use `await req.json()`.

### Cron Task

`main.ts`:

```ts
export async function cron(ctx: { run_id: string; task_id: string; trigger: string }) {
  console.log("nightly sync started", ctx.run_id);

  return {
    ok: true,
    syncedAt: new Date().toISOString()
  };
}
```

Cron tasks use five-field cron expressions. The scheduler runs inside the app process and checks due tasks every `DEVO_SCHEDULER_INTERVAL_MS`.

### Task Environment

Task `.env` files use `KEY=value` lines:

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/app
SHOPIFY_TOKEN=shpat_xxx
```

Blank lines and lines starting with `#` are ignored. App-level secrets such as `AUTH_SECRET` and `SITE_URL` are not passed into task processes.

## Data

By default Devo stores local runtime data under `.devo`:

- `devo.db`
- task source files
- per-task package installs
- run files and logs

Set `DEVO_DATA_DIR` to move this directory:

```sh
DEVO_DATA_DIR=/var/lib/devo
```

Back up this directory if you care about tasks, users, AI provider settings, and run history.

## Development

Run checks:

```sh
bun run check
```

Run tests:

```sh
bun test
```

Check formatting:

```sh
bun run format:check
```

Format files:

```sh
bun run format
```

Build:

```sh
bun run build
```

## Deployment Notes

For a basic self-hosted deployment:

1. Install dependencies with `bun install`.
2. Build the app with `bun run build`.
3. Set `AUTH_SECRET` to a strong random value.
4. Set `SITE_URL` to the exact public URL, for example `https://devo.example.com`.
5. Set `DEVO_DATA_DIR` to a persistent directory or mounted volume.
6. Set `DEVO_TASK_RUNTIME` if you want to force `bun` or `node`; otherwise leave it as `auto`.
7. Run the built SvelteKit app with the Node adapter output.
8. Put Devo behind HTTPS if it is reachable outside localhost.

Example runtime command:

```sh
NODE_ENV=production HOST=0.0.0.0 PORT=3000 node build
```

For MVP deployments, run one Devo app instance. The scheduler and worker pool run inside the app process, and multiple app instances can duplicate scheduler work unless you add external coordination.

Keep `DEVO_DATA_DIR` on durable storage. If this directory is deleted, Devo loses users, tasks, provider settings, run history, installed packages, and local task files.

## Security Notes

Current protections:

- Authentication is required for the app and internal APIs.
- The first user is admin; later public registration is blocked.
- Tasks and runs are scoped by owner in the app.
- Webhook URLs are opaque and can be rotated.
- Task processes run separately from the app process.
- The worker pool limits concurrent task runs.
- Per-run timeout kills long-running task processes.
- Output size caps prevent unlimited log capture.
- Stale running runs are cleaned up on startup.

Current limitations:

- Task code is not container-isolated.
- Task code can access the host permissions available to the task process.
- Network and filesystem access are not policy-restricted.
- Dependencies installed by tasks run package install scripts.
- Webhook URLs act like bearer secrets; anyone with the URL can trigger that task.
- This is not ready for untrusted third-party users.

Run Devo only for users you trust. For untrusted users or commercial hosted multi-tenant use, Devo needs a stronger isolation layer such as containers, microVMs, or a dedicated sandbox.

## License

License is not finalized yet.
