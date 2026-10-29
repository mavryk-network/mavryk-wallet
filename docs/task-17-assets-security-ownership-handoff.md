# Task 17: assets and security ownership

## Refs, scope and reused infrastructure

Started clean on `MAV-3974/architecture` at `f8ae47643f34d5228dc172692f127c49728f1d62`; no Task 17 branch existed. Created `task-17-redem` from that local integration HEAD. The accepted Tasks 10–16 ancestry, installed dependencies and baseline were reused without fetch, reinstall or historical baseline reruns. `dev` remains the eventual production target; PR #30 remains reference only.

Implementation commits:

- `3117e1d2`: durable security adoption, owner commands, Query drivers and security consumers.
- `8a13df88`: scoped asset Query orchestration, consumer loading ports, coupled effects and concurrency protections.
- `8d4d5ff7`: offline security rendering and structural ownership guards.
- `ed0340c5`: update the pre-existing store round-trip assertion for the extended persisted schema.

Final documentation and local merge refs are reported in the delivery message to avoid self-referential hashes. No push or merge into `dev` is performed.

Reused the existing background owner, version-1 `zustand-assets` envelope, asset/status records, metadata owner, destination adapters, flush/read-back, foreground snapshots/commands and one in-memory Query 4.41.0 client per StoreProvider. No new client, persistence adapter, provider tree, production dependency or reference-branch import was introduced. `DetailsQueryProvider` retains its historical name and placement beneath owner readiness and Redux PersistGate.

## Ownership and request map

| Domain                                     | Durable/UI owner                                            | Request orchestration and transport                                                                                |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Token/collectible/RWA records and statuses | Existing background `zustand-assets`, account@chain records | Query drives existing TzKT account token balances, metadata classification and validated wallet RWA assets helpers |
| Scamlist/whitelist                         | Same background asset destination                           | Query drives the existing fixed Madfish GitHub feeds; `syncSecurity` awaits owner acknowledgement                  |
| Asset request loading/errors               | Foreground Query                                            | Receipt-only results; no asset/security response selector or second durable cache                                  |
| Coupled token/collectible/RWA metadata     | Existing background metadata owner                          | `syncAccountAssets` builds existing metadata contracts and awaits the same serialized owner operation              |
| Coupled balances                           | Existing Redux balance owner                                | One scoped `putTokensBalancesAction` after owner acknowledgement and scope validation; no duplicate fetch          |

Keys in `src/lib/query-keys.ts`:

- Assets: `['account-assets', category, account, chainId, networkId]`, with category `tokens`, `collectibles` or `rwas`. Configured API network uses the existing normalized network ID. Different accounts, chains, networks and categories never share request state.
- Security: `['asset-security', 'madfish-mainnet', category]`, category `scamlist` or `whitelist`. These fixed public feeds do not vary by selected wallet/API network.
- Task 9 swap keys and Task 15/16 keys are unchanged.

TzKT still routes by known chain to its fixed endpoint and paginates `/tokens/balances`, separately requesting known FT/NFT and unknown-metadata assets. The existing ten-second unknown-page request coalescing and metadata transport coalescing remain transport optimizations, not UI caches. Classification uses existing `isCollectible`/`isRwa` helpers and owner metadata captured at request start. Missing classification or incomplete/failed metadata batches now reject the asset synchronization instead of reconciling an incomplete list as empty. This conservative failure retains existing assets and retries on the next polling cycle. Non-array account pages reject. Completed results validate slugs/balances before publication.

RWA loading still calls the existing schema-validated `fetchWalletRwaAssets({ walletAddress })` and atomic-balance/metadata mappers. Its storage-selected authentication, refresh and API client behavior are unchanged. Reserved `src/mavryk/api/**` was read for the audit but not edited. The Task 15 RWA detail batch remains a separate existing domain request; this task does not unify its payload with the account-assets batch.

## Gates, refresh, cancellation and consumers

`WithDataLoading` remains under PageRouter's ready-wallet gate; Query remains behind owner/Redux readiness. Asset drivers require owner readiness, a nonempty account/API network and the existing known-chain check. There is no loading flag in `enabled`. Query owns in-flight deduplication and `useIsFetching` supplies current-scope loading.

Asset stale time and background polling are both the existing `ASSETS_SYNC_INTERVAL` (60 seconds); inactive cache time is five minutes. New scopes fetch immediately. Retry, focus and reconnect refetch are disabled. Explicit scoped invalidation refreshes only the requested key. Query owns polling timers and releases observers on teardown. Cross-window transport deduplication is not claimed: windows have separate clients, with publication ordering enforced by the background owner.

Scamlist refresh remains on driver mount. Whitelist remains mainnet-gated and refreshes on entering mainnet. Security stale time is zero, inactive cache time five minutes, with no polling, automatic retry, focus or reconnect request. Errors retry on a later mount/whitelist re-entry or explicit scoped invalidation. Neither feed publishes on transport/validation failure.

