# Task 14: IndexedDB asset safety net

## Branch evidence and scope

Starting HEAD/local `MAV-3974/architecture`: `77de9891317a417200c9dc7c54f68be333964769`. Fetch succeeded on 2026-09-11; remote integration remains `9789f42c435181273f039ca595b0bdea1fb69431`, `origin/dev` is `1cc65ac19a7e3c931def7fc5071d6697ecaee0a9`, and `origin/pr/30` is `523a21a348fcbef3330f64aa2da1c00fecb45a7e`. Task 13 implementation `b439003bf8d5d4016213af88849936f90f95a7bd` is contained in integration. No existing Task 14 branch or equivalent implementation was found; `task-14-redem` was created from that HEAD. Resulting commit and local merge refs belong in the delivery report.

The existing user change, package version `2.0.8` → `3.0.0`, stays uncommitted. Only the new pinned **development dependency** `fake-indexeddb@5.0.2` belongs to this task's package change; it has no dependencies. Existing lock entries, production dependencies and toolchain versions remain unchanged. Tests reuse the already locked `@ungap/structured-clone` polyfill because Jest 27's jsdom lacks structuredClone.

Task 10's guarded destinations and real adapters, Tasks 11/13's serialized background owner and legacy readiness, existing metadata builders/classifiers, and existing repository schema are reused. No wholesale PR #30 merge, push, merge into `dev`, reserved API edit, Task 15 implementation or future retirement is included. Ignored `arch-adjust/` descriptions remain untouched. The local Task 14 registration `assets-migrations@3.0.0` supersedes historical plans saying `@2.0.1`.

## Actual source and destination map

`src/lib/temple/repo.ts` matches `origin/dev`: database `TempleMain`, table `accountTokens`, out-of-line string primary keys. Version 2 indexes `[chainId+account+type]` and `[chainId+type]`; version 3 indexes `[chainId+account]` and `[chainId]`. Neither changes the primary key. Historical writers used `chainId_account_tokenSlug`; migration reads the actual cursor key instead of reconstructing it.

The source has required `account`, `chainId`, `tokenSlug`, numeric `status` and `addedAt`. Status 0/1/2/3 maps exactly to idle/enabled/disabled/removed. Historical optional fields include `latestBalance`, `latestUSDBalance`, `order`, and `type` (0 fungible / 1 collectible). These cache/order/type fields have no destination equivalent and do not determine classification. Validation requires finite nonnegative timestamps, numeric balance strings, nonnegative integer order, valid historical enums and boolean optional `manual`. Unknown fields fail closed. Unsafe keys/object graphs, malformed records and ambiguous duplicate tuples with conflicting status/manual are rejected before writes. Account/network keys cannot contain `@`.

The inspected pre-asset-rework writers (`80a7ea35f^`) were AddAsset, `temple/assets/accountTokens.ts`, and `temple/front/sync-tokens.ts`. They did not store manual origin. Current integration and `origin/dev` have no source writers; only repository declaration and the old migration referenced this table. No table/schema change is needed.

| Data                                                       | Owner/destination                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Account/network/slug status and optional manual choice     | Background owner, `zustand-assets` tokens/collectibles/rwas, `${account}@${chainId}` → slug |
| Restored metadata used for classification                  | Existing owner `zustand-metadata` token, collectible and RWA maps                           |
| Task 14 completion/history                                 | Existing foreground-origin localStorage `MIGRATIONS`, entry `assets-migrations@3.0.0`       |
| UI identity/consent, flags, other metadata and preferences | Existing Tasks 11/13 owners; independently verified and preserved                           |
| Security caches and unrelated Redux data                   | Existing `persist:temple-root-task11`; unchanged                                            |

## Classification, manual policy and precedence

All three restored metadata maps participate. If any candidate satisfies the shared `isCollectible` artifact-field predicate, collectible wins; otherwise the shared RWA symbol predicate wins; otherwise token. This prevents adding overlapping category entries. An existing destination tuple in **any** category wins before classification: its entire status/manual record remains unchanged. Existing duplicates are preserved rather than silently removed. Source-only records get their exact source status and `manual ?? false`; explicit true/false survives, while absent manual cannot be reconstructed from historical writers.

