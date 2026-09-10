# Task 10: inactive Zustand migration destinations

## Scope and branch evidence

The expanded, Git-ignored `arch-adjust/remed-task-10-store-hydration-gate.md` is the task input. It supersedes the helper-only assumption in implementation-plan Step 9 / remediation Phase 2. No part of Task 10 existed at the starting HEAD. Tasks 8–9 were already implemented on Redux and remain there.

Refs recorded after fetching on 2026-09-10:

| Ref                                                     | Starting SHA                               |
| ------------------------------------------------------- | ------------------------------------------ |
| HEAD / local `MAV-3974/architecture`                    | `bf58b738c7aebc5801a336c4c887b115df6d52ff` |
| `origin/MAV-3974/architecture`                          | `296e9703d3a80ff83394029f9e59b46cea58a1bc` |
| `origin/dev`                                            | `1cc65ac19a7e3c931def7fc5071d6697ecaee0a9` |
| `origin/pr/30` / `origin/dev-architecture-update`       | `523a21a348fcbef3330f64aa2da1c00fecb45a7e` |
| Local `dev-architecture-update` (not used as reference) | `50c10e72478c36f5acb0a87b6e1bf8c7efc0fc7c` |

The working tree was clean. `task-10-redem` did not exist and was created from local `MAV-3974/architecture`. The seven local integration commits ahead of origin were preserved. Fetch succeeded with the required Git metadata permission. No PR #30 merge, push, or merge into `dev` is authorized by this implementation. Exact resulting commit and merge SHAs are reported in the delivery message; embedding a commit's own SHA here would be self-referential.

## Dependency and compatibility

`zustand` is pinned to **5.0.11**, taken from `origin/pr/30:yarn.lock`, not the `^5` manifest range. The only lockfile addition is its entry:

- Tarball: `https://registry.yarnpkg.com/zustand/-/zustand-5.0.11.tgz`
- Tarball SHA: `99f912e590de1ca9ce6c6d1cab6cdb1f034ab494`
- Integrity: `sha512-fdZY+dk7zn/vbWNCYmzZULHRrss0jx5pPFiOuMZ/5HJN6Yv3u+1Wswy/4MpZEkEGhtNH+pwxZB8OKgUBPzYAGg==`

No transitive production dependencies were added or existing resolutions changed. Its React/types peer ranges accept the pinned React 18.2.0 and @types/react 18.0.15. These destinations use `zustand/vanilla` and `zustand/middleware`; they do not require a React mount or Query provider. Focused Jest 27.4.5 / ts-jest 27.1.1 tests compile and execute the new modules with TypeScript 4.5.5. No toolchain, Jest configuration, or scripts changed. Full-project TypeScript remains blocked by the baseline dependency declaration syntax errors.

## Durable contracts

The boundary is `src/lib/store/zustand/index.ts`. Each store exports a singleton and an injectable `create*Store(storage?)` factory. Production code must use one owner/adapter per destination key, not create competing writers. Factories support isolated tests and controlled migration sessions; ordering guarantees do not coordinate independent extension contexts.

All three keys store JSON strings with `{ "version": 1, "state": ... }`. Read-back also accepts a validated plain-object envelope. An absent key means a successful empty hydration; stored null, arrays, malformed JSON, missing required fields, invalid scalar types, and unsupported versions fail hydration. Unknown state fields are excluded by explicit schemas. Envelope extras are rejected. Unsafe keys (`__proto__`, `constructor`, `prototype`) are rejected recursively before parsing/merging, as are non-plain object prototypes and accessors. Parsed values are detached copies. No parsed object is merged directly into Zustand state.