Promise transports do not accept abort signals. Drivers consume Query signals and discard cancelled results before publication. The extracted `withScopedWalletRequest` guard checks selected account/network before and after transport and owner acknowledgement and observes account/network/auth-map changes, including A→B→A. Listeners are removed in `finally`. The owner also records a selection revision at request reservation and refuses queued asset results after selection transitions or background restarts. This is publication cancellation, not a claim that underlying HTTP is aborted.

Asset list/manage/listing consumers retain owner-backed record selectors. `useAreAssetsLoading` now reads current-scope Query fetching. There were no additional imperative asset/security request producers beyond the audited hook and startup dispatch. No production caller of the old fetched actions remains. Security selectors read owner snapshots. Tokens retains its existing scam/delegate-tag semantics and existing network applicability; whitelist augmentation remains mainnet-only. The token-list memo now depends on the scamlist snapshot, so label refreshes cannot remain hidden behind an old memo.

## Security adoption, precedence and recovery

New schema-selected fields default safely when reading existing version-1 envelopes:

- `mainnetScamlist: Record<string, boolean> | null` and `mainnetWhitelist: string[] | null`.
- `isSecurityAdopted: false` until this separate handoff is verified.
- `syncRequests`: durable request-ordering IDs, not Query loading/errors or response data.

Task 13's `legacyAssetsMigrated` does not establish security adoption and is never reset/replayed over user records.

The owner runs security adoption after successful Tasks 11/13 initialization, before exposing snapshots/analytics readiness. Existing non-null destination fields win, including a validated destination empty cache. Otherwise the active `persist:temple-root-task11.assets` wins over retained `persist:root.assets`. Browser reads must succeed with absence before requesting that key's serialized foreground-localStorage fallback. The trusted fallback allowlist adds only the active Task 11 root; the six-key Task 13 migration list is unchanged.

Absent sources leave security unknown. Present malformed/null/unsafe source data and rejected reads reject adoption; no fallback is attempted after a failed browser read. All chosen source fields validate before adoption. Old Redux empty defaults have no success provenance, so an empty legacy cache stays **unknown**, rather than proving a completed successful fetch. Nonempty validated legacy caches retain their exact label values. A newer empty active source does not revive older historical labels.

Adoption stages only missing destination security fields, preserving assets, statuses, manual flags, adult flags and existing caches. It flushes the actual asset adapter and independently verifies the full selected destination. Only then does it stage `isSecurityAdopted`, flush again and independently verify completion before readiness. Failed writes/read-back keep readiness closed and retain all sources for retry/restart. Once completed, retained sources are not replayed; already populated destination caches need not read obsolete sources even before completion. Partial durability is not a cross-store transaction and is recovered through the existing retained-write/verification protocol.

`security-persistence.ts` now preserves the active Redux source for compatibility only and resets its transient fields as before; it no longer adopts historical security or supplies UI data. Root prefixes, unrelated fields and persistence registration are unchanged. Old source payloads and serialized copies remain; no source deletion or refresh from owner snapshots is performed.

## Fail-closed behavior and concurrent choices

Cached scam labels survive hydration, offline refresh and transport failure. `null` explicitly means security is unavailable; the token list displays a localized warning instead of treating absence as a successful empty cache. An unreadable destination/source closes the existing startup/retry gate. A validated successful `{}` scam response is an initialized empty list; missing `slugs`, missing whitelist `tokens`, malformed responses and errors reject. Whitelist updates preserve the previous append/dedup semantics, skip the native slug, and seed metadata without overwriting existing metadata. No broad transaction-blocking policy or feature activation was introduced.

Before transport, each request reserves a random ID through the serialized owner and awaits durability. Latest reservations supersede older requests at the same destination: security feed or category/account/chain. Ordering deliberately excludes API network for asset publication, because two API networks sharing a chain must not race over the same existing durable account@chain record. Query keys still distinguish both networks.

`syncAccountAssets` and `syncSecurity` await full owner flush/read-back. Superseded responses are no-ops and become Query cancellations, not successful synchronization. Asset reconciliation uses the owner's current records, preserves manual/non-idle entries and existing statuses, adds missing slugs as idle, and removes only absent automatic idle collectible/RWA records. Token absence retains the existing append behavior. Explicit put/status commands invalidate outstanding publications for that category/account/chain, protecting even a user change back to idle; the next polling cycle reconciles against the updated choices. A successful empty list differs from failure and performs only those established removal rules.