When all restored metadata is missing, the production wrapper calls the existing metadata API helper with the source chain ID, contract and token ID, then the existing built-metadata helper. The fetch receives the scoped source record; it never substitutes the currently selected account/network. Unknown networks have no source RPC URL, so no guessed RPC request is made. Requests have a ten-second classification deadline; late rejection is observed and late results cannot mutate stores. The underlying helper request is not cancelled by that deadline.

Fetch failure/unavailability yields token/manual false unless an explicit source manual choice exists. Invalid returned built metadata fails validation instead of being accepted. Fetched metadata is used only for that record's classification: the current metadata destination is slug-only and cannot safely persist different networks' fetched values. Restored metadata's existing global-slug limitation remains. **Ordinary metadata refresh does not move assets between categories.** A fallback record can remain in tokens until explicitly re-added/reclassified by a future scoped flow; no automatic re-bucketing is claimed.

Destination precedence applies on replay too. In particular, after an interrupted write or failed cleanup, persisted destination choices win over a retained legacy row. This protects newer user choices and Task 13 data; there is no cross-version last-write timestamp in the legacy status contract. A concurrently changed legacy row remains intact on the failing attempt; any later retry applies the same documented destination precedence.

## Ownership, acknowledgement and cleanup

The mount hook registers the corrected name and calls `migrateFromIndexedDB`, which awaits the strict `indexeddb-assets-migration` owner command. The owner runs Tasks 11 and 13, requires successful UI/metadata/assets hydration, and drains retained adapter writes first. No foreground destination adapter or Redux dispatch participates. The owner queue serializes migration, user commands, snapshot reads and concurrent foreground contexts. Pending/error operations continue suppressing analytics through the existing readiness gate.

1. Read actual IndexedDB keys and values in one read transaction. A rejected read rejects migration. Validate the complete snapshot outside the cursor callback, including keys and every record.
2. Build and validate a detached full destination plan. Existing destination tuples win; unrelated state survives. Commit through the real destination staging boundary.
3. Flush the actual UI, metadata and assets adapters. Independently read their stored envelopes and compare **full schema-selected state**, including preserved fields, with the expected values.
4. In a separate IndexedDB read/write transaction, compare each current source value to its captured value and delete only unchanged, verified rows. If any source rows remain (new or changed), throw and abort the entire cleanup transaction, rolling back its deletes. Delete failure likewise rolls back; no whole-table `clear`, unrelated-table clear or database delete exists in production.
5. The owner performs its normal final flush/read-back before acknowledging the command. The foreground records history only after acknowledgement.

This is not a transaction spanning browser storage and IndexedDB. Partial destination writes, read-back mismatch, lost write acknowledgement and interrupted startup retain source until durability is proved. Replay uses keyed destination precedence and cannot roll back newer destination choices. Interruption after verified cleanup but before owner reply/history persistence safely retries against an empty source and independently verifies the owner's destinations. Source cleanup failure leaves history incomplete. No timers, dispatch return values or beforeunload callbacks establish durability.

## History and recovery

`legacyMigrated` and `legacyAssetsMigrated` remain prerequisite flags only. Task 14 completion is its own named `MIGRATIONS` entry; existing `@1.18.2` and unrelated entries are retained. Empty already-migrated profiles are no-ops. Missing history after successful cleanup is independently recoverable by replay; no new completion key is required.

The only localStorage migrator caller is this hook. It now requires a named Web Lock across extension-page contexts, validates history before running, invokes the generic migrator with one migration at a time, and persists/verifies each success immediately. It rereads history after `up()` to preserve additions made during the await. Thus later failure cannot erase an earlier success in this invocation. The generic/vault migrator is unchanged. Web Locks unavailable, malformed history, read/write/read-back failures all reject; there is no unsafe unlocked fallback. Page closure releases the lock; a subsequent page can retry, while the background owner still serializes operations. Older versions do not participate in this lock/owner protocol.

The hook explicitly catches rejection and logs only a fixed non-PII message. It does not print addresses, metadata, source records or arbitrary errors. Owner failures still close the existing consumer gate; history-only failure is retried on a later mount. A successful historical completion is not replayed on each mount. No current source writers remain; unsupported old concurrently running versions can add new retained rows after completion and require an explicit recovery invocation/history repair. Such rows are never deleted by this completed attempt.

