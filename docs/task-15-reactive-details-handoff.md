# Task 15: reactive collectible/RWA details

## Branch evidence and scope

Fetched origin and `pull/30/head` on 2026-10-09. Starting HEAD, local `MAV-3974/architecture` and `origin/MAV-3974/architecture` were `d308148285bb1bbecccdab12b752673146565cdb`. `origin/dev` was `e735af469a85b56fc140999b345989d41afbeadc`; `origin/pr/30` was `523a21a348fcbef3330f64aa2da1c00fecb45a7e`. The tree was clean, no Task 15 branch or equivalent implementation existed, and Task 14 implementation `a95d61f8391e31988556cc55b1db7319a6bd36f5` was already contained in integration. Created `task-15-redem` from that integration HEAD. The committed package version remains **3.0.0**. Implementation and local merge SHAs belong in the delivery report to avoid self-referential hashes.

The integration checkout had Redux detail intervals/selectors, not PR #30’s Query snapshots. This task introduces the narrow missing Query foundation and ports detail consumers. PR #30 was inspected as reference only; its unrelated architecture and reserved API changes were not imported. Existing transports, validation, detail mapping, refresh constants, asset snapshots, adult-flag commands, readiness and persistence gates are reused.

## Approved dependency and provider

The user explicitly approved **`@tanstack/react-query@4.41.0`**, with **`@tanstack/query-core@4.41.0`** and reuse of already locked **`use-sync-external-store@1.6.0`**. The lock diff adds only the two TanStack entries. Existing dependency resolutions, scripts, React 18.2.0, TypeScript 4.5.5 and Jest 27.4.5 remain unchanged. A compiler probe exercised QueryClient, disabled useQuery, useIsFetching and provider declarations with TypeScript 4.5.5 before installation.

PR #30 resolves Query 5.90.21 and uses TypeScript 5.8.3. Its pin cannot be adopted under this task’s toolchain restriction: [v5 requires at least TypeScript 4.7](https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5), while [v4 supports TypeScript 4.1+](https://tanstack.com/query/v4/docs/framework/react/typescript). No Query devtools, persistence plugin or testing dependency is added.

`DetailsQueryProvider` creates one stable QueryClient with lazy React state beneath StoreProvider’s existing owner and Redux PersistGate readiness. Popup, fullpage and confirmation share the App composition; options also uses StoreProvider. Each foreground context has its **own** in-memory client; cross-window request deduplication is not claimed. Teardown clears the cache and cancels requests; child drivers release their timers. Inactive entries have a five-minute cache lifetime. The cache never persists metadata, statuses, flags, preferences or credentials.

## Cache keys and ownership

Central factories are in `src/lib/query-keys.ts`. Existing swap factories and serialization remain unchanged.

| Data            | Key                                                                      |
| --------------- | ------------------------------------------------------------------------ |
| Category batch  | `['asset-details', category, 'batch', account, chainId, networkId]`      |
| Per-slug detail | `['asset-details', category, 'leaf', account, chainId, networkId, slug]` |

`category` is `collectibles` or `rwas`. Configured network ID is normalized using the existing atlasnet/basenet helper. It is included in addition to chain ID because API routing can differ even for configured networks reporting the same chain. Slug lists never appear in batch keys.

`createDetailHooks` shares a driver registry per client/category/scope. The registry contains only registrations and scheduling state; Query owns responses, errors, fetching state and in-flight deduplication. Registration effects coalesce sibling mounts and StrictMode cleanup/setup before transport starts. Cards never register requests. WithDataLoading registers the current account set; each detail page adds its own slug, including direct links outside that account set.

The effective request set is a sorted, deduplicated union copied from registrations. Additions/removals change a revision under the same key and trigger a refresh. A change during an active request schedules a follow-up after settlement, including failure. Results only publish requested slugs still selected at publication; a removed slug cannot be reintroduced by that late response. An empty set cancels the active query, clears the batch result and stops polling. Missing account, chain or network inputs do not register a driver. Removed leaf entries may remain as isolated cached data until their normal cache lifetime expires; asset status ownership remains with the background owner.

## Transport, refresh and isolation

