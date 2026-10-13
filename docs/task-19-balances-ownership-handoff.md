# Task 19: balance ownership

## Refs and scope

Started clean on `MAV-3974/architecture` at `ae1aa4105856e03b39121b6c100408c422caff7a`; created `task-19-redem`. Reused the accepted Tasks 10–18 baseline, installed dependencies, destination infrastructure, background owner, foreground Query provider, transport helpers and migration gates. No baseline rerun, fetch, reinstall or reference-branch import was needed.

Implementation commits:

- `5e7fbd43`: durable balance destination, independent adoption, ordering and owner acknowledgement.
- `e626b271`: shared Query requests, subscriptions, consumer/imperative ports and focused verification.
- `c54cb3a6`: prompt cancellation cleanup for hanging transport and chain-scoped compatibility readers.

Final documentation/local merge refs are in the delivery message to avoid self-referential hashes. No push or merge into `dev`; Task 20/final production integration is not complete.

## Ownership and keys

`zustand-balances` is a version-1 validated destination in the existing background owner. It persists `legacy`, `scoped`, `revision`, `isBalancesAdopted` and an optional acknowledgement receipt. Scoped buckets contain string `data`, per-slug accepted revisions, subscription levels and an optional reorg revision barrier. It never persists loading/errors, Query state or transaction data.

| Path                                                    | Transport/lifecycle                                                             | UI authority                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Native wallet balance                                   | Existing chain-selected TzKT account endpoint, Query `native` request           | Background balance snapshot                                   |
| Complete wallet token balances                          | Existing paginated TzKT token-balance endpoint, Query `tokens` request          | Same owner                                                    |
| Asset-coupled balances                                  | Existing token/collectible/RWA asset payload; normalized once, no extra request | Same owner, within asset command                              |
| Native/token subscription deltas                        | Existing TzKT SignalR channels, serialized receipt-only Query publications      | Same owner                                                    |
| Other-account valuation                                 | Shared native/token Query requests per account                                  | Same owner                                                    |
| Arbitrary-address / explicit custom-RPC `useRawBalance` | Existing RPC contract-standard detection and SWR lifecycle                      | Existing separate SWR result; not adopted into wallet buckets |
| Transaction simulation/estimation/execution             | Existing transaction-specific reads                                             | Unchanged                                                     |

`balancesKeys` in `src/lib/query-keys.ts` uses `['balances', account, chainId, networkId, rpcUrl, category]`. Categories are `native`, `tokens`, `subscription-native`, `subscription-tokens`. Account-wide token requests have no per-item slug inputs and do not create N+1 calls. RPC reads retain their checksum/slug/address SWR key and contract-standard detection.

Durable scope keys serialize `[account, chainId, configuredApiNetwork, rpcUrl]`. Known-chain TzKT transport still uses the fixed endpoint for the captured chain; RPC identifies the wallet source configuration, not a claim that TzKT fetched through that RPC. Explicit RPC overrides always use the separate RPC path, including overrides reporting a known chain. No selected-account requirement blocks valid other-account TzKT requests.

Foregrounds read `ui-client` snapshots and send strict commands only. Query success values are boolean synchronization receipts, not balances. The existing `DetailsQueryProvider` remains the sole in-memory client per foreground. Cross-window HTTP deduplication is not claimed; the background owner orders publication across windows.

## Adoption, precedence and recovery

Inspected current root storage configuration and the pre-asset-rework balance state/reducer at `80a7ea35f^`. Supported roots contain `balances.balancesAtomic[account_chain].data`; historical loading/error fields are ignored. There is no nested balance persistence key. IndexedDB `latestBalance` is not a supported authoritative source.

Precedence:

1. Validated existing balance destination records win on overlapping slugs, including interrupted-adoption restart.
2. Active `persist:temple-root-task11.balances` supplies source data when present, including a valid empty map.
3. If the active root has no balance slice, retained `persist:temple-root.balances` supplies it.
4. For each root, successful browser absence alone permits that root’s serialized localStorage fallback through the trusted owner protocol. A browser rejection never selects fallback.

Both plain browser roots and serialized roots/slices are supported. Present malformed/null roots or slices, invalid numeric strings, unsafe graphs and rejected reads fail adoption. All selected data validates before staging. Sources, storage prefixes and unrelated fields are retained. Redux balance reducers no longer update fetched data; retained root balances are never refreshed from owner snapshots.

