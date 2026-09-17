# Task 13: nested legacy assets, flags, promotion and metadata

## Branch evidence and reused work

Started from a clean `MAV-3974/architecture` checkout at `36e24bf61bea56c19ee7bd78649d7551a22cdb9d`. Fetch succeeded on 2026-09-10; implementation continued on 2026-09-11.

| Ref                                               | Starting SHA                               |
| ------------------------------------------------- | ------------------------------------------ |
| Local integration / HEAD                          | `36e24bf61bea56c19ee7bd78649d7551a22cdb9d` |
| `origin/MAV-3974/architecture`                    | `9789f42c435181273f039ca595b0bdea1fb69431` |
| `origin/dev`                                      | `1cc65ac19a7e3c931def7fc5071d6697ecaee0a9` |
| `origin/pr/30` / `origin/dev-architecture-update` | `523a21a348fcbef3330f64aa2da1c00fecb45a7e` |
| Local reference `dev-architecture-update`         | `50c10e72478c36f5acb0a87b6e1bf8c7efc0fc7c` |
| Task 12 branch                                    | `ed238dcba85681cf220cab83e060553696bf6b55` |

Task 12's documentation commit `23264021cf2f833e9efc38e53d9923497db68351` and subsequent marker-waiver commit were already merged in starting integration. No duplicate merge was needed. No Task 13 branch or equivalent commit existed; `task-13-redem` was created from integration. Task 10 destination factories, setters, staging, hydration and actual adapters, plus Task 11 migration and single-owner protocol, are reused. No PR #30 code was merged wholesale. Exact resulting implementation/merge refs belong in the delivery report to avoid a self-referential commit hash here.

## Actual sources and precedence

The six production reducers and serialization utility matched `origin/dev` before editing. Browser Redux storage uses plain objects (`serialize: false`, `deserialize: false`); serialized localStorage stores JSON roots whose values are individually JSON-encoded. Both forms and JSON object roots are accepted. These tests use sanitized fixtures constructed from inspected source contracts, not a captured profile.

| Legacy browser/localStorage key     | Selected source                                                                       | Destination                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `persist:root.assets`               | `tokens.data`, `collectibles.data`, `rwas.data`: account@chain → slug → status/manual | `zustand-assets` fields `tokens`, `collectibles`, `rwas` |
| `persist:root.collectibles`         | `adultFlags`: slug → `{ val: boolean, ts: seconds }`                                  | `zustand-assets.collectibleAdultFlags`                   |
| `persist:root.rwas`                 | Same adult flag contract                                                              | `zustand-assets.rwaAdultFlags`                           |
| `persist:root.partnersPromotion`    | `shouldShowPromotion`, `promotionHidingTimestamps`                                    | Same fields in `zustand-ui`                              |
| `persist:root.collectiblesMetadata` | `records: TokenMetadata[]`                                                            | `zustand-metadata.collectiblesMetadata`                  |
| `persist:root.rwasMetadata`         | `records: TokenMetadata[]`                                                            | `zustand-metadata.rwasMetadata`                          |

Each browser read must succeed with absence before requesting that key from foreground localStorage. A failed read, null, malformed present root/slice, invalid status/manual/flag/timestamp/metadata, or unsafe graph/key rejects initialization. The background cannot inspect localStorage itself; the existing trusted-extension-page protocol now requests individual nested keys. Fallback failures remain errors and retry rereads storage. No defaults are published as migrated state on error.

Metadata arrays use the same `tokenToSlug` exported by `lib/assets` as the production reducers, including numeric ID normalization. Last duplicate slug wins, matching `Map` construction. Legacy metadata IDs must represent nonnegative integers; strings and other metadata scalars retain the destination schema's existing bounds. Asset keys retain exact account/network/slug scoping and all four statuses. Missing `manual` stays missing; false and true remain distinct. Adult boolean values/timestamps are copied without expiry during migration.

Before Task 13 completion, validated legacy entries override matching destination keys; destination-only account/slug/metadata/flag/timestamp entries survive. Promotion's scalar source wins when present. Absent sources preserve existing destination data. Keyed replay is idempotent and no consumers can edit these domains between adoption and completion. After completion, legacy records are never replayed over user changes.

Loading/errors and fetched promotion/detail/security data are excluded from the three migrated destinations. Whitelist/scamlist ownership and offline use remain Redux: existing values are adopted read-only from `root.assets` when the active Redux root lacks them, then persist in `persist:temple-root-task11.assets`. Root partialization excludes migrated asset records and resets transient asset/security loading fields. Subsequent boot prefers this active security cache. Root/security reads are preflighted before `persistor.persist()` so Redux's internal rejected-read handling cannot silently release consumers with empty security defaults.

## Completion, durability and recovery

`legacyAssetsMigrated` is a distinct default-false field in the version-1 `zustand-ui` envelope. Task 11's `legacyMigrated` is still required and does not prove Task 13 completed. Commands cannot write either completion field or analytics identity.