- Collectibles reuse `fetchObjktCollectibles$`, including its existing chunking and gallery-attribute batches, and the unchanged detail mapper. There is no new mainnet-only restriction: the previous integration also called this fixed Objkt endpoint on other selected chains. Cancellation unsubscribes the observable. This does not claim that Apollo aborts every underlying HTTP request.
- RWAs reuse the existing validated `fetchWalletRwaAssets({ walletAddress })` and `walletRwaAssetToDetails`. One wallet-assets endpoint call supplies the batch; there is no per-card request.
- Account-list polling retains five minutes. A mounted detail page joins the same driver with the existing one-minute interval; the smallest registered interval wins. Scheduling waits for settlement before the next poll, avoiding overlapping refreshes. After the faster page leaves, an already scheduled short timer may run once before the five-minute cadence resumes.
- Collectible offers/extra details remain on their existing one-minute SWR request. That separate sell/offer payload is outside the shared detail-record cache and is never requested by grid cards.
- No automatic Query retry/focus/reconnect request is introduced. Failed requests retry at the next interval or set change; existing transport auth/refresh behavior remains intact.

Each request captures its scope. Disposing the last scoped registration cancels the Query request; abort/disposal checks prevent late cache writes and late publication after awaited owner commands. Cached data is never substituted across account, chain or network keys.

The reserved RWA helper selects its API/auth context from browser storage rather than an explicit network argument. `fetchScopedRwaDetails` therefore checks selected account/network before and after the existing helper and observes selection/auth-wallet-map storage events during the request. Any observed transition, including A→B→A, rejects the result as cancellation. Mismatched storage inputs skip transport. The listener is always removed. RWA HTTP itself cannot be aborted through the current helper; late results are discarded. No shared API interceptor, API default or reserved API file was changed. A future explicitly scoped transport parameter can replace this guard in an API-owner task.

## Reactive reads, loading, errors and flags

Leaf observers use `enabled: false`, no query function, infinite stale time and disabled mount/focus/reconnect refetch options. They expose data only, not `refetch`. Invalidation cannot turn them into fetchers. Cache writes and later successful refreshes notify mounted cards/detail pages. All-record sorting hooks subscribe to the batch result with fetching disabled.

- `undefined`: no successful entry loaded for this slug/scope.
- `null`: a successful batch confirmed that a requested slug has no details.
- Request failure: retained as Query error, never converted into null misses. Existing usable data remains visible during refresh failure.

Successful normalized batches await the existing durable `adult-flags` owner command before publishing details. Flags retain the previous second-based timestamp/default/expiry behavior. Owner failures remain observable through the existing owner gate and Query failure; no foreground persistence adapter is created. Library error logging is disabled to prevent raw API payloads from reaching logs; the driver logs only a fixed message. Detail pages show a generic localized error alert.

Boolean loading hooks use prefix-scoped `useIsFetching` for the batch category/account/chain/network. They have distinct names from batch-driver hooks. Initial spinners require both active fetching and absent data, so cached content survives refresh. Success, failure and cancellation settle fetching. RWA detail-page loading now works instead of remaining hardcoded false; its erroneous collectible detail dispatch is removed.

## Redux disposition and consumer inventory

Ported both categories’ grid/list cards, detail pages and all-record sorting hooks. Removed both Redux detail epics and their root registration, plus all production detail action submitters. There is no parallel Redux detail network path or Redux/Query response synchronization.

Legacy detail actions/reducer state shapes remain dormant compatibility contracts; old selector names delegate to Query. Types and the collectible mapper move to their domain folders with compatible exports at old store paths. `owned-assets.middleware.ts` retains its old detail-success/adult-flag branch for compatibility and regression coverage, but production Query fetchers call the owner directly. It still serves unrelated live asset, metadata and promotion producers. Adult selectors continue reading the durable owner.

No general Redux/SWR/Effector retirement, Task 16 work, Phase 8 completion, security-cache change, persistence-prefix change, legacy payload deletion or IndexedDB cleanup is included. Tasks 8–14 timeout/quote behavior, owner hydration/serialization/durable acknowledgement, analytics identity/consent, `assets-migrations@3.0.0`, historical entries and Web Lock coordination remain in place.

