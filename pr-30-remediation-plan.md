# PR #30 Remediation Plan — Keep the New Architecture, Fix the Confirmed Defects

> Branch alignment update, 2026-08-19: `MAV-3974/architecture` is the architecture integration branch. `dev-architecture-update` is only a PR #30 reference branch; any branch-target instructions below that use it as the integration branch are superseded by `docs/pr-30-branch-alignment-dev-sync-ledger.md`.

Date: 2026-08-18 (v2)
**Reviewed**: 2026-08-18 — architect, code-reviewer, and security-reviewer agents, all GO WITH AMENDMENTS; every amendment is incorporated in this version. The reviewers verified all file/line claims below against both this branch and `origin/dev` (prod 2.0.0).
Responds to: `pr-30-architecture-investigation.md` (2026-08-13)
PR: https://github.com/mavryk-network/mavryk-wallet/pull/30
Audience: the investigating dev; executable by Codex without additional context.

## Branch

- Integration branch is `dev-architecture-update` (the PR #30 source branch); final target is `dev`. Per the team's preference, work is **not** delivered as one large PR: each task below gets its own branch off `dev-architecture-update`, its own small PR back into `dev-architecture-update`, its own test gate, and merges one by one — see **Delivery Strategy** below for the merge queue and for how the final landing into `dev` is decomposed.
- **Important:** the investigation reviewed PR head `dad4cc8d4`, which was a stale snapshot. The branch has since been pushed with ~67 additional commits, including the full merge of `origin/dev` v2.0.0 (commit `fe88c2421`). Re-fetch `pull/30/head` before starting.
- Constraint for every phase: **do not touch `src/mavryk/api`**. The team's restructured API layer (`MAV-3943/intercom` / `MAV-3979/book-scoping`) rebases on top of this PR after it merges (default sequencing; flag to the team lead if that should flip).

## Affected Repos

- `mavryk-network/mavryk-wallet` only. No submodules.

## Decision: We Are Keeping This Architecture

This is the headline decision and it is settled:

- **Redux, Redux Observable, Redux Persist, SWR, and Effector are permanently retired.** They are already absent from `package.json` and `src/`. They do not come back. The investigation's recommendation to keep Redux for durable state and expand SWR is **rejected** — that stack no longer exists on this branch, the replacement is complete, type-checked, and passing the full test suite, and re-introducing it would mean unwinding a finished, tested migration.
- **Zustand owns client state** (wallet/session state via intercom sync, UI preferences, user asset statuses, background vault store).
- **TanStack Query owns server state** (fetching, caching, invalidation). Where the two currently blur, Phase 8 fixes ownership — in favor of the new stack, not by reverting.
- **Legacy-data migrations are required, then they die.** Users upgrading from prod 2.0.0 must not lose custom assets, preferences, or their analytics ID — so we ship one-shot migrations that read the old redux-persist payloads **directly as data** (no Redux machinery is ever imported to do it). After they run, migration modules are bridge code with a scheduled deletion (Phase 9), each carrying a `// DELETE IN <version>` marker. Migration code existing is not a door back to Redux.

## Key Design Decisions

1. **One source of truth per domain**, with the ownership table in Phase 8 — the executor does not make ownership calls ad hoc.
2. **Timeouts are bounded and classified by message type.** No request is ever unbounded (`null`): an MV3 service-worker eviction with no timeout means a promise that never settles. User-mediated flows get a timeout of *background auto-decline + grace*, so the background's decline always wins and the user sees a truthful "Declined".
3. **Migrations never destroy before proving durability.** Zustand persistence here is throttled and async (`src/lib/store/zustand/throttled-storage.ts`, 1 s trailing edge) — an in-memory write is not a migration. Legacy sources are cleared only after the migrated data is read back from `browser.storage.local`, and legacy payloads are retained one extra release for rollback (verified safe: none of the legacy keys hold key material, session tokens, or vault data — only preferences, asset statuses, and the analytics ID).
4. **Migrations run only after store hydration.** All target stores rehydrate asynchronously; a migration that runs at mount either reads initializer defaults (misclassifying everything) or gets its writes overwritten by late rehydration. Phase 2 builds the shared gate.
5. **No dependency version advancement, and no ranges in runtime deps.** All work uses the versions currently resolved in `yarn.lock`. `@tanstack/*` versions are frozen — never run any upgrade command against them.

## Sub-Phases

Ordering constraints: Phase 2 → 3 → 4 → 5 is strict (each depends on the previous). Phase 6 must complete before Phase 8. Phases 0, 1, and 7 are independent of everything else and can run in parallel branches.

### Phase 0 — Baseline + exact dependency pins (do this first; it is the highest-value supply-chain item)

Baseline (so later "must be green" gates mean something):

- Yarn v1 (classic) — the lockfile is v1 format. `yarn install`, then record as numbers: `yarn ts` (expect clean), `yarn test` (record suite/test counts), `yarn build` succeeds.

Pins — the rule is **no ranges anywhere in `dependencies`** (~97 entries), not a hand-picked list. `devDependencies` may keep ranges. The packages that matter most are the signing path: the entire `@mavrykdynamics/webmavryk*` family (signer, local-forging, ledger-signer, michel-codec, michelson-encoder, core, rpc, utils, http-utils, tzip12, tzip16), `@mavrykdynamics/mavryk-wallet-dapp`, `@ledgerhq/*`, `webextension-polyfill`, `dexie`. Reference pins as currently resolved: `@tanstack/react-query` 5.90.21, `@tanstack/react-virtual` 3.13.19, `zustand` 5.0.11, `axios` 1.13.5 (also present in `resolutions` — keep both consistent), `react-hook-form` 7.71.2.

Procedure (a naive pin breaks `--frozen-lockfile`, because yarn v1 lockfile entries are keyed by the range specifier):

1. Rewrite specifiers in `package.json` to the exact versions `yarn.lock` currently resolves.
2. Run plain `yarn install` — this re-keys the lockfile entries.
3. Assert nothing actually moved: `git diff yarn.lock | grep -E '^[+-]\s+(version|resolved|integrity)'` must output **nothing** (only entry keys may change).
4. `yarn install --frozen-lockfile` now passes — keep it as the post-check, and confirm `.github/workflows/ci.yml` uses `--frozen-lockfile` (it does).
5. Commit `package.json` + `yarn.lock` together.

### Phase 1 — Classified intercom timeouts + disconnect recovery (fixes confirmed regression risk)

Problem: `src/lib/intercom/client.ts:20` applies a flat `TIMEOUT_MS = 30_000` `Promise.race` to every `request()`. A user still reviewing a confirmation at 30 s gets "Intercom request timed out" while the background approval window is still open. But the timeout is also currently the **only** thing that settles a request whose port died — so it cannot simply be removed.

Facts the fix must respect (all verified):

- Every front→back message funnels through one wrapper: `request<T extends TempleRequest>()` at `src/lib/temple/front/client.ts:13`. There are ~40 typed callers in `src/lib/temple/front/use-mavryk-client.ts` — classification happens **inside the wrapper, keyed by `TempleMessageType`**, not per call site.
- The dApp path also matters: `src/contentScript.ts:101,134,161` sends `TempleMessageType.PageRequest`, which blocks on user confirmation for up to 120 s. It must get the extended classification too. (`src/intercom-client.ts` is a second `IntercomClient` instance with zero callers — dead code; confirm and leave it for Phase 9, do not plumb options through it.)
- There are **two** auto-decline constants: `AUTODECLINE_AFTER = 60_000` at `src/lib/temple/back/actions.ts:77` (in-wallet operations/signs, used at :568 and :626) and `AUTODECLINE_AFTER = 120_000` at `src/lib/temple/back/constants.ts:1` (dApp flows, used at `dapp.ts:595`). The local one shadows the shared one — dedupe into a single exported module both sides import.
- `IntercomClient.buildPort()` (`src/lib/intercom/client.ts:93`) rebuilds the port on disconnect but never rejects in-flight requests, whose listeners were registered on the old port object. After a rebuild, the background's `reqPort === port` identity check (`src/lib/temple/back/actions.ts:531`) can never match again — the confirmation is unconfirmable and the UI never learns.

Changes:

1. `src/lib/intercom/client.ts`:
   - `request(payload, opts?: { timeoutMs?: number })` — always bounded; default `30_000`. Clear the timer on every settle path (`finally`), removing the current leaked-timer behavior at lines 49–54.
   - Track in-flight requests in a `Map<reqId, {reject}>`; in `onDisconnect`, reject them all with a typed `IntercomDisconnectedError` **before** rebuilding the port, and remove their listeners.
2. `src/lib/temple/front/client.ts` — a `REQUEST_TIMEOUTS` table keyed by `TempleMessageType`. **Default-deny: 30 s for everything not on the allowlist.** Allowlist:
   - `OperationsRequest`, `SignRequest` → in-wallet `AUTODECLINE_AFTER` (60 s) + 5 s grace.
   - `DAppPermConfirmationRequest`, `DAppOpsConfirmationRequest`, `DAppSignConfirmationRequest`, and the content-script `PageRequest` path → dApp `AUTODECLINE_AFTER` (120 s) + 5 s grace.
   - `CreateLedgerAccountRequest`, `GetLedgerTezosPkRequest` → 180 s (the one family with **no** background auto-decline; give it a generous explicit bound, never unbounded).
   - Secret-bearing requests are deliberately **excluded** from the allowlist and stay at 30 s — the pending closure retains the secret: `UnlockRequest`, `RevealPrivateKeyRequest`, `RevealMnemonicRequest`, `GenerateSyncPayloadRequest`, `ImportAccountRequest`, `ImportMnemonicAccountRequest`, `ImportFundraiserAccountRequest`, `CreateOrImportWalletRequest`.
   - With this scheme the background's decline always fires first, so users see a truthful "Declined", never a transport error. If 60 s is judged too short for human review of an operation, raise the **background** constant deliberately — that widens the window in which unreviewed op params sit live, so it is a reviewed security decision, not a default.
3. `src/lib/store/zustand/intercom-sync.ts:52` — the module-level `GetStateRequest` only `console.error`s on failure; if it times out during a cold MV3 start, `useWalletSuspense()` deadlocks. Add a bounded retry.
4. Tests (new file — `src/lib/intercom/` currently has none): fake-timer tests for default timeout, allowlisted long timeout, timer cleared on settle, and disconnect rejecting in-flight requests with `IntercomDisconnectedError`. Note `src/lib/temple/front/__tests__/use-mavryk-client.test.ts:28` mocks `lib/temple/front/client` wholesale and will neither break nor validate this change.

### Phase 2 — Shared store-hydration gate (prerequisite for Phases 3–5)

All zustand persistence goes through async `browser.storage.local` adapters (`src/lib/store/zustand/persist-storage.ts`, `throttled-storage.ts`). Two consequences every migration must respect: reads before rehydration see initializer defaults (e.g. `metadataStore` starts as `ALL_PREDEFINED_METADATAS_RECORD` — `metadata.store.ts:73` — so every non-predefined token looks metadata-less); writes before rehydration are silently overwritten when rehydration lands.

Change: add `awaitStoresHydrated(...stores)` in `src/lib/store/zustand/` built on each store's `persist.hasHydrated()` / `onFinishHydration`. Unit-test it with a mocked async storage. Phases 3–5 all gate on it.

### Phase 3 — Migrate `persist:temple-root` + analytics ID into Zustand (fixes confirmed preference reset)

Problem: `src/lib/store/zustand/ui.store.ts:123` persists under a fresh key (`zustand-ui`) and nothing reads the legacy payloads. Upgrading users lose preferences and fork their analytics identity.

Facts (all statically determined — **do not rediscover empirically**; the real-profile check in Verification is confirmation, not discovery):

- Legacy root key: `persist:temple-root`, version 3 — `git show origin/dev:src/app/store/index.ts`.
- Storage backend: `browser.storage.local`, stored as a **plain object** — prod configured `serialize: false, deserialize: false` (`git show origin/dev:src/lib/store/persist.utils.ts`, `src/lib/store/storage.ts`). Slice values are plain objects, **not** JSON strings. There is one exception: prod's own migration helper falls back to `redux-persist/lib/storage` (`localStorage`), where the payload **is** serialized and slice values are JSON strings. Read `browser.storage.local` first; fall back to `localStorage` (with `JSON.parse` per slice) for older installs; handle a string root value defensively in both.
- The root payload **blacklists** `buyWithCreditCard, collectibles, rwas, rwasMetadata, assets, collectiblesMetadata` — those slices live under their own nested keys (Phase 4). Seven legacy keys exist in total: `persist:temple-root`, `persist:root.assets`, `persist:root.collectibles`, `persist:root.rwas`, `persist:root.collectiblesMetadata`, `persist:root.rwasMetadata`, `persist:root.partnersPromotion`.

Field map (verified against `origin/dev` slice shapes — migrate exactly this, nothing else):

| Legacy source (in `persist:temple-root`) | Target |
| --- | --- |
| `settings.userId` | `uiStore.userId` — but see analytics-ID handling below |
| `settings.isAnalyticsEnabled` | `uiStore.isAnalyticsEnabled` |
| `settings.balanceMode` | `uiStore.balanceMode` |
| `settings.isOnRampPossibility` | `uiStore.isOnRampPossibility` |
| `abTesting` group-name field (read exact name from `git show origin/dev:src/app/store/ab-testing/state.ts`) | `uiStore.abTestGroupName` — validate membership in the `ABTestGroup` enum, else `Unknown` |
| `newsletter.shouldShowNewsletterModal` | same name |
| `notifications.isNewsEnabled` | `uiStore.isNewsEnabled` |
| `advertising.lastSeenPromotionName` | same name |
| `tokensMetadata` (persisted in root, **required by Phase 5 for classification**) | `metadataStore` |

Explicitly **not** migrated (do not hunt for these): fiat currency (own storage key `fiat_currency`, `src/lib/fiat-currency/core.ts:14` — unchanged across versions, migrates itself); `privacyMode` (new field, no 2.0.0 ancestor); rates/server data (`currency` slice holds only `usdToTokenRates`/`fiatToTezosRates` — server cache, drop). List any other dropped field in a code comment.

Analytics ID — the real location and a live clobber bug:

- The durable ID is at `browser.storage.local['analytics_user_id']` (`ANALYTICS_USER_ID_STORAGE_KEY`, `src/lib/constants.ts:47`), read by the background at `src/lib/temple/back/main.ts:328`.
- `uiStore` initializes `userId: nanoid()` (`ui.store.ts:78`) and `useUserIdSync` (`src/app/hooks/use-user-id-sync.ts`) pushes store → storage on first effect — the fresh nanoid **overwrites the real ID before any migration can read it**. Fix: seed `uiStore.userId` from `analytics_user_id` (falling back to `persist:temple-root` `settings.userId`) and make `useUserIdSync` bidirectional — adopt the stored ID when the store still holds its generated default. Gate analytics **emission** on migration completion, not merely on the flag — an event fired pre-migration leaks a brand-new identifier under a possibly opted-out user.

Parsing safety (mandatory — this data is local-profile-trust, defense in depth):

- Reject unless `typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)`.
- Never spread or `Object.assign` a parsed object into a store (zustand's `setState` merge would invoke a surviving `__proto__` setter). Read fields with `Object.hasOwn`, strip/ignore `__proto__`/`constructor`/`prototype`, and call the stores' **individual public setters with validated scalars**: booleans via `=== true`, strings length/charset-bounded, numbers via `Number.isFinite`, enums by membership.
- try/catch the whole migration; fail **closed** to defaults — never partially written.

Wiring:

- Runs after `awaitStoresHydrated(uiStore, metadataStore)` (Phase 2), before Phase 4/5 and before first analytics emission. Completion flag `legacyMigrated` must be added to `UIState`, to the `partialize` list (`ui.store.ts:137-152` — manually enumerated), and given an action; flush the persist write durably before treating migration as complete.
- Do **not** delete legacy payloads this release (rollback safety; content verified non-sensitive). Deletion is Phase 9.
- Tests (update `src/lib/store/zustand/__tests__/ui.store.test.ts`, plus a new migration test with a captured-from-prod fixture committed to the repo): field mapping, both storage backends, malformed/`__proto__` payloads fail closed, second run no-op, fresh install no-op.

### Phase 4 — Migrate `persist:root.assets` (+ siblings) — **this is the actual 2.0.0 data-loss fix**

The investigation located the data-loss symptom but not the vector. Verified: prod 2.0.0 already ran the IndexedDB migration (same registered name, see Phase 5), so `Repo.accountTokens` is already empty for 2.0.0 users. Their real asset list and enable/disable statuses live in `browser.storage.local['persist:root.assets']` — the assets slice has its own nested `persistReducer({ key: 'root.assets' })` (`git show origin/dev:src/app/store/assets/reducer.ts:222`) — and **nothing on this branch reads that key**. Without this phase, every 2.0.0 user loses every custom token and status, while `yarn ts`/`yarn test`/CI stay green.

Changes (new module, e.g. `src/lib/store/zustand/legacy-assets-migration.ts`, gated by Phase 2 and sequenced after Phase 3):

- `persist:root.assets` shape: `{ tokens: { data: StoredAssetsRecords, isLoading, error }, collectibles: {...}, rwas: {...}, mainnetWhitelist, mainnetScamlist }`. The record shapes are unchanged between prod and this branch, and the record key helper is byte-identical (`` `${account}@${chainId}` `` — `origin/dev:src/app/store/assets/utils.ts:18` vs `src/lib/store/zustand/assets.store.ts:37`). Map `tokens.data`/`collectibles.data`/`rwas.data` straight into `assetsStore` via `putTokensAsIs`/`putCollectiblesAsIs`/`putRwasAsIs`. Carry each legacy record's own `manual` value — do not hardcode. Drop `isLoading`/`error`/whitelist/scamlist (server data; Phase 8 governs the scam/whitelist).
- `persist:root.collectibles` and `persist:root.rwas` (`whitelist: ['adultFlags']`): migrate `adultFlags` into their current home. This is the explicit-content blur gate — losing it silently un-blurs adult NFTs, a user-safety regression.
- `persist:root.partnersPromotion` → `uiStore.shouldShowPromotion` / `uiStore.promotionHidingTimestamps` (validate timestamps with `Number.isFinite`; they are arithmetic-compared at `ui.store.ts:110`).
- Apply the same parsing-safety rules as Phase 3.
- Durability: `put*AsIs` updates memory synchronously but persistence is throttled (1 s trailing edge) with only an un-awaited `beforeunload` flush. After the puts, read back `assetsStore.getState()` asserting every legacy `(account, chainId, slug)` tuple is present, then flush durably (bypass the throttle via the direct storage `setItem` / a flush helper) and `await browser.storage.local.get('zustand-assets')` asserting the migrated slugs are in the **stored** payload before setting the completion flag. Nothing legacy is deleted in this phase, but the durable read-back is still required — completion must mean "on disk", not "in RAM".
- Note on retries: `putAsIs` is a keyed upsert (`assets.store.ts:148-160`) — no duplication is possible, but a re-run **overwrites** statuses the user changed in between. Acceptable because the completion flag prevents re-runs; keep the flag durable (same rule as Phase 3).
- Tests (new file): fixture of a real 2.0.0 `persist:root.assets` payload; custom tokens + statuses survive; adultFlags survive; idempotency via flag; malformed payload fails closed.

### Phase 5 — IndexedDB migration safety net (pre-2.0.0 installs only)

The existing `migrateFromIndexedDB` (`src/lib/assets/migrations.ts`) has two real defects — `if (!metadata) continue` (line 21) drops records, and `Repo.accountTokens.clear()` (line 45) runs unconditionally — but it is **name-blocked for the 2.0.0 cohort**: it is registered as `assets-migrations@1.18.2` (`src/app/hooks/use-assets-migrations.ts`), prod 2.0.0 ships the identical registration, and applied names persist in `localStorage['MIGRATIONS']` (`src/lib/local-storage/migrator.ts`). It only matters for direct pre-1.18.2 → this-branch upgrades.

Changes:

- Re-register under a new name (`assets-migrations@2.0.1`) so the fixed code actually runs; it is a natural no-op for 2.0.0 users (empty table).
- Gate on `awaitStoresHydrated(metadataStore, assetsStore)` **and** run after Phase 3 (which restores legacy `tokensMetadata`) — that ordering is what makes classification correct; the current "everything looks metadata-less at mount" race is the true root cause of the original bug's breadth.
- For residual records still lacking metadata after hydration: fetch metadata before classifying where possible. If a record must be filed without metadata, default it to `tokens` with `manual: false` (the un-prunable `manual: true` default would be backwards) — and be explicit: **no re-bucketing path exists in the codebase** (nothing ever moves a slug between `tokens`/`collectibles`/`rwas`; verified — the only `put*AsIs` callers are `AddAsset.tsx:227-228` and the migrations). Either add explicit re-bucketing on metadata resolution, or document that a misfiled asset persists until manually re-added. Do not claim "normal metadata flow handles it" — it does not.
- Clear `Repo.accountTokens` only after the same durable read-back procedure as Phase 4. On failure, throw — `src/lib/migrator.ts:16-22` records a migration as applied only after `up()` resolves, so a throw correctly retries next boot (this machinery already works; don't rebuild it). Two caveats to note in code: `useAssetsMigrations` currently calls `void migrate([...])`, swallowing rejections — add a `.catch` with logging; and a throw loses the applied-record of any migration that succeeded earlier in the same array (relevant now that there are several).

### Phase 6 — Reactive detail selectors, without an N+1 (fixes confirmed dead loading states)

Problem, stated precisely: the details queries are **deliberately batched** — one request per account's whole collectible/RWA set, keyed `['collectibles-details', ...slugs]` (`src/lib/collectibles/use-collectibles-details.query.ts:19`), driven from `WithDataLoading` via `src/app/hooks/use-collectibles-details-loading.ts`. The defects are: (a) detail reads use non-reactive `queryClient.getQueriesData()` snapshots; (b) the loading helpers call `getQueryState(['collectibles-details'])` — an **exact**-key lookup for a key that is never written, so they always return `false` (consumers `CollectibleItem.tsx:40`, `RwaItem.tsx:32`, `CollectiblePage/index.tsx:49` never see loading today).

**Do not switch to per-slug `useQuery` with a `queryFn` — that fans one batch request into one HTTP request per grid item.** Correct pattern:

- Keep the single batch query as the only fetcher. Give it a stable key (`tokensKeys.collectiblesDetails(pkh, chainId)` — no slug list embedded), and have it normalize its response into per-slug cache entries: `queryClient.setQueryData(tokensKeys.collectibleDetail(slug), value)` for every slug in the response, **including `null` for misses**.
- `useCollectibleDetails(slug)` / `useRwaDetails(slug)` become reactive reads of the per-slug key with no `queryFn` (`staleTime: Infinity`) — a query observer re-renders on cache writes without ever fetching. (An `enabled: false` observer with `select` on the batch key is an equally valid alternative; pick one and use it for both files.)
- Loading helpers: `useIsFetching({ queryKey: <batch key family> })` — prefix match is the correct semantic for a batch fetch.
- Housekeeping while in these files: consolidate the local `collectiblesKeys`/`rwasKeys` factories into `src/lib/query-keys.ts` (they duplicate `tokensKeys.collectiblesDetails`/`rwasDetails`, violating the centralized-factory rule); fix the `slugs.sort()` caller-array mutation → `[...slugs].sort()`; and resolve the name collision — `useCollectiblesDetailsLoading` exists twice with different meanings (batch driver in `src/app/hooks/use-collectibles-details-loading.ts` vs boolean selector in `src/lib/collectibles/use-collectibles-details.query.ts:87`) — rename the selector.
- Tests (new file): cache write → hook re-render; loading helper true during batch fetch; no fetch triggered by leaf hooks.

### Phase 7 — Block-aware swap quotes (fixes confirmed stale-quote risk)

Problem: `src/lib/swap/use-swap.query.ts` uses `staleTime` (5 min lists at :28/:48, 30 s quotes at :74) with no tie to chain blocks.

Changes:

- Quote/params key: extend `swapKeys.params` in `src/lib/query-keys.ts:51` to include account, chainId, and **all** fields of `Route3SwapParamsRequestRaw` (the current three-field key is a pre-existing cache-collision bug). Keep `swapKeys.allParams` a strict prefix (it is today — `useResetSwapParams` depends on it), and update the disabled-state placeholder `swapKeys.params('','','')` at `use-swap.query.ts:71` consistently — the `queryFn` casts `params as Route3SwapParamsRequest` and relies on `enabled` gating; preserve that guard.
- On each new block: `useOnBlock` (`src/lib/temple/front/chain.ts:44`) → `queryClient.invalidateQueries` for the quote key family. Where block subscription is unavailable, fall back to `refetchInterval` ≈ block time. Token/dex lists keep long `staleTime` — not block-sensitive.
- TanStack v5 semantics trap: `SwapForm.tsx:495-497` gates on `isLoading`, which in v5 is `isPending && isFetching` — **false during a background refetch**, so after a block-triggered invalidation the submit button would stay enabled on a stale quote. Expose `isFetching` from `useSwapParamsData` and disable submit on it.
- Tests (new file): key includes account/chain/params; block event invalidates; submit disabled while `isFetching`.

### Phase 8 — Query cache is the source of truth (fixes the duplicate-cache criticism)

Problem (accepted from the investigation): query functions write results into Zustand stores, making TanStack Query a fetch scheduler in front of a second cache.

The audit is these files — a `--include="*.query.ts"` grep finds nothing; don't use it:

- `src/lib/assets/use-assets-query.ts:31-44, 57-65`
- `src/lib/assets/load-account-assets.ts` (11 store writes)
- `src/lib/metadata/index.ts:165, 177, 187`
- `src/lib/balances/`

Ownership table — these assignments are decided; do not re-derive them:

| Domain | Owner | Rationale / instruction |
| --- | --- | --- |
| Collectible/RWA details | Query cache | Done by Phase 6 |
| Swap data, exchange rates, buy-with-credit-card, notifications | Query cache | Server data, no offline requirement; delete any store mirror |
| **Scamlist / whitelist** | **Zustand `assetsStore`, persisted** | **Security control, must fail closed.** Currently mirrored at `use-assets-query.ts:57-63` and persisted (`assets.store.ts:224-232`). If it moved to the non-persisted query cache, any cold start with a slow/failed fetch renders scam tokens **unlabelled**. Query feeds the store; the stale persisted list is the failure fallback. |
| User asset list + enable/disable statuses | Zustand `assetsStore` | Phases 4–5 write here. **This phase is forbidden from moving the assets domain to query ownership.** |
| Balances | Zustand `balancesStore` (persisted) | One API call returns slugs **and** balances together (`load-account-assets.ts:58,87,116`); splitting the response across two caches would drop offline balance display. Query feeds via one named sync function. |
| Token/collectible/RWA metadata | Zustand `metadataStore` (persisted) | Offline use; query feeds via named sync |

- Where "query feeds the store", it is **one explicit named sync function per domain** — do not grow a generic store-bridge framework, and the query hook must not also be a component read path for that domain.
- Untangle the `useAssetsLoading` feedback loop: the query is gated `enabled: knownChain && !tokensAreLoading` where `tokensAreLoading` is a store flag set by the query's own `queryFn` — replace with TanStack's own dedup/`isFetching`.
- Do this **one domain per commit** (`refactor(balances): …`), tests green after each — this is the largest-blast-radius phase and per-domain commits are what make it revertable.

### Phase 9 — Legacy dead-code retirement (follow-up release, not this PR)

File the ticket **when Phase 3 lands**, so it doesn't rot. After one release cycle confirms clean upgrades:

- Delete the migration modules from Phases 3–5 and their `// DELETE IN <version>` markers.
- One final boot-time cleanup removing all seven legacy keys: `persist:temple-root`, `persist:root.assets`, `persist:root.collectibles`, `persist:root.rwas`, `persist:root.collectiblesMetadata`, `persist:root.rwasMetadata`, `persist:root.partnersPromotion` — plus the `localStorage` fallback copies.
- Delete dead `src/intercom-client.ts` (confirm zero callers first).
- Optional consistency: `balances.store.ts:144` persists under bare key `'balances'` while every other store uses a `zustand-` prefix — align while touching it.
- Sweep with anchored patterns (`\btemple-root\b`, `\bredux\b`, `\beffector\b`, `\bswr\b` — an unanchored `swr` matches unrelated substrings); remaining hits should be historical comments only.

## Delivery Strategy — Incremental Merge Queue

Team preference (accepted): no 600-file merge. Every mergeable unit is a named branch with its own PR, test gate, and independent revert. Two tracks:

### Track A — Remediation phases, merged one by one into `dev-architecture-update`

This is the "list of what needs to be merged". Branch naming: `remediation/<slug>`. Each row: branch off `dev-architecture-update` → implement → its listed test gate + `yarn ts`/`yarn test` vs. baseline → PR into `dev-architecture-update` → merge → next.

| Order | Branch | Contents | Test gate (from Verification) |
| --- | --- | --- | --- |
| A1 | `remediation/dep-pins` | Phase 0 | Lockfile-diff assertion; `--frozen-lockfile` passes |
| A2 | `remediation/intercom-timeouts` | Phase 1 | Steps 3, 4, 8 |
| A3 | `remediation/store-hydration-gate` | Phase 2 | Unit tests |
| A4 | `remediation/legacy-ui-migration` | Phase 3 | Step 2 (prefs + analytics ID) |
| A5 | `remediation/legacy-assets-migration` | Phase 4 | Step 2 (assets + adultFlags), step 7 |
| A6 | `remediation/indexeddb-safety-net` | Phase 5 | Step 7; pre-1.18.2 fixture test |
| A7 | `remediation/reactive-details` | Phase 6 | Component loading states render |
| A8 | `remediation/block-aware-swap` | Phase 7 | Step 5 |
| A9.x | `remediation/ssot-<domain>` (one branch per domain) | Phase 8 | Step 6 for scamlist; per-domain tests |

A1, A2, A8 are order-independent and may run in parallel; A3→A6 are strictly sequential; A7 before A9.

### Track B — Landing into `dev`: peel off what is separable first

Honest constraint first: **the state-stack swap itself is atomic.** Redux/SWR/Effector removal, the Zustand stores, the TanStack Query layer, and their ~hundreds of call-site changes cannot merge into a Redux-based `dev` piecemeal — there is no intermediate state where half the stores exist and the app still builds. What we *can* do is shrink that core by extracting everything that doesn't depend on it into small, independently testable PRs against `dev`, merged first:

| Order | Peel-off PR (branch `landing/<slug>`) | Contents |
| --- | --- | --- |
| B1 | `landing/ci-gate` | `.github/workflows/ci.yml` quality gate (applies to `dev` as-is) |
| B2 | `landing/super-admin-key` | `SUPER_ADMIN_PRIVATE_KEY` de-injection from builds (`.env.dist`, webpack env, signer guards) — `dev` has the same exposure today |
| B3 | `landing/standalone-bugfixes` | Bug fixes from PR #30 with no new-store dependency (tab-jump viewport guard, validator-name truncation, `getDelegatorRewards` catch, and similar — inventory from the PR's Bug Fixes table, one PR each or batched sensibly) |
| B4 | `landing/security-hardening` | Content-script / confirm-window / opParams hardening items not already on `dev` (audit each — some already landed in v2.0.0) |
| B5 | **Core architecture PR** | What remains of PR #30 after B1–B4 and Track A: the irreducible state-stack swap. One PR, but reviewed against a diff that is now hundreds of files smaller, with the remediation fixes already inside it |

Rules for Track B: after each peel-off merges to `dev`, merge `dev` back into `dev-architecture-update` immediately (keeps the core diff shrinking and conflict-free). Cherry-pick, don't re-implement. Each peel-off gets the standard CI gate plus a targeted manual check. If a candidate turns out to depend on the new stores (e.g. anything importing a zustand store or a query hook), it is not separable — leave it in B5 rather than half-porting it.

Sequencing across tracks: Track A completes (on `dev-architecture-update`) before B5; Track B peel-offs can start immediately and run interleaved with Track A.

## Ongoing Sync — Porting `dev` (prod) Changes into the New Architecture

`dev` is the live production branch and keeps moving while this work runs. Everything landing there is written against the old stack (Redux slices/epics, SWR, Effector, `useTempleClient`-era client surface) and must **not** be carried onto this branch as-is — it is ported to the new architecture at merge time. The v2.0.0 merge (`fe88c2421`: JWT auth, `src/mavryk/api`, contacts) is the precedent: intake the logic, re-express the state in the new stack.

Per sync:

1. **Cadence**: merge `origin/dev` into `dev-architecture-update` after every `dev` merge that touches shared code, and at minimum weekly while the merge queue runs. Small frequent merges; always merge, never rebase. Branch `sync/dev-<yyyy-mm-dd>` → PR into `dev-architecture-update`, subject to the same queue rules and test gate as Track A.
2. **Triage every incoming commit** into one of three buckets:
   - **Carry as-is** — no state-layer contact (pure UI, utils, assets, copy, build config): resolve conflicts normally.
   - **Port** — adds or changes anything in the old state stack: a Redux slice/action/epic, redux-persist config, an SWR hook, Effector logic, or old client-hook surface. The old-stack code must not land here (its runtime no longer exists on this branch). Re-implement per the Phase 8 ownership table: server state → a TanStack Query hook keyed through `src/lib/query-keys.ts`; durable client state → the owning Zustand store (updating its `partialize` list if persisted); background state → the vanilla Zustand background store. The feature's tests port with it.
   - **Reserved** — anything under `src/mavryk/api`: take `dev`'s side verbatim (that layer belongs to the team's restructure; this plan never touches it).
3. **Persistence check**: if the `dev` change persists new fields (a new redux-persist slice or whitelisted field), the port must add equivalent Zustand persistence **and**, if the change shipped in a prod release before the core PR merges, extend the Phase 3/4 legacy-migration field maps so upgrading users keep that data too. New persisted fields on `dev` are new migration surface — this is the easiest thing to silently miss.
4. **Porting ledger**: each sync PR's description lists every ported change as `dev commit → new-arch implementation (files)`, and every deliberately dropped change with a reason. Nothing disappears inside conflict resolution — the ledger is what makes a sync auditable.
5. **Gate**: baseline `yarn ts` + `yarn test`, plus a smoke test of each ported feature.

## Response to the Investigation (point by point)

| Investigation finding | Status |
| --- | --- |
| PR would delete `src/mavryk/api` / predates auth+intercom work | **Stale.** True of the old PR head; the pushed branch contains the v2.0.0 merge (JWT auth, `src/mavryk/api`, MVKT 401 fallback, auth-ready gating). Remaining gap vs. the team lineage is the sequencing note under Branch. |
| 30 s global intercom timeout breaks confirmations | **Accepted** → Phase 1 (with the disconnect-recovery work our review found was required to make it safe) |
| Asset migration drops custom assets | **Accepted, and the vector re-diagnosed.** Adversarial review found the flagged IndexedDB migration is name-blocked and its table already empty for 2.0.0 users — the real data lives in `persist:root.assets`, which nothing read. → Phases 4–5 |
| Persisted UI state reset without migration | **Accepted** → Phase 3 |
| `getQueriesData()` non-reactive selectors | **Accepted** → Phase 6 (loading helpers turn out to be dead, not broad; the fix avoids an N+1) |
| Stale swap quotes, no block tie | **Accepted** → Phase 7 |
| Query results mirrored into Zustand (two caches) | **Accepted** → Phase 8, with a security carve-out for the scamlist |
| Broad semver ranges on runtime deps | **Accepted and broadened** → Phase 0 (no ranges in `dependencies` at all; signing-path packages are the priority) |
| Add runtime validation for background operation params | **Already on branch** — `src/lib/temple/back/dryrun.ts` validates every operation kind via Zod discriminated union |
| Keep Redux; use SWR for server state; don't adopt TanStack/Zustand | **Rejected.** The migration is complete, tested, and merged with v2.0.0. We fix ownership within the new stack rather than reverting to a stack that no longer exists on the branch. |
| Don't merge PR #30 wholesale | **Partially accepted.** Delivery is incremental per the team's preference — see Delivery Strategy: separable work peels off into small PRs against `dev` first, remediation lands phase-by-phase, and only the irreducible state-stack core merges as a single (much smaller) reviewed unit, because removing Redux is atomic. Review against the current head, not `dad4cc8d4`. |
| `SUPER_ADMIN_PRIVATE_KEY` exposure | **Already addressed on branch** (key de-listed from `.env.dist`/build injection). Server-side signing for Pro/KYC remains a separate follow-up; the previously exposed key must be rotated regardless. |
| Content-script `evt.origin === window.location.origin` strict check | **Deferred** — evaluate separately with dApp compatibility testing; top-frame guard and `all_frames: false` already present. |

## Deferred Items (explicitly out of scope)

- Any return to Redux/SWR/Effector, in any form, including "temporarily".
- Dependency upgrades of any kind (versions are frozen to `yarn.lock`; Phase 0 pins, never advances).
- Any change under `src/mavryk/api` (reserved for the team's restructure).
- The Temple→Mavryk naming sweep beyond files already touched.
- Content-script origin-check hardening (separate compatibility-tested change).
- Server-side Pro/KYC signing service (separate project; key rotation is operational, not code).
- Raising the background auto-decline windows (explicit security decision if wanted; defaults stay 60 s / 120 s).
- Phase 9 deletion work (next release).

## Verification

Per phase: `yarn ts` and `yarn test` must match or beat the Phase 0 baseline before moving on.

End-to-end before requesting re-review:

1. `yarn ts`, `yarn test`, `yarn build` (Chrome) and `yarn build:firefox` all pass.
2. **Upgrade-path test (the critical one), reproducibly:** build prod from `origin/dev`; load it in a fresh Chrome profile; create a wallet, add a custom (non-predefined) token, disable one default token, set an adult-content flag if available, change a preference, note the analytics user ID. Via devtools, snapshot all `browser.storage.local` keys and `Repo.accountTokens.toArray()`. Load this branch's build over it. Verify: custom token present with correct status; disabled token still disabled; adultFlags intact; preferences intact; analytics ID unchanged; and the migrated data is present in the **stored** `zustand-assets`/`zustand-ui` payloads in `browser.storage.local` (durability, not just UI).
3. **Confirmation-window test:** initiate a send and approve at ~50 s — completes. Initiate a send and wait past 65 s — the background auto-decline fires and the UI shows a clean "Declined", **never** "Intercom request timed out". Repeat via a dApp flow with the 120 s window.
4. **Worker-eviction test (MV3):** kill the service worker (chrome://serviceworker-internals or extensions page) mid-request — the UI surfaces the typed disconnect error and recovers; no permanent spinner.
5. **Swap staleness test:** obtain a quote, wait ≥2 blocks — quote refreshes unprompted; submit is disabled while the refetch is in flight.
6. **Scamlist fail-closed test:** with a populated scamlist, cold-start the extension with network blocked — scam labels still render (from the persisted store).
7. Migration idempotency: reload twice after upgrade — no duplicate assets, flags prevent re-runs.
8. dApp smoke test: connect, permission grant, operation request, sign.

## Commit Strategy

- Delivery follows the **Delivery Strategy merge queue**: one branch + one small PR per task (Track A rows A1–A9.x into `dev-architecture-update`; Track B rows B1–B5 into `dev`), each tested and merged individually.
- Within a task branch: conventional commits (`chore:` Phase 0, `fix:` Phases 1–7, `refactor:` Phase 8), tests in the same commit as the change they cover. Phase 8 stays one branch/PR **per domain**.
- No force-pushes — review history stays intact everywhere.
- Phase 9 is a separate future PR after one clean release cycle.

## Errata — Factual Issues in `pr-30-architecture-investigation.md`

Recorded so the next reader doesn't re-derive conclusions from the investigation that verification overturned. The investigation's method was solid and most of its code criticisms were real (see the Response table) — these are the specific points where it is wrong or materially incomplete, each verified against the repo and against `origin/dev`:

1. **All comparisons ran against a stale PR head.** The inspected head `dad4cc8d4` was the pre-merge backup point; the branch was 67 commits ahead locally (now pushed — head `e7abb5348`). The conclusions built on that snapshot — "PR #30 would delete `src/mavryk/api`", "predates current auth/intercom work", "would regress current Mavryk API/auth behavior, contacts behavior, network storage behavior" — do not hold against the real branch, which already contains the full v2.0.0 merge (`fe88c2421`) with the JWT auth flow, the `src/mavryk/api` layer, MVKT 401 fallback, and auth-ready gating reconciled.
2. **The asset-migration finding identified a real code defect but the wrong vector.** `migrateFromIndexedDB`'s defects are genuine, but the migration is name-blocked for the cohort that matters: it registers as `assets-migrations@1.18.2`, prod 2.0.0 ships the identical registration, and applied names persist in `localStorage['MIGRATIONS']` — so for every 2.0.0 user it never runs, and `Repo.accountTokens` is already empty. The actual data-loss vector — `browser.storage.local['persist:root.assets']`, the nested `persistReducer({ key: 'root.assets' })` payload holding the user's real asset list and enable/disable statuses, which nothing on this branch read — appears nowhere in the investigation. Following its advice ("do not adopt that migration logic as-is") without this plan's Phase 4 would still lose every 2.0.0 user's custom assets.
3. **The persisted-state finding names one legacy key of seven.** Only `temple-root` is cited. The `assets`, `collectibles`, `rwas`, `collectiblesMetadata`, `rwasMetadata`, and `partnersPromotion` slices are blacklisted from the root payload and live under their own `persist:root.*` keys — including the adult-content flags, whose loss would silently un-blur explicit NFTs. It also misses that the analytics ID's durable home is `browser.storage.local['analytics_user_id']`, and that the new `uiStore` clobbers it with a freshly generated `nanoid()` before any migration could read it.
4. **The details-selectors finding misstates the mechanism.** It describes "loading helpers that check broad keys instead of the actual slug-specific query keys". Verified: the helpers do an **exact**-key lookup (`getQueryState(['collectibles-details'])`) on a key that is never written, so they always return `false` — the loading state is dead, not broad. The distinction matters for the fix: the correct replacement is a prefix-scoped `useIsFetching` on the batch key, whereas the "keys are too broad" framing steers toward per-slug queries, which would fan the deliberately batched endpoint into one HTTP request per grid item.
5. **The intercom-timeout finding is right but incomplete in a dangerous direction.** It does not note that the 30 s timeout is currently the *only* thing that settles a request whose port died (MV3 service-worker eviction, port rebuild without rejecting in-flight listeners), nor that two conflicting `AUTODECLINE_AFTER` constants exist (60 s in `back/actions.ts`, 120 s in `back/constants.ts`). Extending or removing the timeout without disconnect rejection converts a bounded failure into a permanent hang — Phase 1 pairs the two changes for that reason.
6. **The "Current Architecture Assessment" describes a different branch and its numbers must not be carried across.** The Redux slice inventory, epics drift, SWR usage, RHF 5.3.1, TS 4.5.5, axios 0.26.1, and the 2026-08-13 `yarn audit` results (52 low / 185 moderate / 256 high / 1 critical) were all measured on the `MAV-3979/book-scoping` lineage. None of it describes this branch, which has none of those packages and resolves TS 5.8.3, axios 1.13.5, RHF 7.71.2. The audit should be re-run against this branch's lockfile before quoting any number.
7. **Smaller factual slips**: the PR's React Hook Form version is cited as 7.51.0 (the branch resolves 7.71.2); the Zod operation-params validation recommended as an adoption candidate already exists on this branch (`src/lib/temple/back/dryrun.ts`, discriminated union per operation kind); and the persona-ad iframe changes flagged as "do not carry forward" are already absent from the current head.

None of this diminishes what the investigation got right: the timeout regression, the persisted-state reset, the non-reactive snapshots, the stale swap quotes, the query/store double-ownership, and the unpinned runtime ranges were all real, and this plan fixes all of them.
