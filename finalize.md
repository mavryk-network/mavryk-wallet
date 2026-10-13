# Finalize Tasks 1–20

Decision date: 2026-10-13. This is the remaining-work plan, not a claim that Task 20 verification or PR creation has happened.

## Delivery decision

Open one cumulative PR **from `MAV-3974/architecture` to `dev`**, covering Tasks 1–19 and the Task 20 acceptance fixes, documentation and evidence. The user completed the work on this branch and explicitly rejected moving it through the older `dev-architecture-update` branch.

There is no technical prerequisite to merge into that reference branch. Git reviews the chosen source against `dev`; the source branch name does not determine which architecture is included. Do not merge either direction with `dev-architecture-update`, rename/reset the current branch, replay completed tasks, or recreate the old Track A/B peel-off queue. PR #30 is historical reference, not the delivery vehicle.

This decision supersedes conflicting delivery instructions in both root remediation plans and ignored `arch-adjust` task files. Task 20 is implementation-plan Step 19; Task 21 is Step 20. Task 21 implementation stays in a separate future release.

## Evidence at this documentation review

These are local refs, not freshly fetched remote or GitHub status:

| Item                                   | Observed evidence                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Current branch / HEAD                  | `MAV-3974/architecture` / `7c32286e438666b7f35a5de52a3a6beb57998add`                                                         |
| Local `origin/dev`                     | `e735af469a85b56fc140999b345989d41afbeadc`                                                                                   |
| Local `origin/dev-architecture-update` | `523a21a348fcbef3330f64aa2da1c00fecb45a7e`                                                                                   |
| `origin/dev...HEAD`                    | 1 dev-only commit / 68 branch-only commits                                                                                   |
| Dev-only commit                        | `e735af46` — `update: KYC contract`; touches package version, ProVersion signer, TZKT API and a local directory document     |
| Task integration                       | First-parent history records Tasks 1–19, ending with Task 19 integration; this is not a fresh functional audit of every task |
| CI gap                                 | `.github/workflows/ci.yml` PR targets include architecture/book-scoping, but exclude `dev`                                   |

Current `package.json` pins TypeScript 4.5.5, React 18.2.0, Query 4.41.0 and Zustand 5.0.11. Redux/SWR/Effector dependencies and unrelated live domains remain. Do not describe this PR as complete removal of those stacks or assume it includes every product feature from PR #30.

