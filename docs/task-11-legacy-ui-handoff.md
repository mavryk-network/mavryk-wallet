# Task 11: legacy preferences, analytics identity and root token metadata

## Scope and branch evidence

The local, Git-ignored `arch-adjust/remed-task-11-legacy-ui-preferences-analytics-metadata.md` and expanded Task 10 handoff were read first. They were preserved. The historical Phase 3 / implementation Step 10 assumptions about generated Zustand IDs and independent setter writes are superseded by Task 10's actual null initializer, guarded staging and durable adapters.

Fetch succeeded on 2026-09-10:

| Ref                                               | Starting SHA                               |
| ------------------------------------------------- | ------------------------------------------ |
| HEAD / local and remote `MAV-3974/architecture`   | `9789f42c435181273f039ca595b0bdea1fb69431` |
| Existing `task-11-redem`                          | `bf58b738c7aebc5801a336c4c887b115df6d52ff` |
| Task 10 implementation                            | `8287461aebd154fe470e227f3f671236a62722ff` |
| `origin/dev`                                      | `1cc65ac19a7e3c931def7fc5071d6697ecaee0a9` |
| `origin/pr/30` / `origin/dev-architecture-update` | `523a21a348fcbef3330f64aa2da1c00fecb45a7e` |
| Local reference `dev-architecture-update`         | `50c10e72478c36f5acb0a87b6e1bf8c7efc0fc7c` |

The working tree was clean. Task 11 was absent. Its existing branch had no unique commits and was safely fast-forwarded to the current integration foundation, without resetting or replacing it. Task 10 supplied the destination stores, hydration lifecycle, staged writes and actual adapter flush/read-back. All migration, ownership, identity and readiness behavior described below is new. Exact implementation and local merge commits are reported in the delivery message; no push or merge into `dev` is performed.

## Source precedence and validation

The migration reads the browser legacy root first among legacy sources. Only an absent browser root permits a serialized localStorage fallback. Plain browser objects, JSON string roots and serialized slices are supported. Present null, arrays, malformed JSON, invalid scalar values, unsafe keys or a rejected read stop migration; they never select another source or become a fresh install. A successful missing browser read followed by a successful missing localStorage read establishes a fresh install.

The inspected production `origin/dev` persistence configuration is `serialize: false, deserialize: false`; its root metadata shape is `{ tokensMetadata: { metadataRecord: Record<string, TokenMetadata>, metadataLoading: boolean } }`. Task 10's enum extraction is the only difference in the inspected legacy settings/persistence contracts versus `origin/dev`.

| Legacy field                           | Destination field                        |
| -------------------------------------- | ---------------------------------------- |
| `settings.userId`                      | `ui.userId`, after durable ID precedence |
| `settings.isAnalyticsEnabled`          | `ui.isAnalyticsEnabled`                  |
| `settings.balanceMode`                 | `ui.balanceMode`                         |
| `settings.isOnRampPossibility`         | `ui.isOnRampPossibility`                 |
| `abTesting.groupName`                  | `ui.abTestGroupName`                     |
| `newsletter.shouldShowNewsletterModal` | `ui.shouldShowNewsletterModal`           |
| `notifications.isNewsEnabled`          | `ui.isNewsEnabled`                       |
| `advertising.lastSeenPromotionName`    | `ui.lastSeenPromotionName`               |
| `tokensMetadata.metadataRecord`        | `metadata.tokensMetadata`                |

The full object graph is checked for unsafe keys, including decoded ignored slices. Unsafe keys are rejected rather than silently accepted. No parsed object is spread into a store. Explicit scalar assignments edit validated detached drafts; all drafts pass their real destination schemas before commit. UI strings/enums reuse Task 10 contracts; metadata strings are bounded to 8,192 characters and decimals must be finite, nonnegative safe integers. Predefined metadata fills missing records; valid legacy entries override matching predefined slugs. Existing collectible/RWA destination data is retained but not migrated or activated.

Fiat currency, new privacy fields, server caches, loading/errors, nested assets, adult flags, partner promotion fields and collectible/RWA metadata are outside this migration. The fixture is constructed and sanitized from inspected code shapes, **not captured from a real profile**.

## Identity, consent and startup

Identity precedence is a valid `analytics_user_id`, then legacy `settings.userId`, then an already-persisted Task 10 UI identity. Null/missing IDs mean unadopted; other invalid IDs block migration. A fresh ID is generated only after all required source and destination reads and source validation succeed. UI/default consent stays false when no preference exists. An opted-out source remains opted out.

The old Redux initializer no longer generates an unused ID. `useUserIdSync` is a readiness read; it cannot write `analytics_user_id`. The background owner alone adopts and persists identity, with read-back before completion. Commands cannot change identity or completion state.

`startUIOwner` registers synchronously before wallet initialization awaits. Background analytics is suppressed until the first foreground initialization finishes migration and durable verification. A worker cannot inspect localStorage: when the browser root is absent, the owner explicitly requests fallback from a trusted extension page. That page reads localStorage only then. Missing/unreadable fallback never authorizes background defaults. A failed attempt discards the cached fallback so retry can reread repaired storage.