## Verification

Baseline logs are in `/tmp/task-15-baseline/`. Initial installed dependencies were incomplete (missing Zustand and fake-indexeddb): the first Jest run had 47 passing/13 failing suites and 299 passing/5 failing tests. Restoring the **existing** lockfile with `yarn install --frozen-lockfile` left Git clean. The usable pre-change baseline then matched Task 14: **56 passing/four failing suites, 432 passing/one failing tests**. TypeScript had the same **11 dependency declaration syntax errors**.

Final results:

| Check                                                                | Result                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Focused Tasks 8–15                                                   | 28 suites / 220 tests passed across the regression run and corrected import-guard rerun                                   |
| Full Jest                                                            | 61 passing / same four failing suites; 467 passing / same one failing test (35 additional passing tests)                  |
| `yarn ts`                                                            | Same 11 dependency syntax diagnostics, compared with the baseline                                                         |
| Whole-project semantic comparison                                    | 434 diagnostics before and after, identical counts per file/code; no new diagnostic file/code pair                        |
| Chrome `yarn build`                                                  | Passed; `chrome.zip` produced                                                                                             |
| `yarn build:firefox`                                                 | Passed; `firefox.xpi` produced                                                                                            |
| Frozen install                                                       | Passed; only the two approved Query lock entries were added                                                               |
| Scoped ESLint                                                        | Zero errors; nine warnings (eight test-boundary assertions and one pre-existing collectible-page hook dependency warning) |
| Source/new-handoff Prettier, documentation links, `git diff --check` | Passed                                                                                                                    |

The unchanged failing suites are `src/lib/temple/beacon.test.ts`, `src/lib/temple/back/store.test.ts`, `src/lib/utils/amounts/index.test.ts`, and `basenet_kyc_onboard.spec.ts`. No baseline failure was suppressed. Semantic comparison compiles starting-HEAD sources through a verified compiler-host overlay against the same installed dependencies. Two diagnostics in untouched EditAccount/ByMnemonicForm files differ only in inferred message rendering; their codes/locations are unchanged. The moved RWA import’s existing SVG declaration diagnostic moved with its line. This supplemental comparison does not claim that the full TypeScript command passes.

The first regression run correctly rejected the new `publish-adult-flags.ts` foreground owner-client caller in the explicit import inventory. The allowlist was extended only for that command client; the no-foreground-adapter assertion remains. Its two tests then passed, and the final full run passed the suite too. Final logs are `/tmp/task-15-final-{ts,jest,chrome,firefox}.log`; focused/lint/format logs use the `/tmp/task-15-` prefix.

Tests use real QueryClient/providers and mounted React DOM hooks; transport and durable owner boundaries are mocked. Coverage includes cache notifications, no leaf fetching even with a client default query function, focus/reconnect/invalidation, shared batches, array immutability, prefix/category/account/chain/network loading isolation, explicit misses versus failure, refresh replacement, changing sets/in-flight changes, cancellation/late responses, empty/incomplete inputs, StrictMode, effective refresh cadence, production batch transport wiring, RWA storage transitions, owner publication and provider readiness/entrypoint wiring.

Browser/app inventory returned no connected surfaces. No installed-extension/profile or live-backend UI smoke test has been performed. Production build results alone do not establish grid/list/detail-page behavior in an installed wallet. Next validation should exercise those views with a populated test profile, including account/network switching and offline refresh.

## Documentation Update

Updated AGENTS dependency/ownership/testing facts, resolved Task 10’s deferred detail foundation and Task 14’s Task 15 limitation, and extended Task 12’s concrete compatibility inventory. Their historical records and ignored `arch-adjust/` descriptions remain intact. Future Phase 8 ports must preserve this batch/leaf split and durable owner boundaries; replacing legacy action contracts requires a fresh producer inventory.

## Exact changed files