All seven retained legacy browser roots and their serialized localStorage copies, active task11 Redux root, analytics identity, Zustand prefixes, migration history and unrelated storage remain preserved. Task 12's deletion-marker waiver and future release decisions remain unchanged.

## Verification

Baseline logs: `/tmp/task-14-baseline/`. Before executable changes, full Jest had 53 passing / four failing suites, 388 passing / one failing tests; `yarn ts` had 11 dependency declaration syntax errors. These match the supplied Task 13 baseline. The session resumed on 2026-09-17 with the work intact but temporary logs absent. Unfinished full verification was restarted; earlier focused verification passed 23 suites / 185 tests (including the corrected import-guard rerun).

Final logs are in `/tmp/task-14-final/`. Checks ran with the user's uncommitted package version preserved.

| Check                                             | Result / baseline comparison                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Tasks 8–14                                | 23 suites / 185 tests passed across the earlier focused run and corrected import-guard rerun; all passed again within final full Jest |
| Full Jest                                         | 56 passed / same four failed suites; 432 passed / same one failed test. 44 additional passing tests                                   |
| `yarn ts`                                         | Same 11 dependency syntax diagnostics in Apollo, Babel traverse and Lodash declarations                                               |
| Whole-project semantic comparison                 | 423 unique diagnostics before and after; no new diagnostics                                                                           |
| Targeted ESLint                                   | Zero errors; 41 warnings, primarily existing/test assertion boundaries                                                                |
| Prettier and `git diff --check`                   | Passed                                                                                                                                |
| `yarn install --frozen-lockfile --ignore-scripts` | Passed; existing dependency resolutions unchanged                                                                                     |
| `yarn build`                                      | Passed; Chrome archive produced                                                                                                       |
| `yarn build:firefox`                              | Passed; Firefox archive produced                                                                                                      |

The unchanged failing suites are `src/lib/temple/beacon.test.ts`, `src/lib/temple/back/store.test.ts`, `src/lib/utils/amounts/index.test.ts`, and `basenet_kyc_onboard.spec.ts`. Their existing assertion/fixture/compiler failures were not suppressed. Semantic comparison uses starting-HEAD sources and current sources with the same installed dependencies; it supplements rather than replaces the failing full TypeScript command.

Tests use real Dexie operations against fake-indexeddb and real destination adapter flush/read-back, plus injected failures. Owner tests separately exercise actual request serialization/readiness; history tests exercise the Web Lock contract and storage failure recovery. These are sanitized code-derived fixtures, not captured profiles. No installed-extension/profile smoke test is claimed.

## Documentation Update and next-task requirements

Updated this handoff, Task 13's resolved IndexedDB limitation, Task 12's concrete temporary-bridge inventory and AGENTS architecture/testing facts. Future work must preserve permanent validation, owner serialization, actual adapter flush/read-back, identity/consent/readiness and history coordination. Any metadata re-bucketing or network-scoped metadata destination needs its own explicit policy and tests. Task 15 still needs the missing Query/provider architecture scoped in Tasks 10/13; none is introduced here. Retirement still requires supported-upgrade, shipped-release and rollback decisions from the existing ledger.

## Exact changed files

- `AGENTS.md`
- `docs/task-12-legacy-retirement-ledger.md`
- `docs/task-13-legacy-assets-handoff.md`
- `docs/task-14-indexeddb-assets-handoff.md`
- `package.json`
- `src/app/hooks/use-assets-migrations.ts`
- `src/app/store/owned-assets.middleware.ts`
- `src/lib/assets/indexeddb-migration-owner.test.ts`
- `src/lib/assets/indexeddb-migration-owner.ts`
- `src/lib/assets/indexeddb-migration.test.ts`
- `src/lib/assets/indexeddb-migration.ts`
- `src/lib/assets/migrations.ts`
- `src/lib/local-storage/migrator.test.ts`
- `src/lib/local-storage/migrator.ts`
- `src/lib/store/zustand/__tests__/safe-initialization.test.ts`
- `src/lib/store/zustand/__tests__/ui-owner.test.ts`
- `src/lib/store/zustand/ui-owner.contract.ts`
- `src/lib/store/zustand/ui-owner.ts`
- `yarn.lock`