1. Run Task 11, then await successful UI, metadata and asset hydration; retry failed hydration only.
2. Independently read destination envelopes and all required legacy sources; validate sources and all detached destination drafts before committing any Task 13 write.
3. Commit the drafts together through Task 10 staging. Live commands reuse existing destination put/flag/metadata setters; migration uses their shared validated staging boundary to validate all stores before the first write.
4. Flush each actual UI/metadata/assets adapter, bypassing throttling, and independently read all three stores. Compare their full schema-selected state with the expected memory state.
5. Stage `legacyAssetsMigrated: true`, flush UI again and independently verify the expected UI envelope before returning readiness.

This is not a cross-store transaction. A failed write can leave partial durable data. Sources are retained; retry/restart replays them until verified completion. Real adapters retain failed writes for explicit retry. If completion persisted but its verification read failed, a later independently verified load may finish initialization. Completed startup requires all destination envelopes and Task 11 identity consistency; missing stores fail closed. No source is deleted as compensation.

One background owner serializes all foreground initialization/read/command requests. It flushes and independently verifies all three stores before publishing a snapshot. Write failures close the foreground gate and suppress analytics; retry drains retained writes. Two reloads preserve user edits and produce no duplicate records. Commands interrupted before durable acknowledgement may be lost; no guarantee is claimed for unacknowledged commands. Older extension versions do not participate in this coordination protocol, and retained rollback snapshots become stale after new-owner writes.

Analytics ID adoption and consent remain Task 11-owned. Task 13 does not replace `analytics_user_id`, enable analytics, or change consent. Background analytics additionally waits for nested migration; pending/failed commands continue suppressing events. Frontend identity/consent protections remain unchanged.

## Reader/writer handoff

| Domain                            | Readers                                                                      | Writers / remaining Redux responsibility                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Asset records/statuses            | Existing asset selector APIs read owner snapshots                            | Existing put/status/load-success actions become owner commands; fetched-load reconciliation preserves manual/non-idle records. Redux retains loading/errors and security-cache actions.          |
| Collectible/RWA adult flags       | Existing adult selectors read owner snapshots                                | Detail-success actions send flags/timestamp commands; owner retains the existing three-hour expiry semantics for live results. Redux retains fetched details/loading/errors.                     |
| Collectible/RWA metadata          | Existing selectors read owner records; all-record hooks return memoized Maps | Existing put actions build metadata once and command the owner; loading reset occurs after saving. RWA filtering retains the production symbol list through a shared pure classification helper. |
| Asset classification during fetch | Existing asset epics combine owner token and nested metadata                 | Existing network requests/balance actions remain Redux orchestration.                                                                                                                            |
| Partner promotion preferences     | Existing preference/timestamp selectors read owner UI                        | Toggle/hide actions command the owner with existing timestamp pruning/reset semantics. Fetched promotion remains Redux-owned.                                                                    |
| IndexedDB migration producers     | Existing hook remains unchanged                                              | Its existing `put*AsIsAction` producers are intercepted by the same owner bridge. Registration and clearing behavior are not changed; see Task 14 limitations below.                             |

The six nested persistence registrations no longer write; exported reducer names and action APIs remain compatible. Historical reducer cases intercepted by middleware are inert compatibility code, not synchronization loops. Unrelated Redux, SWR and Effector consumers remain live. Foregrounds import schema/command contracts and read-only clients, never destination adapters. `src/intercom-client.ts` remains live and untouched.

## Verification

Baseline logs: `/tmp/task-13-baseline/`. Baseline full Jest: 49 suites passed / four failed; 354 tests passed / one failed. Baseline TypeScript: the same 11 dependency declaration syntax errors in Apollo, Babel traverse and Lodash types recorded by Task 11. No baseline failures were suppressed.

Final logs: `/tmp/task-13-final/`. Focused logs: `/tmp/task13-focused.log` plus the corrected startup suite in `/tmp/task13-startup.log`.

| Check                             | Result                                                                                                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Tasks 8–13                | 20 suites / 141 tests passed across the focused run and corrected startup rerun; all also passed in final full Jest.                                                                                                                                     |
| Full Jest                         | 53 suites passed / same four failed; 388 tests passed / same one failed. 34 additional tests pass.                                                                                                                                                       |
| `yarn ts`                         | Same 11 dependency syntax diagnostics, compared after removing terminal colors.                                                                                                                                                                          |
| Changed-file semantic check       | No diagnostics.                                                                                                                                                                                                                                          |
| Whole-project semantic comparison | 423 unique diagnostics before and after. Two message strings differed only in inferred type rendering; both affected untouched files had identical diagnostic codes/positions in a targeted starting-source comparison. No new diagnostic location/code. |
| Targeted ESLint                   | Zero errors; 40 warnings (primarily test casts and retained assertion boundaries).                                                                                                                                                                       |
| Prettier / `git diff --check`     | Passed.                                                                                                                                                                                                                                                  |
| `yarn build`                      | Passed; Chrome archive produced.                                                                                                                                                                                                                         |
| `yarn build:firefox`              | Passed; Firefox archive produced.                                                                                                                                                                                                                        |