The app's StoreProvider waits before starting Redux persistence or mounting child startup effects. Errors display a retry gate. Foreground contexts share the background owner through a narrow runtime channel and maintain read-only projections; they do not instantiate competing destination adapters. Content-script/external senders are rejected. Runtime commands and snapshot reads are serialized in the one background context, including concurrent foreground initializations. Preference commands use explicit null for clearing an optional promotion name because JSON messages omit undefined properties. Each foreground also serializes requests and refreshes after destination storage changes. Its single storage listener lasts for that extension-page context; browser teardown releases it.

All analytics entry points remain disabled as in the starting production lineage. Frontend send helpers enforce readiness and consent and substitute the adopted ID for caller-supplied IDs. Background track/page/direct-client entry points independently check owner readiness and consent, including suppression while operations are pending or persistence has failed. Early events are dropped, not queued under temporary defaults. This task does not enable analytics collection.

## Durability and recovery

1. Await `awaitStoresHydrated(uiStore, metadataStore)`; retry only failed hydration through the existing lifecycle.
2. Read durable destination envelopes, identity and required legacy sources; validate all inputs.
3. Prepare both real destination drafts before calling `commitStagedWrites`.
4. Flush both actual adapter instances, read them back and compare expected UI/root metadata values. Comparison accounts for JSON omitting optional `undefined` properties.
5. Write/adopt the durable analytics ID as necessary; await browser `set` completion and independently read it back.
6. Stage `legacyMigrated: true`, flush UI again, independently read back the full expected UI state, then expose readiness.

`legacyMigrated` defaults to false when missing from an existing version-1 UI envelope; no version bump or destructive migration is required. The schema helper types distinguish Zod input and output types so a defaulted completion field remains required in parsed state.

Per-store flush is **not a cross-store transaction**. If one destination succeeds and another fails, accepted data may remain in RAM/on disk, but no consumer or analytics is released. Before completion, retry/reload replays the intact source with idempotent keyed puts. A previously persisted UI ID prevents identity replacement on a fresh-install retry. Failed completion writes are retained by the real adapter and can be retried. If completion was stored but its verification read failed, a later successful durable read can establish readiness; inconsistent completion/metadata/identity fails closed.

After completion, migration never replays legacy data. Every live command is serialized, guarded, flushed and independently checked against durable storage before its snapshot is published. Write failure closes the foreground gate and suppresses analytics; retry drains the retained adapter snapshot. Reload hydrates the last durable state. A command interrupted before its write becomes durable is not acknowledged; no guarantee is claimed for an unacknowledged command. No old source is deleted as compensation for partial persistence.

The concurrency guarantee applies to updated extension contexts using this sole owner. Task 10 factories remain test/migration infrastructure, not authorization for another production writer. Tasks 13+ must extend this owner or explicitly replace its coordination contract before activating more writers.

## Reader/writer handoff

| Domain                                | Readers                                                                     | Writers                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User identity/consent/balance/on-ramp | Existing settings selector API now reads owner snapshot                     | Existing action API intercepted by `ownedUIMiddleware`; old sync cannot write identity                                                                                              |
| AB group                              | AB selector reads owner snapshot                                            | Existing AB epic success action is an owner command                                                                                                                                 |
| Newsletter                            | Newsletter selector reads owner snapshot                                    | Existing modal action is an owner command                                                                                                                                           |
| News preference                       | News selector and notification filtering/counts read owner preference       | News settings action is an owner command                                                                                                                                            |
| Last promotion seen                   | Availability selector combines owner preference with Redux active promotion | Skip action captures current Redux promotion name and sends a scalar command                                                                                                        |
| Root token metadata                   | Token selectors and asset-classification epics read owner snapshot          | Fetched metadata/whitelist/refresh actions build metadata with existing helpers and send owner commands; whitelist preserves existing records and refresh changes media fields only |

Converted actions never reach the old Redux reducers. Those shapes remain as inert historical compatibility data; there is no Redux↔Zustand synchronization loop. The historical Redux version-2 migration still processes its own legacy snapshot, not the live metadata owner. Metadata loading flags/reset actions and existing network loading epics remain on Redux.

To retain `persist:temple-root` verbatim, ongoing unrelated root Redux persistence uses **`persist:temple-root-task11`**, with read-only fallback to the old root on first initialization. The old localStorage copy is also untouched. Nested persistence registrations/keys are unchanged. Existing unrelated domains—including assets/statuses, balances, currency/rates, swap, collectible/RWA metadata/adult flags, notification lists/statuses, active advertising, partner promotion and buy-with-card—remain on Redux. Task 8 timeout/retry and Task 9 quote logic are unchanged.

## Verification

Baseline logs: `/tmp/task-11-baseline/`. Final logs: `/tmp/task-11-final/`. Focused logs: `/tmp/task11-targeted.log`.