After successful balance hydration, adoption stages only string data, flushes the actual adapter and independently compares read-back. Only then is `isBalancesAdopted` staged, flushed and independently verified. Tasks 11/13 completion does not imply this marker and is not replayed. Fresh profiles deliberately create an empty verified destination. Completed profiles skip obsolete sources. Failed hydration/write/read-back closes readiness; retry uses retained adapter writes and intact sources. A cold restart hydrates the last durable state and resumes incomplete adoption with destination precedence.

Legacy data has **unknown API-network/RPC provenance**. It remains account/chain fallback per slug; new exact-scoped records override only matching slugs. An omitted slug in a partial scoped response therefore cannot hide a cached legacy balance. Historical fallback may alias across RPC/API configurations until superseded; no provenance is invented. Explicit custom-RPC reads never use this fallback. New writes cannot overwrite another exact source bucket.

## Values, absence and errors

Balances remain decimal strings with BigNumber conversion at existing presentation boundaries. Valid zero is `'0'`; absence remains `undefined`. No result, successful empty response and failure remain distinguishable through destination bucket/receipt presence and Query request state. Empty/category responses merge without erasing omitted slugs. Even complete token snapshots preserve the existing merge contract; no endpoint omission is interpreted as proof of zero/removal.

Raw TzKT token pages validate tuples and integer balance strings before mapping. Yupana scaling runs once on detached records and retains fractional normalized values, including `0.000000000000000001`. Native spendable balance subtracts staked and unstaked balances using BigNumber. Supported empty/ghost/rollup account variants retain valid zero semantics; missing required native values, unsafe JavaScript integers and negative spendable results reject. Exact numeric strings remain precise; a server number already beyond safe integer precision is rejected rather than silently rounded.

RPC failures and malformed contract views now reject instead of becoming zero. FA2 and FA1.2 view selection is unchanged. Offline transport/publication errors do not clear cached strings, and missing metadata still produces the existing unavailable decimal presentation. Query retains transient errors and request state; owner-storage failures additionally use the existing readiness/retry gate.

## Requests, refresh and cleanup

Native/token requests use 20-second freshness, five-minute inactive cache retention, no automatic retry, no focus refetch and reconnect refetch enabled. Mounted drivers fetch when owner/account/network/RPC/known-chain readiness is satisfied; no Redux loading self-gate or permanent `didRunRef` exists. Each account has its own two batch keys. New accounts/scopes added while another request is active start independently. Removed observers consume cancellation signals and cannot publish late results; underlying Promise transports are not physically aborted.

`syncBalances` reserves an owner revision before transport, validates the response and awaits the owner’s actual flush/read-back acknowledgement. It watches account/network/auth/custom-network storage transitions, including A→B→A, and removes that listener/releases the reservation in `finally`. Other-account requests capture their own address rather than requiring it to be selected. The owner independently rejects reservations across selection changes or background restart.

`refreshBalances` invalidates only matching scope/category keys. Overlapping triggers share an active refresh; if a snapshot was already in flight, one coalesced follow-up runs after settlement. It does not cancel/restart shared transport or invalidate the entire client. There is no polling timer. Block and confirmation refresh use the existing central `NewBlockTriggersProvider`; currently active other-account readers refresh as well.

One `WithDataLoading` balance hook owns the two subscription listeners. Confirmations request scoped recovery, reconnect reattaches listeners, and invoke/publication failures leave block recovery active. Block refresh intentionally remains active even with confirmed subscriptions, avoiding permanent suppression after missed updates/errors. Query deduplicates overlapping snapshot callers; subscription publication itself never launches a snapshot except for recovery. Deltas are queued and are not discarded while snapshots are loading. Cleanup aborts queued publications and removes both listeners; the existing shared connection provider owns socket shutdown and retry-timer cleanup. No unsupported server unsubscribe method is invented; the retained shared hub may still deliver old-address messages, which are filtered by captured account and disposal guards.

## Ordering and coupled durability

The owner issues durable increasing revisions before snapshot/asset transport. Per-slug accepted revisions prevent an older snapshot/foreground from overwriting a newer accepted value. Subscription commands receive a fresh owner revision at publication; supported message block levels reject lower-level ordinary deltas. Reorg commands explicitly permit a lower level and install a scope-wide revision barrier, blocking all pre-reorg snapshot values, including previously absent slugs. Recovery refresh retains visible balances until corrected values arrive. There is no monotonic-balance rule or foreground timestamp ordering.

