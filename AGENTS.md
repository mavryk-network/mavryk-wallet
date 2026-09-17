# App Agent Guide

## Sources of Truth

Before enforcing versions, scripts, or conventions, verify in `package.json` and local config files.
Current pinned stack in manifest includes:

- TypeScript `4.5.5`
- React `18.2.0`
- Zustand `5.0.11` (Tasks 11/13 activate preferences, assets, adult flags and metadata through one background owner; see `docs/task-13-legacy-assets-handoff.md`)
- `@mavrykdynamics/webmavryk*` family `2.0.1`

## Architecture and Boundaries

- Keep `src/*.ts(x)` for entrypoints and globals; put feature logic in existing domain folders.
- `src/app/` owns React presentation and app orchestration; `src/lib/` owns shared domain services and infrastructure.
- Keep content scripts thin and browser-specific. Keep API transport in provider clients and orchestration above them.
- `src/mavryk/` owns Mavryk-specific integrations; preserve task-specific restrictions on `src/mavryk/api/**`.
- Tasks 11/13 own UI preferences, promotion choices, asset records/statuses, adult flags and metadata through one background owner. Foregrounds use read-only snapshots and commands. Do not add competing destination adapters or Redux synchronization loops.
- Redux retains fetched details, loading/errors, whitelist/scamlist security caches and unrelated domains. Security caches persist in `persist:temple-root-task11`; the six nested legacy keys are retained read-only sources. Task 14 migrates IndexedDB assets through that owner with verified per-record cleanup and separate `assets-migrations@3.0.0` history; see `docs/task-14-indexeddb-assets-handoff.md`.
- For unfamiliar paths, consult only the relevant section of [the local directory reference](docs/agent-directory-map.local.md). Do not load it by default. If absent in another checkout, inspect the relevant directories instead; it is optional navigation context.

## Context and Verification Efficiency

- Read explicitly required documents once. Afterward, retrieve only relevant sections unless the file changed or an unresolved question requires rereading.
- Search for symbols/paths first, then read bounded excerpts. Avoid bulk file dumps, truncated tool output, and repeated full logs.
- Keep command logs outside the repository and report concise results; inspect detailed output only for failures or unresolved concerns.
- Complete implementation review and targeted verification before starting full checks. Honor any explicitly required pre-change baseline first.
- After full verification, rerun only checks affected by subsequent changes, failures, or unresolved concerns. Do not repeat passing checks without a concrete reason.
- For documentation/comment-only changes, check formatting, references, and `git diff --check`; skip runtime tests/builds unless executable behavior changed or the user explicitly requires them.
- In handoffs, reference existing task documents and include only new decisions, exact refs, blockers, and verification results; avoid restating the full history.
- These efficiency rules do not waive required checks, safety boundaries, or task scope.

## File and Naming Rules

- Use English for file names and identifiers.
- Keep existing naming style in touched modules; do not mass-rename unrelated files.
- File names are lowercase kebab-case by default; use established suffixes by role:
  - `*.screen.tsx`: screen/page entry
  - `*.block.tsx`: UI block/component
  - `*.provider.tsx`: provider/context orchestration
  - `*.method.ts`: API method boundary
  - `*.schema.ts` / `*.schema.tsx`: runtime schemas (usually zod)
  - `*.types.ts` / `*.types.tsx`: type declarations
  - `*.const.ts` / `*.consts.ts`: constants
  - `*.helpers.ts`: pure helpers
- Hook files and hook functions should start with `use` (`use-*.ts`, `useSomething`).
- Boolean names must use `is/has/can/should` prefixes.
- Handler names should use `handle*`; mutating actions should use clear verbs (`create`, `update`, `delete`, `set`).
- Exported immutable constants should use `UPPER_SNAKE_CASE`; regular variables and functions use `camelCase`; components/types use `PascalCase`.

## Module Structure Rules

- One domain/feature per folder; keep domain files colocated.
- Prefer this structure when adding or expanding modules:
  - `components/` for UI
  - `hooks/` for composition/state logic
  - `utils/` or `helpers/` for pure utilities
  - local `*.types`, `*.schema`, `*.const(s)` files for contracts
- Keep business logic out of render-heavy components; move to app/hooks.
- Avoid cyclic dependencies and deep cross-domain imports; use a domain’s public entrypoint when it exists.

## JSDoc and Effect Comments

- Follow existing codebase practice: use JSDoc for exported functions, provider/service methods, and non-trivial helpers.
- JSDoc blocks should describe intent and contract (what/why), including `@param` and `@returns` when not obvious from the signature.
- Do not add boilerplate comments for trivial one-liners.
- Each `useEffect` must have a short comment directly above it explaining:
  - why the effect exists,
  - what external side effect it manages (subscription, timer, request, sync, analytics, DOM/native bridge),
  - expected cleanup behavior (or why cleanup is not needed).
- Effect comments should explain intent, not restate code line-by-line.

## Coding and Safety Rules

- Change only task-relevant logic; avoid incidental refactors.
- No silent API/contract changes.
- State assumptions when behavior is ambiguous.
- Keep side effects in hooks/services, not render paths.
- Prefer strict typing and narrowing over `any`; avoid `@ts-ignore` unless justified.
- Do not add new production dependencies without approval.

## Logging and Errors

- Never log PII.

## Quick Commands

- `yarn start`
- `yarn build`
- `yarn build:firefox`

IndexedDB migration tests use pinned development-only `fake-indexeddb` with real Dexie transactions and destination adapters. LocalStorage migration history requires cross-context Web Locks; never replace it with an unlocked writer.

## AGENTS Maintenance Protocol

When `package.json` scripts, versions, folder conventions, or testing workflow change, update this file and relevant child AGENTS in the same PR.
