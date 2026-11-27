# Code Conventions

Applies to all TypeScript in this repo.

## Where code goes

### Types live in `src/types/`

Every named `type` and `interface` goes in a `*.types.ts` file under `src/types/`,
never in the component, module or script that uses it. Import them with `import type`.

| File | What goes in it |
|---|---|
| `shared.types.ts` | Domain types used by both the dashboard and the runner: DB row types and enums (from `src/db/schema.ts`), app config (from the Zod schema in `src/lib/app-config.ts`) |
| `dashboard.types.ts` | Dashboard types: component props, form state, view models (`Project`, `ProjectRun`), seed data |
| `runner.types.ts` | Runner types: Claude call options/results, test plan and repair verdict |

Add to an existing file first. Only start a new `*.types.ts` file when a new area
has enough types that none of the above fits (e.g. a mobile runner).

Types derived from a value (Drizzle tables, Zod schemas) still live here; import the
value with `import type` and derive with `typeof`:

```ts
import type { z } from "zod";
import type { appConfigSchema } from "@/lib/app-config";

export type AppConfig = z.infer<typeof appConfigSchema>;
```

A small inline annotation in a function signature (e.g. `{ run: Run }` as a
component's props) can stay inline; once it needs a name, it moves to `src/types/`.

### Helpers live in `src/lib/helpers.ts`

Pure helper functions (formatting, labels, slugs, status and grouping logic, parsing)
go in `src/lib/helpers.ts`, not in the component or page that uses them. Constants
those helpers need (e.g. `runSteps`) live there too.

`helpers.ts` is imported by client components, so keep it pure and browser-safe:
no Node built-ins (`fs`, `path`, `child_process`), no database client, no React/JSX.
A helper returns data (e.g. a string); the component wraps it in markup.

Code that does IO stays in its own module under `src/lib/` (or `src/db/`): DB queries
(`runs.ts`, `projects.ts`), files and paths (`run-files.ts`, `app-config.ts`), git
(`git.ts`), spawning the runner (`launch-runner.ts`).

## No semicolons after `}`

Omit the semicolon only when it would immediately follow a closing curly brace —
interfaces, classes, function declarations, `if`/`for`/`while` blocks, and object
literals or arrow functions assigned to a variable.

```ts
interface Player {
  id: string
}

function greet() {
  console.log("hi");
}

const config = {
  width: 640,
  height: 480
}
```

Everything else keeps its semicolon as normal — anything not ending directly in `}`:
`const x = 5;`, `import ... from "...";`, `return foo;`, `console.log("hi");`,
`const list = [1, 2, 3];`.

**Exception:** an interface/class property whose type is an inline object literal keeps
its semicolon, matching the sibling properties around it.

```ts
export interface RoomSnapshot {
  name: string;
  gridSize: { width: number; height: number };
  maxPlayers: number;
}
```

## Import order

Default imports first, then a blank line, then named/specific (`{ }`) imports.

```ts
import Phaser from "phaser";

import type { CharacterClass, Direction } from "@fantasy-grid/shared";
```

## No trailing commas

Omit the trailing comma after the last item in arrays, objects, parameter lists, etc.

```ts
const directions = ["up", "down", "left", "right"];

const player = {
  id: "1",
  displayName: "Alice"
}
```

## Comments

Code should document itself through clear names and structure. Add a comment only when
it's absolutely necessary — to explain a non-obvious *why* (a workaround, a constraint,
a surprising requirement) that the code can't express. Never restate what the code does.

Comments always go on their own line, never at the end of a line of code.

```ts
// Playwright reports a test that passes on retry as flaky.
const retries = 1;
```

Not:

```ts
const retries = 1; // a pass on retry is reported as flaky
```