Metadata publication shares the accepted asset/security owner operation, preserving token metadata puts, collectible metadata mapping and whitelist non-overwrite semantics. RWA classification now follows wallet catalog membership with the explicit Basenet wUSDT exception, and the owner repairs token/RWA duplicates while retaining user choices; see [the classification and lifecycle fix](rwa-classification-wallet-lifecycle-fix.md). RWA metadata is not filtered by symbol. Balance publication follows the acknowledged accepted result, with another scope check. Owner failures are exposed through the existing retry gate and Query error state; raw addresses, payloads and arbitrary transport errors are not newly logged.

## Removed fetchers and remaining compatibility

Removed the asset epic module/root registration, all three polling dispatchers, whitelist/scamlist startup dispatchers, all asset/security fetched reducer handlers, the middleware's legacy load-success owner writer, and the whitelist-success metadata epic. Old action exports and Redux state shapes remain inert compatibility contracts. Existing user put/status, unrelated metadata/flags/promotion action-to-command bridges remain live.

Task 18 still owns independent metadata query/refresh ownership; current global-slug metadata limitations are not changed. Task 19 still owns balances: retain the named sync function's scoped Redux balance dispatch until an equivalent durable destination/acknowledgement exists. Retained sources are rollback/upgrade artifacts and become stale; they must not be mirrored from the new owner or deleted without separately authorized retirement.

## Verification

| Check                                    | Result                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Full Jest plus affected-suite rerun      | 76 passing suites / 496 passing tests; same four baseline failing suites and one failing test |
| `yarn ts`                                | Same 11 dependency declaration syntax errors in Apollo, Babel traverse types and Lodash types |
| Whole-project semantic comparison        | 434 before/after, identical counts by file and diagnostic code                                |
| Chrome production build                  | Passed; `chrome.zip` produced                                                                 |
| Firefox production build                 | Passed; `firefox.xpi` produced                                                                |
| Scoped ESLint                            | Zero errors; existing/assertion warnings remain                                               |
| Formatting, links and `git diff --check` | Passed                                                                                        |
| Installed-extension smoke                | Unavailable: no connected browser/app or test profile                                         |

The single full Jest invocation reported **75 passing/five failing suites and 495 passing/two failing tests**. The additional failure was Task 10's exact persisted-asset shape assertion, which omitted the four new schema-selected fields. Updating that expectation restored the suite in its targeted rerun; no production correction or second full Jest/build run was needed. The reconciled totals above combine the full run with that rerun, rather than claiming a single invocation returned them. The unchanged failing suites are `src/lib/temple/beacon.test.ts`, `src/lib/temple/back/store.test.ts`, `src/lib/utils/amounts/index.test.ts` and `basenet_kyc_onboard.spec.ts`.

Logs stay outside the repository: `/tmp/task-17-final-{ts,jest,chrome,firefox,semantic}.log`, `/tmp/task-17-store-contract-rerun.log`, `/tmp/task-17-asset-commit-lint.log` and `/tmp/task-17-semantic-{before,after}.json`. The compiler-host comparison overlays the starting source tree against the same installed dependencies; it does not claim that `yarn ts` passes.

Focused tests use real Query clients/providers, React DOM utilities, real destination adapters and existing memory-storage/owner failure injection. They cover input isolation, deduplication, readiness/mainnet gates, awaiting publication, scoped invalidation, retained data on error, late account/network responses, status/manual edits, ordering across contexts, background restart, successful empty versus failure, coupled effects, source precedence, malformed/rejected reads, failed writes/read-back and retry. Existing Task 13/14/15 contracts are also exercised by full Jest.

Browser inventory returned no connected apps or browsers. No installed-extension profile, wallet transaction or live-endpoint smoke was performed. The automated cold-start test hydrates a real persisted asset store, fails the security transport under a real Query provider and verifies the owner-backed selector still renders the scam label; it separately verifies unknown versus initialized empty presentation. This is automated evidence, not a manual browser pass.

The pre-existing optional `docs/agent-directory-map.local.md` reference in AGENTS is absent in this checkout; all added handoff links resolve.

## Preserved boundaries and Documentation Update

Package version remains **3.0.0**. Package/lockfile pins, reserved APIs, one durable owner, identity/consent/analytics gates, storage prefixes, retained source payloads, `assets-migrations@3.0.0`, older history, Web Locks, Task 14 per-record cleanup, Task 9 quotes/transactions, Task 15 batch/leaf contracts, Task 16 active/dormant endpoints and Task 12's deletion-marker waiver are preserved. Ignored `arch-adjust/` task descriptions remain untouched. Tasks 18–20 and broader Phase 8 ownership are not claimed complete.

Updated AGENTS ownership/testing facts, Task 10's deferred Task 17 entry and Task 12's concrete retirement inventory. Appended only the changed ownership/provider contracts to Tasks 13/14/15/16, preserving their historical evidence. Before release, a non-production installed profile should still verify cached scam labels after blocked transport/cold restart, account/network switching and manual asset changes. No transactions are required.

## Exact changed-file inventory

