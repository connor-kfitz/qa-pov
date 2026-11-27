# qa-pov

Proof of concept for an AI QA tool. Claude reads a codebase (or a feature's
diff), plans test cases, writes Playwright specs against a live deployed env
(develop or main), runs them, and stores every result in Postgres for a
dashboard to browse. No app is built per run.

Plan: [QA App Plan Review](https://claude.ai/artifact/XWZi3GomHJMzTEJXZttHN4)

## Stack

- **Dashboard:** Next.js (App Router), Tailwind
- **DB:** Postgres 17 in Docker, Drizzle ORM + drizzle-kit migrations
- **Runner:** Node + TypeScript via `tsx` (`src/runner/`)
- **AI:** local Claude Code headless (`claude -p`), with the Playwright MCP
  server for browser access. Swaps for the Claude API when hosted.
- **Tests:** Playwright Test with video, screenshots, traces, JSON report
- **Validation:** Zod for app configs, test plans and repair verdicts
- **Queue (later):** pg-boss, on the same Postgres

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env        # fill in test logins
pnpm db:up                  # Postgres on localhost:5433
pnpm db:generate && pnpm db:migrate
```

Then edit `qa-apps/synergy-qmp.json` with the real develop URL and repo path.

## Running

```bash
# Feature run (scenario 2): base cases, cap 5
pnpm qa --app synergy-qmp --scenario feature --feature <branch> --max 5

# Whole-codebase run (scenario 1)
pnpm qa --app synergy-qmp --scenario codebase --max 10

# Run a run's generated specs directly
QA_APP=synergy-qmp QA_RUN_DIR=runs/<run id> pnpm pw

pnpm dev                    # dashboard on localhost:3000
```

## Layout

| Path | What |
|---|---|
| `qa-apps/<slug>.json` | Per-app config: base URL, repo, roles. No secrets; roles name env vars. |
| `src/db/schema.ts` | Tables: `apps`, `runs`, `test_cases`, `artifacts` |
| `src/lib/` | Config and plan schemas (Zod) |
| `src/runner/cli.ts` | Run orchestrator: prepare → plan → write → run → repair → save |
| `src/runner/claude.ts` | `claude -p` wrapper |
| `playwright/auth.setup.ts` | Signs in once per role, saves to `.auth/<slug>/<role>.json` |
| `runs/<run id>/` | Generated specs (`*.<role>.spec.ts`), report, results (gitignored) |

Claude never sees passwords: prompts name a role ("as admin") and specs load
the saved session for that role.