The REST helpers expose no block-pinned snapshot contract. Ordering guarantees cover owner request/publication order and subscription levels, not proof that a later REST response reflects a particular block. Chain/source transport enhancements remain separate work.

`syncAccountAssets` now requires RPC provenance and sends validated, once-normalized balances in the same `assets-sync` command as the existing asset/metadata payload. The owner checks provenance and asset reservation/status validity, applies the shared balance policy with the reservation’s balance revision, then flushes and reads back all four destinations. A rejected/superseded asset publication cannot bypass the guard to write balances. Existing metadata revisions and explicit-save precedence are preserved.

This is **not cross-store transactional atomicity**. A failure can persist assets/metadata before balances. The command is not acknowledged until all stores pass verification; retry drains retained writes and safely reapplies accepted data. Restart retains independently durable records and rejects old in-memory reservations, requiring a fresh request. No source deletion compensates for a failed write. A later successful owner command, including reservation cleanup, can retry a retained adapter write; Query still reports the original failed publication.

## Consumer and compatibility inventory

- Removed balance epics/root registration and all fetched balance reducer handlers.
- Replaced the account-assets Redux balance bridge with coupled durable publication.
- Current/other-account balance selectors and fiat totals read owner data; existing metadata decimals and Query exchange-rate ownership remain unchanged.
- Current-account `useRawBalance` disables its unused SWR request and joins shared Query requests, including confirmation windows outside `WithDataLoading`. Its refresh callback now performs scoped refresh.
- Home/manage/send/swap/staking/confirmation consumers follow these shared hooks; transaction construction/signing/broadcast/simulation/confirmation logic is unchanged.
- Block/confirmation triggers invalidate balance Query scopes and retain native arbitrary-address SWR/delegate invalidation.
- AddAsset refreshes the scoped Query after acknowledged metadata/asset saves and retains SWR deletion for unconverted RPC readers.
- Balance action/state/key helpers remain compatibility exports. `useAllBalancesSelector` projects legacy records plus matching source-scoped owner data with no second cache.

## Verification

| Check                              | Result                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Full Jest                          | 88 passing / four baseline failing suites; 547 passing / one baseline failing test      |
| Additional cancellation regression | Passed; reconciled total 548 passing tests, same one failing test                       |
| `yarn ts`                          | Same 11 dependency declaration syntax errors in Apollo, Babel traverse and Lodash types |
| Semantic comparison                | 434 before/after, identical counts by file/code                                         |
| Chrome/Firefox production builds   | Both passed, including sequential rebuilds after the cancellation/reader correction     |
| Scoped ESLint                      | Zero errors; existing/assertion warnings remain                                         |
| Installed-extension smoke          | Unavailable; no connected browser/app/profile                                           |

The four unchanged failing suites are `src/lib/temple/beacon.test.ts`, `src/lib/temple/back/store.test.ts`, `src/lib/utils/amounts/index.test.ts` and `basenet_kyc_onboard.spec.ts`. One full Jest invocation produced the first row; the reconciled total includes the subsequently added hanging-transport cancellation test and its affected-suite reruns. No full Jest or `yarn ts` rerun was needed. The compiler-host comparison overlays starting source against the same installed dependencies; it does not claim `yarn ts` passes.

Final review found that non-abortable hanging transports could retain a storage listener/reservation after Query cancellation. A cancellation-aware wait now releases both promptly while observing the late transport promise. The added test passes. Loading/error compatibility selectors also retain their supplied chain input. Only affected tests, semantic diagnostics and sequential production builds were rerun for these source changes.

Logs are outside the repository: `/tmp/task19-final-{ts,jest,chrome,firefox,lint,format}.log`, `/tmp/task19-semantic-{before,after}.{log,json}`, `/tmp/task19-{owner-tests,regression,targeted,owner-ordering,transport-cold,focused-final,hooks,scope-tests,consumer-final,cancel-tests,final-affected}.log`, and `/tmp/task19-cancel-{chrome,firefox,lint}.log`.