- Baseline frozen install and Chrome/Firefox builds passed.
- Baseline full Jest: 44 suites passed / 4 failed; 301 tests passed / 1 failed.
- Baseline `yarn ts`: the same 11 dependency declaration syntax errors in Apollo, Babel traverse types and Lodash types.
- Settled focused run: **16 suites / 107 tests passed**: all 34 Task 10 tests, all seven Task 8–9 suites / 20 tests, and 53 new migration/owner/client/analytics/middleware tests.
- Targeted ESLint: zero errors; remaining warnings concern explicit test casts and the legacy persisted-state type boundary.
- A separate TypeScript compiler-API check of changed files found the unchanged `back/main.ts` `TempleRevealMnemonicRequest.walletId` diagnostic. A compiler host using starting-HEAD source confirms the same diagnostic before this task. No unrelated fix was made.

Final full checks (rerun after the runtime-channel exclusion):

| Check                            | Result                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| `yarn install --frozen-lockfile` | Passed; no dependency changes                                      |
| `yarn ts`                        | Same 11 dependency syntax diagnostics as baseline                  |
| `yarn test --runInBand`          | 49 suites passed / same 4 failed; 354 tests passed / same 1 failed |
| `yarn build`                     | Passed, Chrome archive                                             |
| `yarn build:firefox`             | Passed, Firefox archive                                            |
| `git diff --check`               | Passed                                                             |

The existing background catch-all runtime listener now declines the owner's channel synchronously, preventing its unrelated async response from racing the migration reply. Focused and full verification were rerun after that correction. No installed-extension/manual profile smoke test is claimed.

Known failing full Jest suites: `src/lib/temple/beacon.test.ts`, `src/lib/temple/back/store.test.ts`, `src/lib/utils/amounts/index.test.ts`, `basenet_kyc_onboard.spec.ts`. They remain baseline issues; no changes to these implementations or tests are included.

## Documentation Update and next tasks

Updated `AGENTS.md` and the Task 10 handoff document to distinguish activated UI/root metadata from inactive assets/collectible/RWA/promotion destinations. Commands, package versions, dependencies and toolchain are unchanged. No edits under `src/mavryk/api/**`, legacy deletion, IndexedDB changes/re-registration, or Tasks 12–14 implementation are included.

Task 12 may document future retirement using this concrete owner and preserved root. Task 13 must migrate nested domains through coordinated writers and real durable verification; its destinations are still inactive. Task 14's IndexedDB work remains separate. Tasks 15–20 still require the Query/provider/wallet/background and remaining consumer work listed in the Task 10 document; this scoped owner is not the full reference architecture.

## Exact changed files

- `AGENTS.md`
- `docs/task-10-zustand-foundation.md`
- `docs/task-11-legacy-ui-handoff.md`
- `src/app/hooks/use-user-id-sync.ts`
- `src/app/store/ab-testing/selectors.ts`
- `src/app/store/advertising/selectors.ts`
- `src/app/store/assets/epics.ts`
- `src/app/store/index.ts`
- `src/app/store/newsletter/newsletter-selectors.ts`
- `src/app/store/owned-ui.middleware.test.ts`
- `src/app/store/owned-ui.middleware.ts`
- `src/app/store/provider.tsx`
- `src/app/store/settings/selectors.ts`
- `src/app/store/settings/state.ts`
- `src/app/store/tokens-metadata/selectors.ts`
- `src/lib/analytics/send-events.utils.ts`
- `src/lib/analytics/use-analytics.hook.ts`
- `src/lib/notifications/store/selectors.ts`
- `src/lib/store/zustand/__tests__/analytics-readiness.test.ts`
- `src/lib/store/zustand/__tests__/legacy-ui-migration.test.ts`
- `src/lib/store/zustand/__tests__/safe-initialization.test.ts`
- `src/lib/store/zustand/__tests__/stores.test.ts`
- `src/lib/store/zustand/__tests__/ui-client.test.ts`
- `src/lib/store/zustand/__tests__/ui-owner.test.ts`
- `src/lib/store/zustand/destination-store.ts`
- `src/lib/store/zustand/index.ts`
- `src/lib/store/zustand/legacy-ui-migration.ts`
- `src/lib/store/zustand/legacy-ui-source.ts`
- `src/lib/store/zustand/metadata-state.schema.ts`
- `src/lib/store/zustand/metadata.store.ts`
- `src/lib/store/zustand/test-support/fixtures/legacy-ui-root.json`
- `src/lib/store/zustand/ui-client.ts`
- `src/lib/store/zustand/ui-owner.contract.ts`
- `src/lib/store/zustand/ui-owner.ts`
- `src/lib/store/zustand/ui-preferences.helpers.ts`
- `src/lib/store/zustand/ui-state.schema.ts`
- `src/lib/store/zustand/ui.store.ts`
- `src/lib/store/zustand/validation.ts`
- `src/lib/temple/back/analytics.ts`
- `src/lib/temple/back/main.ts`