Unchanged failing Jest suites: `src/lib/temple/beacon.test.ts`, `src/lib/temple/back/store.test.ts`, `src/lib/utils/amounts/index.test.ts`, `basenet_kyc_onboard.spec.ts`. No baseline failures were changed or suppressed. Semantic comparison uses the starting commit's source through a compiler host, with the same installed dependencies; it is supplementary evidence, not a claim that the full TypeScript command passes.

Tests cover all six source forms, all statuses/manual distinctions, flags/timestamps, promotion preferences, production metadata slug conversion, malformed/unsafe input, browser/fallback read failures, actual adapter flush/read-back, partial writes, completion write/read failure, retry/interruption, concurrent contexts, two reloads, destination/source precedence, analytics identity/consent/readiness, live producer handoff, real Redux security persistence and retained legacy payloads. Startup tests isolate network epics/devtools; no installed-extension/profile smoke test is claimed.

## Documentation Update and Task 14 handoff

Updated AGENTS architecture guidance, appended activation links to Tasks 10/11 and extended Task 12's ready-to-file retirement inventory with actual modules/keys and narrow bridges. The user-approved deletion-marker waiver remains; release evidence, supported direct-upgrade policy, rollback policy and external tracker access remain future decisions.

Task 14 must use the existing background owner's durable command boundary and wait for both migrations. Current IndexedDB `migrateFromIndexedDB` dispatches without awaiting owner acknowledgement and clears its source afterward; this existing unsafe clearing contract is explicitly not repaired here. Task 14 must address acknowledgement before clearing, missing-metadata classification, migration naming/history semantics, interruption and direct pre-1.18.2 upgrades in its own scope. Do not introduce another destination adapter or assume Task 13 completion proves IndexedDB migration ran.

No edits under `src/mavryk/api/**`, IndexedDB migration/repository/registration edits, legacy payload deletion, dependency/toolchain upgrades, prefix renames, pushes or merges into `dev` are included. Local ignored `arch-adjust/` descriptions are preserved.

## Exact changed files

- `AGENTS.md`
- `docs/task-10-zustand-foundation.md`
- `docs/task-11-legacy-ui-handoff.md`
- `docs/task-12-legacy-retirement-ledger.md`
- `docs/task-13-legacy-assets-handoff.md`
- `src/app/store/assets/epics.ts`
- `src/app/store/assets/reducer.ts`
- `src/app/store/assets/security-persistence.test.ts`
- `src/app/store/assets/security-persistence.ts`
- `src/app/store/assets/selectors.ts`
- `src/app/store/collectibles-metadata/reducer.ts`
- `src/app/store/collectibles-metadata/selectors.ts`
- `src/app/store/collectibles/reducer.ts`
- `src/app/store/collectibles/selectors.ts`
- `src/app/store/index.ts`
- `src/app/store/migrations.ts`
- `src/app/store/owned-assets.middleware.test.ts`
- `src/app/store/owned-assets.middleware.ts`
- `src/app/store/partners-promotion/reducers.ts`
- `src/app/store/partners-promotion/selectors.ts`
- `src/app/store/provider.tsx`
- `src/app/store/rwas-metadata/reducer.ts`
- `src/app/store/rwas-metadata/selectors.ts`
- `src/app/store/rwas/reducer.ts`
- `src/app/store/rwas/selectors.ts`
- `src/app/store/task13-persistence.test.ts`
- `src/lib/metadata/classification.ts`
- `src/lib/metadata/index.ts`
- `src/lib/store/zustand/__tests__/legacy-assets-migration.test.ts`
- `src/lib/store/zustand/__tests__/safe-initialization.test.ts`
- `src/lib/store/zustand/__tests__/stores.test.ts`
- `src/lib/store/zustand/__tests__/ui-client.test.ts`
- `src/lib/store/zustand/__tests__/ui-owner.test.ts`
- `src/lib/store/zustand/assets-command.ts`
- `src/lib/store/zustand/assets-state.schema.ts`
- `src/lib/store/zustand/assets.store.ts`
- `src/lib/store/zustand/legacy-assets-migration.ts`
- `src/lib/store/zustand/legacy-assets-source.ts`
- `src/lib/store/zustand/ui-client.ts`
- `src/lib/store/zustand/ui-owner.contract.ts`
- `src/lib/store/zustand/ui-owner.ts`
- `src/lib/store/zustand/ui-state.schema.ts`
- `src/lib/store/zustand/ui.store.ts`

## Task 14 resolution

[Task 14](task-14-indexeddb-assets-handoff.md) supersedes the unsafe IndexedDB limitation above. Its `assets-migrations@3.0.0` registration awaits a dedicated command in the same background owner after Tasks 11/13. It validates all source rows, preserves existing destination tuples across categories, uses all restored metadata categories and scoped metadata fetch/fallback, verifies actual adapter persistence, and transactionally deletes only unchanged verified source rows. History is separately serialized and verified; neither Task 11/13 flag proves Task 14 completion. The old Redux migration producers are removed; the middleware remains for other live producers. No legacy Redux payload is deleted. See the Task 14 handoff for fallback limitations and interruption recovery.