The following inventory compares the final Task 17 tree with starting integration `f8ae4764`, including this handoff and documentation updates. `D` denotes the removed epic.

```text
M	AGENTS.md
M	docs/task-10-zustand-foundation.md
M	docs/task-12-legacy-retirement-ledger.md
M	docs/task-13-legacy-assets-handoff.md
M	docs/task-14-indexeddb-assets-handoff.md
M	docs/task-15-reactive-details-handoff.md
M	docs/task-16-query-only-server-domains-handoff.md
A	docs/task-17-assets-security-ownership-handoff.md
M	public/_locales/en/messages.json
M	src/app/WithDataLoading.tsx
M	src/app/hooks/use-assets-loading.ts
M	src/app/pages/Home/OtherComponents/Tokens/Tokens.tsx
D	src/app/store/assets/epics.ts
M	src/app/store/assets/reducer.ts
M	src/app/store/assets/security-persistence.test.ts
M	src/app/store/assets/security-persistence.ts
M	src/app/store/assets/selectors.ts
A	src/app/store/assets/utils.test.ts
M	src/app/store/assets/utils.ts
M	src/app/store/owned-assets.middleware.test.ts
M	src/app/store/owned-assets.middleware.ts
M	src/app/store/root-state.epics.ts
M	src/app/store/task13-persistence.test.ts
M	src/app/store/tokens-metadata/epics.ts
M	src/lib/apis/temple/scamlist-tokens.ts
A	src/lib/apis/temple/security-transports.test.ts
M	src/lib/apis/temple/whitelist-tokens.ts
M	src/lib/apis/tzkt/api.ts
A	src/lib/assets/account-assets-sync-key.ts
A	src/lib/assets/load-account-assets.ts
A	src/lib/assets/scoped-wallet-request.ts
A	src/lib/assets/security-cold-start.test.tsx
A	src/lib/assets/sync-security.ts
A	src/lib/assets/task17-ownership.test.ts
A	src/lib/assets/use-assets-query.test.tsx
A	src/lib/assets/use-assets-query.ts
A	src/lib/assets/use-security-query.test.tsx
A	src/lib/assets/use-security-query.ts
M	src/lib/query-keys.ts
M	src/lib/rwas/fetch-scoped-rwa-details.ts
M	src/lib/store/zustand/__tests__/legacy-assets-migration.test.ts
M	src/lib/store/zustand/__tests__/safe-initialization.test.ts
A	src/lib/store/zustand/__tests__/security-migration.test.ts
M	src/lib/store/zustand/__tests__/stores.test.ts
M	src/lib/store/zustand/__tests__/ui-client.test.ts
M	src/lib/store/zustand/__tests__/ui-owner.test.ts
M	src/lib/store/zustand/assets-command.ts
M	src/lib/store/zustand/assets-state.schema.ts
A	src/lib/store/zustand/assets-sync-command.ts
M	src/lib/store/zustand/assets.store.ts
A	src/lib/store/zustand/owner-fallback.ts
A	src/lib/store/zustand/security-migration.ts
A	src/lib/store/zustand/security-state.schema.ts
M	src/lib/store/zustand/ui-client.ts
M	src/lib/store/zustand/ui-owner.contract.ts
M	src/lib/store/zustand/ui-owner.ts
```

## Task 18 metadata resolution

[Task 18](task-18-metadata-ownership-handoff.md) replaces independent metadata epics/direct fetching with shared Query batches and awaited metadata commands. Asset responses reuse shared normalization/application rules and their already-fetched payload; they still publish metadata inside the same acknowledged asset operation. The asset driver supplies RPC provenance for scoped metadata; original Task 17 asset/security Query keys remain unchanged. Owner request reservations capture a metadata revision, so an older asset response cannot replace newer independent metadata or an explicit save. Asset/status protections and the narrow acknowledged Redux balance dispatch remain.

New whitelist metadata seeds use the fixed mainnet provenance bucket, are read only on mainnet, and never overwrite existing records. Historical global whitelist-derived metadata cannot be distinguished from other legacy metadata and remains fallback. Custom-network snapshot changes now invalidate selection guards. Security adoption/unknown-versus-empty semantics and offline scam labels are unchanged. Task 19 still owns the balance handoff; no broader Phase 8 completion is claimed.

## Task 19 balance ownership handoff

Task 19 replaces the narrow `putTokensBalancesAction` dispatch with normalized balances included in the existing `assets-sync` command. No second transport or foreground balance mirror is used. The owner uses the asset reservation’s balance revision and acknowledges only after all four destinations flush/read back. Omitted category slugs do not clear balances. Independent balance fetches/subscriptions use the same owner application policy. Security adoption, unknown/empty caches, labels and asset/status ordering are unchanged. See [Task 19](task-19-balances-ownership-handoff.md) for the current contract and verification.