- `AGENTS.md`
- `docs/task-10-zustand-foundation.md`
- `docs/task-12-legacy-retirement-ledger.md`
- `docs/task-14-indexeddb-assets-handoff.md`
- `docs/task-15-reactive-details-handoff.md`
- `package.json`
- `src/app/WithDataLoading.tsx`
- `src/app/hooks/use-collectibles-details-loading.ts`
- `src/app/hooks/use-rwa-details-loading.ts`
- `src/app/pages/Collectibles/CollectiblePage/index.tsx`
- `src/app/pages/Collectibles/CollectiblesTab/CollectibleItem.tsx`
- `src/app/pages/Collectibles/hooks/use-collectible-sorted.hook.tsx`
- `src/app/pages/RWAs/RWAPage/index.tsx`
- `src/app/pages/RWAs/RWATab/RwaItem.tsx`
- `src/app/pages/RWAs/hooks/use-rwa-sorted.hook.tsx`
- `src/app/store/collectibles/epics.ts`
- `src/app/store/collectibles/reducer.ts`
- `src/app/store/collectibles/selectors.ts`
- `src/app/store/collectibles/state.ts`
- `src/app/store/collectibles/utils.ts`
- `src/app/store/provider.test.tsx`
- `src/app/store/provider.tsx`
- `src/app/store/root-state.epics.ts`
- `src/app/store/rwas/epics.ts`
- `src/app/store/rwas/reducer.ts`
- `src/app/store/rwas/selectors.ts`
- `src/app/store/rwas/state.ts`
- `src/lib/asset-details/create-detail-hooks.ts`
- `src/lib/asset-details/details.test.tsx`
- `src/lib/asset-details/details.types.ts`
- `src/lib/asset-details/publish-adult-flags.ts`
- `src/lib/asset-details/query-provider.test.tsx`
- `src/lib/asset-details/query-provider.tsx`
- `src/lib/asset-details/transport-integration.test.tsx`
- `src/lib/asset-details/use-detail-scope.ts`
- `src/lib/collectibles/details.helpers.ts`
- `src/lib/collectibles/details.types.ts`
- `src/lib/collectibles/use-collectibles-details.query.ts`
- `src/lib/query-keys.test.ts`
- `src/lib/query-keys.ts`
- `src/lib/rwas/details.types.ts`
- `src/lib/rwas/fetch-scoped-rwa-details.test.ts`
- `src/lib/rwas/fetch-scoped-rwa-details.ts`
- `src/lib/rwas/use-rwas-details.query.ts`
- `src/lib/store/zustand/__tests__/safe-initialization.test.ts`
- `yarn.lock`

## Task 16 shared-provider extension

[Task 16](task-16-query-only-server-domains-handoff.md) reuses `DetailsQueryProvider` unchanged for additional server domains. Its historical name is retained; the client is now shared with rates, card-provider data and dormant server-domain readers. No extra client, persistence adapter, provider gate, detail key or batch/leaf behavior was introduced. Detail ownership and all Task 15 protections above remain unchanged.

## Task 17 shared-provider extension

[Task 17](task-17-assets-security-ownership-handoff.md) reuses the existing foreground Query client for asset/security request lifecycle; durable responses stay owner-read. Detail keys, batches, disabled leaves, polling and null/error semantics are unchanged. The existing RWA selection guard is extracted into `lib/assets/scoped-wallet-request.ts` and reused around asset loading/publication. It still observes account/network/auth-map transitions, including A→B→A, without modifying reserved transports. The existing RWA detail and account-assets batches remain separate domain requests; this task does not unify their payload caches.

## Task 18 shared-provider extension

[Task 18](task-18-metadata-ownership-handoff.md) reuses this Query client for receipt-only metadata requests and provisional AddAsset previews. Metadata-owned UI fields remain owner-read; fetched collectible/RWA detail records, leaf/batch ownership, keys and fallback precedence remain here. The shared storage selection guard additionally observes custom-network snapshot changes, rejecting requests spanning a custom-RPC edit. No new provider or persistence adapter is added.

## Task 19 balance ownership handoff

Task 19 reuses the sole foreground Query client for balance request receipts. Details batching/leaf reads, gates, keys and lifetimes are unchanged. Durable balance UI reads the background owner; no Query persistence or additional provider was introduced. See [Task 19](task-19-balances-ownership-handoff.md) for the current contract and verification.