Focused tests use real Query clients/providers, React DOM utilities, real destination adapters and owner/storage failure injection. They cover adoption, source precedence/fallback, malformed sources, read/write/read-back failure, restart, zero/missing/precision, offline cold rendering, exact scope isolation, other accounts, request deduplication/additions/cancellation, delayed acknowledgement, retries, subscriptions/reorgs/cleanup, concurrent foreground ordering, coupled partial durability and the disabled current-account SWR path.

Browser inventory returned `apps: []`, `browsers: []`; no usable non-production installed extension profile was available. No manual smoke or wallet transaction was performed.

## Documentation Update and remaining work

Updated AGENTS architecture/testing facts, Task 10’s deferred balance entry and Task 12’s concrete retirement inventory. Appended only changed contracts to Tasks 11/13–18, retaining historical evidence and ignored task descriptions.

Preserved reserved `src/mavryk/api/**`, package version **3.0.0**, toolchain/lockfile/dependency pins, one background authority, Tasks 11/13 identity/consent/recovery, Task 14 verified cleanup, `assets-migrations@3.0.0` and older history/Web Locks, Task 17 security and asset protections, Task 18 metadata provenance/revisions, Task 15 detail ownership, Task 16 endpoint dispositions and Task 9 swap/transaction semantics. No push or merge into `dev`.

Task 20 must retain these ownership boundaries, account for the existing baseline failures and perform installed-profile offline/cold-start, account/network/custom-RPC, other-account totals, reconnect/block and manual-asset smoke checks before production integration. Legacy provenance cannot be reconstructed, REST responses are not block-pinned, cross-window HTTP is not deduplicated, and cross-store durability is not transactional. No broader Redux/SWR/Effector or intercom retirement is claimed.

## Exact changed-file inventory

Compared with starting integration `ae1aa410`; `D` denotes the removed epic.

```text
M	AGENTS.md
M	docs/task-10-zustand-foundation.md
M	docs/task-11-legacy-ui-handoff.md
M	docs/task-12-legacy-retirement-ledger.md
M	docs/task-13-legacy-assets-handoff.md
M	docs/task-14-indexeddb-assets-handoff.md
M	docs/task-15-reactive-details-handoff.md
M	docs/task-16-query-only-server-domains-handoff.md
M	docs/task-17-assets-security-ownership-handoff.md
M	docs/task-18-metadata-ownership-handoff.md
A	docs/task-19-balances-ownership-handoff.md
M	src/app/hooks/use-balances-loading.ts
M	src/app/pages/AddAsset/AddAsset.tsx
D	src/app/store/balances/epics.ts
M	src/app/store/balances/reducers.ts
M	src/app/store/balances/selectors.ts
M	src/app/store/root-state.epics.ts
M	src/lib/apis/tzkt/api.ts
M	src/lib/apis/tzkt/utils.ts
M	src/lib/assets/load-account-assets.ts
M	src/lib/assets/use-assets-query.test.tsx
A	src/lib/balances/balance-query.ts
A	src/lib/balances/cold-start.test.tsx
A	src/lib/balances/fetch.test.ts
M	src/lib/balances/fetch.ts
A	src/lib/balances/hooks.test.tsx
M	src/lib/balances/hooks.ts
A	src/lib/balances/subscriptions.test.tsx
A	src/lib/balances/sync-balances.ts
A	src/lib/balances/use-balances-query.test.tsx
A	src/lib/balances/use-balances-query.ts
M	src/lib/query-keys.ts
A	src/lib/store/zustand/__tests__/balances.test.ts
M	src/lib/store/zustand/__tests__/safe-initialization.test.ts
M	src/lib/store/zustand/__tests__/ui-client.test.ts
M	src/lib/store/zustand/__tests__/ui-owner.test.ts
M	src/lib/store/zustand/assets-sync-command.ts
A	src/lib/store/zustand/balances-command.ts
A	src/lib/store/zustand/balances-migration.ts
A	src/lib/store/zustand/balances-state.schema.ts
A	src/lib/store/zustand/balances.store.ts
M	src/lib/store/zustand/index.ts
M	src/lib/store/zustand/owner-fallback.ts
M	src/lib/store/zustand/ui-client.ts
M	src/lib/store/zustand/ui-owner.contract.ts
M	src/lib/store/zustand/ui-owner.ts
M	src/lib/temple/front/chain.ts
```