| Key                | Durable state and public actions                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zustand-ui`       | `shouldShowNewsletterModal`, nullable `userId`, `isAnalyticsEnabled`, `balanceMode`, `isOnRampPossibility`, `abTestGroupName`, optional `lastSeenPromotionName`, `shouldShowPromotion`, `promotionHidingTimestamps`, `isNewsEnabled`. Setters: `setShouldShowNewsletterModal`, `setUserId`, `setAnalyticsEnabled`, `setBalanceMode`, `setOnRampPossibility`, `setAbTestGroupName`, `setLastSeenPromotionName`, `setShouldShowPromotion`, `setPromotionHidingTimestamps`, `setIsNewsEnabled`. |
| `zustand-metadata` | Slug-keyed `tokensMetadata`, `collectiblesMetadata`, `rwasMetadata`. `putTokenMetadataDirectly`, `putCollectibleMetadataDirectly`, `putRwaMetadataDirectly` accept `(slug, TokenMetadata)`. No fetched parser or staging-symbol filter.                                                                                                                                                                                                                                                      |
| `zustand-assets`   | Account/chain-keyed `tokens`, `collectibles`, `rwas`. `putTokensAsIs`, `putCollectiblesAsIs`, `putRwasAsIs` accept the existing `AssetToPut[]` contract. Also `collectibleAdultFlags` / `rwaAdultFlags` with `setCollectibleAdultFlags` / `setRwaAdultFlags`.                                                                                                                                                                                                                                |

UI reuses the existing `BalanceMode` and `ABTestGroup` enums, extracted to pure modules with old exports preserved. User IDs accept 1–256 ASCII letters/digits/underscore/hyphen; null is the unadopted initializer. Promotion names are at most 512 characters. Timestamps must be finite. There is no ID generation or `analytics_user_id` write; initial analytics opt-in is false until explicitly adopted. Neither default controls production analytics in Task 10.

Metadata preserves all fields in the existing `TokenMetadata` type. Predefined tokens seed missing records; validated persisted entries override predefined records with the same slug. Public direct puts can replace those entries too. There are no loading/error fields, fetched-data synchronization functions, or new classification rules.

Assets reuse the exact `${account}@${chainId}` key helper, extracted without changing old imports. Each status (`idle`, `enabled`, `disabled`, `removed`) and each optional `manual` value (absent, false, true) survives. Puts are keyed upserts with no pruning. Adult flag records retain each legacy slug's `{ val: boolean, ts: number }`; `ts` is in seconds. The two setters replace their respective entire validated flag records. Migration/consumer ownership remains Task 13.

Actions, loading flags, errors, whitelist/scamlist server data, and other legacy fields are not serialized. Partialization selects only the fields above. Unknown state fields are not a legacy migration or permission to discard legacy source data: Task 10 reads none of those sources.

## Hydration and retry

`awaitStoresHydrated(...stores)` resolves only when every store reports successful Zustand `persist.hasHydrated()`. It uses `persist.onFinishHydration()` plus an error lifecycle, checks again after subscription, and cleans all listeners on completion or rejection. Zero stores, already hydrated stores, concurrent callers, and synchronous subscription races are covered.

Creation starts async reads only. Defaults are not persisted. Public setters and `persistence.prepare` reject before successful hydration. The public boundary intentionally excludes raw `setState`, `setOptions`, `clearStorage`, and unguarded `rehydrate`. Callers must never mutate `getState()` results directly.

Read/JSON/schema/hydration failures remain observable through `hydration.getError()` and reject the gate, including storage rejecting with null/undefined. Repair the cause and call `await store.hydration.retry()`, then await the multi-store gate again. Concurrent retries share an attempt. A retry can start immediately after gate rejection; a previous failing attempt cannot clear or resolve the new attempt. Successful hydration cannot be replayed over subsequent changes. A failure never enables writes to initializer defaults.

## Flush and read-back

Each store's `persistence` methods use its actual adapter instance:

- `flush(): Promise<void>` cancels/bypasses throttling and waits for every accepted write up to the call's sequence to become durable. UI writes start immediately; metadata/assets coalesce behind a 1,000 ms trailing timer.
- `readBack()` reads browser storage, decodes and validates the envelope, and returns `{ version, state }` or null for an absent key. It never returns a pending memory snapshot. Compare the expected values, not just key presence or RAM state.
- `getWriteError()` exposes a failed automatic write. Failure rejects outstanding write/flush promises, retains the newest snapshot, cancels timers, and stops automatic retry. A later explicit `flush()` retries that retained snapshot and clears the error on success. New writes after failure remain queued for that retry.
- `dispose()` blocks further writes, flushes accepted writes, and cleans up timers. Failure is retryable. No DOM/unload listener is installed, and no unawaited unload action is claimed as durable.

`setItem` at the adapter level resolves after the browser write, not after scheduling a timer. Zustand's synchronous setters do not expose that promise; their background rejection observer is backed by retained adapter error state and explicit flush retry. Callers requiring durability must await `persistence.flush()`.

Only one browser write runs at a time for a given adapter. A newer queued snapshot may cover earlier queued snapshots, but it cannot be overwritten by an older in-flight write or stale timer. Flush callers have sequence-specific completion: an earlier flush can resolve once its target is durable while a later flush still awaits a newer write. This is per-adapter ordering, not a browser-wide lock or cross-store transaction.

## Staging and later migration recovery

Use `store.persistence.prepare(recipe)` to build a detached full data draft. The synchronous recipe must be pure except for editing that draft. Schema validation finishes before prepare returns. It does not change store memory, enqueue a timer, or write storage. All destination drafts can therefore be prepared before any commit; a validation failure leaves them unapplied.

`commitStagedWrites(...drafts)` preflights readiness and revisions for every draft, rejects duplicate destinations, then commits them synchronously. A draft is single-use and becomes stale after another public write to that destination. No automatic writes occur while drafts are merely staged. Each public setter uses the same prepare/validate/commit path for its own update.

**This is not cross-store atomicity.** After commit starts, one destination may persist while another fails. Subscriber exceptions, competing contexts, interrupted sessions, or later storage failures require a migration-level protocol. Tasks 11/13 must own writers during cutover, validate all sources before commit, flush and compare expected values for every destination, then separately write/flush/read back their completion state. They must define and test interruption recovery and changes across reloads before activating reads or analytics. No completion flags, legacy parsers, legacy deletion, or IndexedDB migration registration are implemented here.

## Remaining architecture inventory

Task 11 now has the UI/metadata destinations, hydration, staging, durable flush, and read-back prerequisites. It must still implement identity adoption, completion/recovery, migration-before-emission ordering, and the actual UI/metadata ownership handoff. Existing Redux analytics synchronization remains unchanged, including its legacy behavior; this task does not claim to fix that flow.

Tasks 13/14 can use the asset/metadata/UI/adult-flag destinations after Task 11. Nested payload parsing and ownership transfer remain Task 13; IndexedDB registration, fallback classification, and verified source clearing remain Task 14.

The local Tasks 15–20 still assume reference architecture which has not been ported:

| Task | Missing port / decision before implementation                                                                                                                                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15   | TanStack Query dependency/client/provider and collectible/RWA batched detail query modules do not exist. Scope that foundation and consumer port first, preserving batched fetches and reactive leaf reads.                                                                                              |
| 16   | Notifications, rates, buy-with-card, swap lists, advertising and promotion query modules/consumers remain on the current stack. Port ownership per domain. Do not resurrect advertising surfaces deleted in the dev lineage.                                                                             |
| 17   | Account asset query/loader and explicit sync functions are absent. Destination whitelist/scamlist persistence and cold-start security policy must be added in that task; Redux remains authoritative today.                                                                                              |
| 18   | Fetched metadata parsing/refresh/query sync and component read ports remain. Task 10 provides direct built-metadata puts only.                                                                                                                                                                           |
| 19   | Persisted balances destination and query/asset-response sync are absent. Preserve account/network scoping, offline balances, and block updates when porting.                                                                                                                                             |
| 20   | Wallet/background stores, intercom synchronization, Query/provider wiring, `use-mavryk-client`, and remaining consumer conversions still require explicit scoping. Redux/SWR/Effector are still present. Task 8 timeout/retry and Task 9 block-aware quote protections must travel with any future port. |

`src/lib/query-keys.ts` currently provides Task 9's swap keys, not a completed Query architecture. Task 20's old `dev-architecture-update` integration wording is superseded by the branch-alignment ledger: final integration is `MAV-3974/architecture` toward `dev`; PR #30 remains reference only. No missing architecture above was imported in Task 10.

## Documentation Update

Updated `AGENTS.md` for the exact Zustand version and inactive `lib/store/zustand/` boundary. Existing commands and testing configuration are unchanged. This document records the expanded Step 9/Phase 2 foundation and later handoff requirements; neither ignored task descriptions nor historical remediation plans/ledger were overwritten.

## Verification results

Commands ran on the starting integration HEAD and again with the implementation. Baseline logs are in `/tmp/task-10-baseline/`; final logs are in `/tmp/task-10-final/` on the implementation machine.

| Check                            | Before                                                   | Final                                                                                                    |
| -------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `yarn install --frozen-lockfile` | Passed                                                   | Passed; installing the new package required network permission, then frozen installation passed normally |
| `yarn ts`                        | 11 dependency declaration syntax errors                  | Identical 11 diagnostics, compared after removing terminal coloring                                      |
| `yarn test --runInBand`          | 40 passed / 4 failed suites; 267 passed / 1 failed tests | 44 passed / same 4 failed suites; 301 passed / same 1 failed test                                        |
| Four new destination suites      | Absent                                                   | 34 tests passed                                                                                          |
| Seven Task 8–9 suites            | Passed within baseline full run                          | Explicit rerun: 7 suites / 20 tests passed                                                               |
| `yarn build`                     | Passed                                                   | Passed, Chrome archive generated                                                                         |
| `yarn build:firefox`             | Passed                                                   | Passed, Firefox archive generated                                                                        |
| Targeted ESLint                  | Not applicable                                           | Zero errors; intentional invalid-input casts in tests produce warnings                                   |
| Formatting / `git diff --check`  | Clean starting tree                                      | Passed                                                                                                   |

Unchanged failures:

- TypeScript: five syntax diagnostics in `@apollo/client/masking/internal/types.d.ts`, two in `@types/babel__traverse/index.d.ts`, four in `@types/lodash/common/{common,object}.d.ts`.
- `src/lib/temple/beacon.test.ts`: existing `crypto_generichash` argument equality assertion.
- `src/lib/temple/back/store.test.ts`: existing account fixtures missing required account fields.
- `src/lib/utils/amounts/index.test.ts`: unused imports in the existing amounts implementation.
- `basenet_kyc_onboard.spec.ts`: missing test globals/helpers and isolated-module errors.

An intermediate full run overlapped the final flush contract refinement and failed the newly strengthened earlier-flush assertion. The settled implementation passed that test in the focused rerun and the subsequent full rerun. No unrelated failure was modified or suppressed.

Coverage includes controlled async persisted hydration, synchronous subscription races, concurrent callers, listener cleanup, malformed/prototype-pollution envelopes, undefined read rejection, immediate explicit retry, no initializer persistence, enum/scalar validation, metadata/predefined precedence, every status/manual case, both adult flags, partialization, staging failures and stale drafts, actual write completion, timer cancellation, overlapping flushes, retained failures/retry, durable read-back corruption, disposal, and import/consumer isolation. Per-store tests do not establish later migration-level atomicity.

No runtime file under `src/mavryk/api/**` changed, no legacy key is read/written/deleted by the foundation, and no IndexedDB consumer, data, or registration changed. Existing legacy runtime behavior is preserved. The production bundles build successfully; no manual extension-profile upgrade or live browser smoke was performed, since these destinations remain inactive and upgrade migrations belong to later tasks.

## Exact task file inventory

- `AGENTS.md` — dependency and inactive-store guidance; previously Git-ignored, explicitly included to satisfy its same-PR maintenance rule.
- `package.json`
- `yarn.lock`
- `docs/task-10-zustand-foundation.md`
- `src/app/store/settings/balance-mode.enum.ts`
- `src/app/store/settings/state.ts`
- `src/lib/apis/temple/ab-test-group.enum.ts`
- `src/lib/apis/temple/endpoints/get-ab-group.ts`
- `src/lib/assets/account-assets-key.ts`
- `src/app/store/assets/utils.ts`
- `src/lib/store/zustand/index.ts`
- `src/lib/store/zustand/persist-storage.ts`
- `src/lib/store/zustand/throttled-storage.ts`
- `src/lib/store/zustand/validation.ts`
- `src/lib/store/zustand/await-stores-hydrated.ts`
- `src/lib/store/zustand/destination-store.ts`
- `src/lib/store/zustand/ui.store.ts`
- `src/lib/store/zustand/metadata.store.ts`
- `src/lib/store/zustand/assets.store.ts`
- `src/lib/store/zustand/test-support/helpers.ts`
- `src/lib/store/zustand/__tests__/hydration.test.ts`
- `src/lib/store/zustand/__tests__/persistence.test.ts`
- `src/lib/store/zustand/__tests__/stores.test.ts`
- `src/lib/store/zustand/__tests__/safe-initialization.test.ts`