[Task 19 verification](docs/task-19-balances-ownership-handoff.md#verification) records Chrome/Firefox builds passing, but `yarn ts` failing with 11 dependency declaration syntax errors and full Jest with 88 passing/four baseline failing suites, 547 passing/one failing test. A later focused regression brings the reconciled passing-test count to 548; that is not a single full-run result. Semantic comparison recorded 434 unchanged diagnostics and is not a passing type-check. Installed-extension smoke was unavailable. These historical results must not be presented as final acceptance.

## Task 20 remaining steps

### 1. Review fresh production lineage

- [ ] Refresh `origin/dev` and `origin/MAV-3974/architecture`; record their SHAs and current HEAD. Check for remote integration changes before pushing.
- [ ] Inspect `git log HEAD..origin/dev` and both incoming and cumulative diffs. Re-evaluate `e735af46` against refreshed refs; account for KYC, signer, network and version behavior explicitly.
- [ ] Reconcile required `dev` changes into the current integration branch, preserving completed work and commit history. Record carry/port/reserved decisions in the existing [sync ledger](docs/pr-30-branch-alignment-dev-sync-ledger.md). No blind whole-file overwrite of current ownership or API/auth/contacts work.
- [ ] Review `git diff --name-status origin/dev...HEAD -- src/mavryk/api` for provenance. Existing intentional branch changes are not automatically remediation violations; identify each rather than requiring a misleading empty cumulative diff. New reserved API changes require owner handling.

### 2. Account for all completed tasks

Create a compact PR coverage table with each Task 1–19, implementation/integration SHA, affected area, verification reference and any outstanding acceptance. Use current history and handoffs; do not reconstruct historical PRs. Include changes already present on `dev` as accounted-for work rather than claiming they remain in the diff.

| Task group | Evidence and review focus                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–6        | Branch alignment, CI, key de-injection, standalone fixes, security and dev/book-scoping sync; inspect task commits and the sync ledger                                                                                                       |
| 7–9        | Exact runtime pins, classified intercom recovery and block-aware quote freshness; inspect commits/tests and current request semantics                                                                                                        |
| 10         | [Zustand foundation](docs/task-10-zustand-foundation.md)                                                                                                                                                                                     |
| 11–14      | [UI migration](docs/task-11-legacy-ui-handoff.md), [retirement inventory](docs/task-12-legacy-retirement-ledger.md), [assets migration](docs/task-13-legacy-assets-handoff.md), [IndexedDB safety](docs/task-14-indexeddb-assets-handoff.md) |
| 15–16      | [Reactive details](docs/task-15-reactive-details-handoff.md), [Query server domains](docs/task-16-query-only-server-domains-handoff.md)                                                                                                      |
| 17–19      | [Assets/security](docs/task-17-assets-security-ownership-handoff.md), [metadata](docs/task-18-metadata-ownership-handoff.md), [balances](docs/task-19-balances-ownership-handoff.md)                                                         |
| 20         | Final lineage review, necessary fixes, CI coverage, acceptance results and this delivery decision                                                                                                                                            |

- [ ] Review the actual cumulative diff against `dev`. Preserve one background owner for durable migrated domains; Query owns server data or request receipts as documented. Keep dormant endpoints dormant and unrelated Redux domains intact.
- [ ] Resolve material outstanding handoff items. Task 12's missing external ticket URL remains explicitly documented; use its ready-to-file ledger until a real tracker destination is available.
- [ ] Record rollback/recovery implications: old retained snapshots can be stale after owner writes. A code revert alone is not proof of safe data rollback.

### 3. Make final verification executable and passing

- [ ] Add `dev` to `.github/workflows/ci.yml` pull-request targets, retaining existing targets. Verify required repository checks actually cover the final PR. Update `AGENTS.md` if testing workflow changes.
- [ ] Resolve the known compiler/dependency declaration incompatibilities and four baseline failing suites. Inspect root causes first; preserve pinned production dependencies unless a change is separately authorized. Do not hide failures, weaken tests or substitute comparative diagnostics for passing `yarn ts`.
- [ ] Complete focused review/tests for any fixes, then run `yarn install --frozen-lockfile`, `yarn ts`, `yarn test`, `yarn build` and `yarn build:firefox` on the final candidate. Record exact SHA, environment, outcomes and failure dispositions; keep detailed logs outside the repository.
- [ ] If an existing failure remains, list it as a release blocker. A draft PR may be opened for review with blockers visible; do not mark Task 20 accepted or claim green CI.

### 4. Complete installed-extension acceptance

Use disposable non-production wallets/profiles and record browser/build refs, fixtures and observed results. Automated handoff tests support but do not replace these checks.

- [ ] Upgrade from a supported production build/profile: custom assets/statuses, adult flags, preferences, analytics ID/consent, promotion choices, metadata and balances survive. Verify persisted destination data, then reload twice for idempotency. Include supported pre-2.0.0 IndexedDB and interrupted-migration cases from the handoffs.
- [ ] Confirmations near timeout and after auto-decline behave correctly; dApp connect, permission, operation and sign flows work. MV3 worker eviction mid-request produces recoverable disconnect behavior without a permanent spinner.
- [ ] Quotes refresh on blocks and submission stays disabled during refetch. Verify existing supported swap behavior without enabling dormant endpoints.
- [ ] Offline cold start retains cached balances/metadata and scam labels; unknown security state is distinct from validated empty data and failure.
- [ ] Switch account, chain, API network and custom RPC; verify scope separation, other-account totals, manual assets, metadata save/refresh, reconnect/block updates and delayed/failed owner acknowledgement.
- [ ] Smoke current API/auth/contacts behavior, key de-injection/security changes, reactive details, exchange rates/card flows and product/UI features actually present in the cumulative diff.

### 5. Open the cumulative PR

- [ ] Commit finalization fixes and tracked documentation; push `MAV-3974/architecture` without force. Check for an existing PR with this exact head/base and update it if present; otherwise open one with base `dev` and head `MAV-3974/architecture`.
- [ ] Suggested title: `Complete architecture remediation and final acceptance (Tasks 1–20)`.
- [ ] Include the coverage table, exact base/head/tested refs, passing checks or visible draft blockers, manual results, limitations and rollback/recovery notes.
- [ ] State explicitly: “Tasks 1–19 were implemented on MAV-3974/architecture. This PR includes those changes and Task 20 finalization. dev-architecture-update is historical reference only; no merge through it is required. Task 21 retirement is deferred.”
- [ ] Reference PR #30 for historical context; do not merge it or automatically close/retarget it. Opening this PR does not authorize merging into `dev`.

## Task 21: deferred retirement

Follow the [Task 12 retirement ledger](docs/task-12-legacy-retirement-ledger.md#future-retirement-acceptance-criteria), including its Tasks 13–19 inventory additions. Require shipped-migration evidence, at least one clean release cycle, supported direct/skipped-upgrade and rollback policies, and proof of zero live readers/writers before each deletion.

Do not blanket-delete the seven historical storage keys, live `persist:temple-root-task11`, `src/intercom-client.ts`, unrelated Redux domains or migration-coupled startup/readiness code. Preserve background authority, identity/consent, verified durability, migration history and Web Locks. `DELETE IN` markers were waived in Task 12; neither package version 3.0.0 nor elapsed time authorizes removal. No persistence-key rename without a compatible migration.

The Tasks 1–20 PR includes the retirement plan and deferral notes, not retirement implementation. File the existing ready-to-file ticket when the established tracker destination/access is known; do not create an invented issue URL.

## Documentation Update

- Both root remediation plans now record the cumulative current-branch PR decision; implementation Steps 19–20 contain corrected Tasks 20–21 contracts.
- Local `arch-adjust/remed-task-20-final-core-architecture-pr.md` and `remed-task-21-future-legacy-dead-code-retirement.md` mirror this decision. They are ignored by Git; this file and the root plans provide the tracked instructions.
- During Task 20, append fresh sync evidence to the existing sync ledger and final acceptance evidence here or in a linked tracked handoff. Update `AGENTS.md` only for actual version/script/convention/testing changes.

This documentation change performs no merge, push, PR creation, runtime fix or final acceptance run.
