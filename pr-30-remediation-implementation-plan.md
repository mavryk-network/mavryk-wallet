# PR #30 Remediation Implementation Plan

Date: 2026-08-18
Last validated: 2026-08-19

Source of truth: root `pr-30-remediation-plan.md`, verified against PR #30 / `origin/dev-architecture-update`.

Compared refs:

- Active planning branch: `MAV-3979/book-scoping` at `c8bb574a`
- Current `origin/dev`: `80379e38` (`v2.0.7`)
- Live PR #30 head: `origin/pr/30` / `origin/dev-architecture-update` at `523a21a3`
- Original stale investigation head: `dad4cc8d4`

Validation note: GitHub still reports PR #30 as open and conflicting. The PR head remains `523a21a3`; the current `dev` branch target is `80379e38`.

## Executive Decision

The remediation plan overrides the older architecture investigation and the existing `arch-adjust` task assumptions.

The new architecture from PR #30 is kept:

- Redux, Redux Observable, Redux Persist, SWR, and Effector stay retired on `dev-architecture-update`.
- Zustand owns durable/client wallet state.
- TanStack Query owns server cache state.
- Legacy Redux/SWR/Effector must not be reintroduced, even temporarily.
- Legacy migration code is one-shot bridge code only and must carry deletion markers for a later release.

Implementation must not happen directly on `MAV-3979/book-scoping`. That branch is useful for comparison and planning, but it still has the old Redux/SWR/Effector stack and current `src/mavryk/api`/contacts work. Track A remediation branches start from `dev-architecture-update`; Track B peel-off branches start from `dev`.

Global constraint from the remediation plan: do not touch `src/mavryk/api` during remediation phases. Current branch/API lineage must be preserved or ported through explicit sync work, never overwritten by a broad PR #30 merge.

## PR #30 Disposition

Keep from PR #30:

- Core state-stack replacement: `src/app/store/**` removal, `src/lib/store/zustand/**`, `src/lib/query-keys.ts`, TanStack Query provider/client, and Zustand wallet/UI/assets/balances/metadata/background stores.
- `useTempleClient` replacement direction: action-only `useMavrykClient` plus narrow state selectors.
- Vanilla Zustand background vault store replacement.
- WebMavryk/Taquito migration already present on PR #30, limited to files touched by the PR.
- CI quality gate as a Track B peel-off.
- Super-admin private-key de-injection from builds as a Track B peel-off.
- Zod operation-param validation as a Track B security peel-off for `dev`; it is already present on PR #30.
- Standalone bug fixes that do not depend on the new state stack.
- PR UI/product features unless they conflict with remediation: privacy mode, full address display, receive-page cleanup, comma-formatted amount inputs, testing build variant, lazy images, and virtualized token/manage-asset lists.

Change before landing:

- Runtime dependency ranges in PR #30 must become exact pins from the current `yarn.lock`; no version advancement.
- The flat 30 s intercom timeout must become classified timeouts with disconnect rejection and bounded cold-start retry.
- Legacy UI/preferences/analytics, token/collectible/RWA metadata, and assets/adult-flags/partner-promotion data must migrate from old redux-persist payloads after Zustand hydration and only after durable write verification.
- The IndexedDB asset migration must be re-registered and fixed as a pre-2.0.0 safety net.
- Non-reactive detail selectors must become reactive without turning batch detail requests into per-item HTTP requests.
- Swap quote keys must include all request inputs and refresh on new blocks; submit must disable during background refetch.
- Query/store duplicate ownership must be resolved per the remediation ownership table.

Reject or defer:

- Do not revive Redux/SWR/Effector.
- Do not follow old `arch-adjust` instructions that say "do not add Zustand/TanStack Query."
- Do not adopt PR #30's strict `evt.origin === window.location.origin` content-script check in this remediation; the plan defers it for dApp compatibility testing.
- Do not land dependency upgrades beyond what is already resolved in the PR branch lockfile.
- Do not implement server-side Pro/KYC signing here; only de-inject the key from frontend builds and leave server-side signing/key rotation as separate work.
- Do not do Phase 9 deletion in this PR.

Already present on the active branch/current `dev`:

- Current `src/mavryk/api` and contacts/auth/intercom lineage, including files under `src/mavryk/api/**`, `src/lib/temple/front/address-book.ts`, `src/lib/temple/front/contacts-settings.ts`, and `src/lib/temple/front/use-contacts-sync.hook.ts`.
- A top-frame wrapper in `src/contentScript.ts`, though not all PR #30 manifest/CSP hardening is present.
- The old architecture investigation document. The root copy is currently uncommitted; `docs/pr-30-architecture-investigation.md` is tracked.

Missing from the active branch/current `dev`:

- New Zustand/TanStack architecture.
- Track A remediation phases 0-8.
- CI quality gate.
- Super-admin key de-injection from production frontend builds.
- Background operation-param Zod validation.
- Most PR #30 standalone bug fixes and product/UI changes.

## Existing `arch-adjust` Task Disposition

No existing `arch-adjust/*.md` task is valid as-is for Track A remediation. The folder was created from the older investigation, and the common constraint "do not add Zustand/TanStack Query" conflicts with the remediation plan.

| Existing task                                         | Disposition                                                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `01-split-wallet-actions-from-state-selectors.md`     | Replace with final core architecture PR/B5. PR #30 already implements the direction using the new stack.                      |
| `02-add-zod-validation-for-operation-params.md`       | Remove for Track A; keep only as Track B security peel-off against `dev` if still missing.                                    |
| `03-resolve-notifications-dead-loader.md`             | Rewrite as Phase 8 notification query ownership on the new stack.                                                             |
| `04-extract-advertising-and-promotion-loading.md`     | Split: persisted partner-promotion choices go to Phase 4 migration; API/cache ownership goes to Phase 8.                      |
| `05-extract-swap-token-dex-loading.md`                | Rewrite as Phase 7 quote freshness plus Phase 8 swap server-cache ownership.                                                  |
| `06-extract-exchange-rates-from-redux.md`             | Rewrite as Phase 8 TanStack Query ownership, not SWR/Redux cleanup.                                                           |
| `07-extract-buy-with-credit-card-server-state.md`     | Rewrite as Phase 8 TanStack Query ownership.                                                                                  |
| `08-remove-dead-root-contexts-and-hooks.md`           | Defer as future provider cleanup after remediation; revalidate against the new stack first.                                   |
| `09-remove-inactive-shortcut-account-provider.md`     | Defer as future provider cleanup after remediation.                                                                           |
| `10-localize-tzkt-connection-provider.md`             | Defer; new branch uses `mvkt`/new balances flow, so revalidate after core landing.                                            |
| `11-localize-new-block-triggers.md`                   | Defer except where Phase 7 needs `useOnBlock` for swap quote invalidation.                                                    |
| `12-remove-unused-vulnerable-runtime-dependencies.md` | Replace with Phase 0 exact runtime pins. Dead-dep cleanup can be separate later.                                              |
| `13-upgrade-axios-and-remove-fetch-adapter.md`        | Remove/replace with Phase 0. Axios is already resolved on PR #30; pin, do not upgrade.                                        |
| `14-replace-use-force-update-dependency.md`           | Defer as dead-dependency cleanup if still applicable after core landing.                                                      |
| `15-replace-effector-background-store.md`             | Remove as written. Effector is already retired on PR #30 via Zustand background store.                                        |
| `16-harden-content-script-origin-boundary.md`         | Defer strict origin work; keep only compatible hardening in Track B security audit.                                           |
| `17-harden-super-admin-signing-boundary.md`           | Replace with Track B `landing/super-admin-key`; server-side signing remains separate.                                         |
| `18-add-large-list-virtualization-pilot.md`           | Replace with PR #30 virtualization verification and exact pinning; no new performance pilot needed unless regressions appear. |
| `19-scope-settings-file-transfer-provider.md`         | Defer as future provider cleanup after remediation.                                                                           |
| `20-split-ready-temple-provider-side-effects.md`      | Defer/rewrite after the new wallet selector/store surface lands.                                                              |
| `21-extract-collectible-rwa-details-server-state.md`  | Replace with Phase 6 reactive batch-detail cache plan.                                                                        |
| `22-extract-token-metadata-server-state.md`           | Rewrite as Phase 8 persisted `metadataStore` ownership fed by Query; legacy token metadata migrates in Step 10.               |
| `23-extract-collectible-rwa-metadata-server-state.md` | Rewrite as Phase 8 persisted `metadataStore` ownership fed by Query; legacy nested collectible/RWA metadata migrates in Step 12. |
| `24-extract-balances-server-state.md`                 | Rewrite as Phase 8 persisted `balancesStore` ownership fed by Query.                                                          |
| `25-separate-custom-assets-from-api-asset-state.md`   | Replace with Phases 4 and 5; the real 2.0.0 vector is `persist:root.assets` and sibling keys.                                 |

## Ordered Implementation Queue

### Step 0. Branch Alignment And Dev Sync Ledger

- What needs to change: Before starting remediation branches, create a sync branch from `dev-architecture-update` and reconcile the latest `origin/dev`/active-branch lineage. Triage incoming changes as carry-as-is, port-to-new-stack, or reserved. For `src/mavryk/api`, take the current/dev side verbatim or leave it for the team rebase per lead decision; do not edit it as remediation.
- Why it needs to change: PR #30 head is still behind current `origin/dev`/active branch for important API/auth/contacts files. A direct merge would overwrite or delete current `src/mavryk/api` work.
- Relevant files/modules: `src/mavryk/api/**`, `src/lib/temple/front/address-book.ts`, `src/lib/temple/front/contacts-settings.ts`, `src/lib/temple/front/use-contacts-sync.hook.ts`, `src/lib/temple/back/**`, conflict files from `git merge origin/dev`.
- Source: Remediation plan Ongoing Sync plus current architecture cleanup comparison.
- Dependencies: None. This is a prerequisite guard before any branch work.
- How to verify/test: Produce a porting ledger in the sync PR description; run `yarn ts` and `yarn test`; smoke test each ported feature. Check `git diff --name-status` for `src/mavryk/api/**` and confirm no remediation edits exist there.
- Existing `arch-adjust` mapping: Missing from `arch-adjust`; add as a new sync/task concept.

### Step 1. Landing CI Gate

- What needs to change: Cherry-pick or recreate the PR #30 CI workflow against `dev`.
- Why it needs to change: Later peel-offs and the final architecture PR need a blocking type/test gate before merge.
- Relevant files/modules: `.github/workflows/ci.yml`; verify any workflow interaction with `.github/workflows/deploy.yml`.
- Source: PR #30 and remediation Track B1.
- Dependencies: Step 0 awareness only; can run independently of Track A.
- How to verify/test: Locally run `yarn install --frozen-lockfile`, `yarn ts`, and `yarn test`; confirm the workflow targets PRs to `dev` and `dev-architecture-update` and uses `--frozen-lockfile`.
- Existing `arch-adjust` mapping: No existing task.

### Step 2. Landing Super-Admin Key De-Injection

- What needs to change: Remove `SUPER_ADMIN_PRIVATE_KEY` from required/public build env injection, keep it out of `.env.dist`, and add production/testnet guards around the existing Pro/KYC signing path. Do not move signing server-side in this task.
- Why it needs to change: Current `dev`/active branch still exposes the key through `.env.dist`, `src/lib/env.ts`, and the frontend signer helper. PR #30 partially addresses this and the remediation plan keeps it as a peel-off.
- Relevant files/modules: `.env.dist`, webpack dotenv/env injection files, `src/lib/env.ts`, current `src/app/pages/ProVersion/utils/tezosSigner.ts`, PR rename target `src/app/pages/ProVersion/utils/mavrykSigner.ts`, `src/app/pages/ProVersion/ProVersion.tsx`, `src/app/pages/ProVersion/VerificationForm/VerificationForm.tsx`.
- Source: PR #30, remediation Track B2, current architecture cleanup.
- Dependencies: Step 1 preferred so CI checks the branch.
- How to verify/test: `yarn ts`; production `yarn build`; inspect generated output for `SUPER_ADMIN_PRIVATE_KEY` and absence of actual secret literals; manually verify non-production testnet path fails loudly when the optional key is absent.
- Existing `arch-adjust` mapping: Replaces `17-harden-super-admin-signing-boundary.md` for Track B only.

### Step 3. Landing Standalone Bug-Fix Peel-Offs

- What needs to change: Cherry-pick PR #30 bug fixes that do not import Zustand/TanStack Query or depend on the new store shape. Split into one PR each if a fix has meaningful risk; otherwise batch small independent UI fixes.
- Why it needs to change: These shrink the eventual core PR and deliver fixes to `dev` without waiting for the atomic state-stack swap.
- Relevant files/modules: Known candidates include `src/app/pages/Home/ContentSection.tsx` for tab-jump guard, `src/app/templates/BakerBanner.tsx` for validator truncation, `src/app/pages/Home/OtherComponents/BakingSection.tsx` and `src/app/pages/Stake/hooks/use-baking-history.tsx` for `getDelegatorRewards` catches, plus other PR #30 bug-table items after dependency audit.
- Source: PR #30 bug-fix table and remediation Track B3.
- Dependencies: Step 1 preferred; Step 2 independent.
- How to verify/test: For every candidate, prove it has no new-store dependency before cherry-picking. Run `yarn ts`, relevant Jest tests if present, and the specific manual check from the PR bug table.
- Existing `arch-adjust` mapping: No direct task; related only to current cleanup goals.

### Step 4. Landing Security-Hardening Peel-Offs

- What needs to change: Port PR #30 security hardening that applies cleanly to `dev` without the new state stack: Zod operation-param validation, immutable fee/storage override behavior, confirm-window one-time token binding if not already present, compatible content-script/manifest/CSP hardening. Explicitly exclude the strict `evt.origin === window.location.origin` check.
- Why it needs to change: Current branch lacks operation-param validation and still has some hardening gaps; the remediation plan says some security fixes should land before the core architecture PR.
- Relevant files/modules: `src/lib/temple/back/dryrun.ts`, `src/lib/temple/back/actions.ts`, `src/lib/temple/back/dapp.ts`, `src/lib/temple/types.ts`, `src/app/ConfirmPage/ConfirmPage.tsx`, `src/contentScript.ts`, `webpack/manifest.ts`.
- Source: PR #30, remediation Track B4, current architecture cleanup.
- Dependencies: Step 1 preferred; Step 2 handles super-admin separately.
- How to verify/test: `yarn ts`; targeted background/dApp tests; add tests for valid and invalid operation params, fee/storage override immutability, confirm-token mismatch/reuse rejection, same-origin message acceptance, unsafe-frame rejection, and MV2/MV3 manifest generation.
- Existing `arch-adjust` mapping: Replaces `02-add-zod-validation-for-operation-params.md` for Track B; narrows `16-harden-content-script-origin-boundary.md` to compatible hardening only.

### Step 5. Sync Track B Peel-Offs Back Into `dev-architecture-update`

- What needs to change: After each Track B PR merges into `dev`, merge `dev` back into `dev-architecture-update` through a small sync PR and ledger any new old-stack changes that require porting.
- Why it needs to change: This keeps PR #30's final diff shrinking instead of diverging and prevents reintroducing old Redux/SWR/Effector code during conflict resolution.
- Relevant files/modules: All files touched by Steps 1-4, plus any conflict files.
- Source: Remediation plan Ongoing Sync and Track B rules.
- Dependencies: Repeat after each Track B merge; must be complete before final B5/core PR.
- How to verify/test: Porting ledger, `yarn ts`, `yarn test`, and targeted smoke checks for each ported peel-off.
- Existing `arch-adjust` mapping: Missing from `arch-adjust`.

### Step 6. Phase 0: Baseline And Exact Runtime Dependency Pins

- What needs to change: On `dev-architecture-update`, establish baseline counts, then rewrite every `dependencies` specifier to the exact version already resolved in `yarn.lock`. Re-key the Yarn v1 lockfile without changing resolved versions.
- Why it needs to change: PR #30 still contains runtime ranges such as `zustand: ^5`, `@tanstack/react-query: ^5`, `axios: ^1.7.9`, and WebMavryk ranges. The remediation plan requires frozen runtime dependencies.
- Relevant files/modules: `package.json`, `yarn.lock`, `.github/workflows/ci.yml`, `AGENTS.md` version notes if verified package versions change from the current guide.
- Source: Remediation Phase 0; replaces old dependency cleanup assumptions.
- Dependencies: Step 0 sync should be complete for the target branch. Step 1 CI preferred.
- How to verify/test: Run `yarn install`; assert `git diff yarn.lock | grep -E '^[+-]\\s+(version|resolved|integrity)'` outputs nothing; run `yarn install --frozen-lockfile`, `yarn ts`, `yarn test`, and `yarn build`; record suite/test counts.
- Existing `arch-adjust` mapping: Replaces `12-remove-unused-vulnerable-runtime-dependencies.md` and `13-upgrade-axios-and-remove-fetch-adapter.md`; partially covers `18-add-large-list-virtualization-pilot.md` by pinning `@tanstack/react-virtual`.

### Step 7. Phase 1: Classified Intercom Timeouts And Disconnect Recovery

- What needs to change: Add bounded timeout options to `IntercomClient.request`, clear timers on all settle paths, reject in-flight requests with a typed disconnect error before port rebuild, classify front/back request timeouts by `TempleMessageType`, dedupe auto-decline constants, and add bounded retry for cold `GetStateRequest`.
- Why it needs to change: PR #30's flat 30 s timeout breaks user-mediated confirmations, but removing it would create permanent hangs on MV3 port disconnects.
- Relevant files/modules: `src/lib/intercom/client.ts`, `src/lib/temple/front/client.ts`, `src/lib/temple/front/use-mavryk-client.ts`, `src/contentScript.ts`, `src/lib/temple/back/actions.ts`, `src/lib/temple/back/constants.ts`, `src/lib/temple/back/dapp.ts`, `src/lib/store/zustand/intercom-sync.ts`, new tests under `src/lib/intercom/`.
- Source: Remediation Phase 1; fixes accepted PR defect.
- Dependencies: Step 6 preferred; independent from migration phases.
- How to verify/test: Fake-timer tests for default timeout, long allowlisted timeout, timer cleanup, disconnect rejection, and cold-state retry. Manual checks: approve an in-wallet send at about 50 s, wait past 65 s for clean auto-decline, run dApp confirmation across the 120 s window, kill MV3 worker mid-request and verify recovery.
- Existing `arch-adjust` mapping: Missing from `arch-adjust`.

### Step 8. Phase 7: Block-Aware Swap Quotes

- What needs to change: Expand swap quote/params keys to include account, chain ID, and all `Route3SwapParamsRequestRaw` fields; invalidate quote keys on new blocks; expose `isFetching`; disable submit during background refetch; keep token/DEX list stale times long.
- Why it needs to change: PR #30 uses stale-time-only quote caching and an incomplete key, so users can submit stale or cache-collided quotes.
- Relevant files/modules: `src/lib/query-keys.ts`, `src/lib/swap/use-swap.query.ts`, `src/lib/temple/front/chain.ts`, `src/app/templates/SwapForm/SwapForm.tsx`, `src/app/hooks/use-swap.ts`.
- Source: Remediation Phase 7 and accepted stale-swap investigation finding.
- Dependencies: Step 6 preferred; independent from Phases 2-5 and can run before the migration chain.
- How to verify/test: Unit tests for full key construction, block invalidation, fallback refetch interval where no block subscription exists, and submit disabled while `isFetching`. Manual swap staleness test: wait at least two blocks and verify quote refreshes unprompted.
- Existing `arch-adjust` mapping: Replaces the quote-freshness portion of `05-extract-swap-token-dex-loading.md`; uses `11-localize-new-block-triggers.md` only as background context.

### Step 9. Phase 2: Shared Zustand Store-Hydration Gate

- What needs to change: Add `awaitStoresHydrated(...stores)` built on Zustand persist `hasHydrated()` and `onFinishHydration()`.
- Why it needs to change: Phases 3-5 must not read initializer defaults or write data that late async rehydration overwrites.
- Relevant files/modules: `src/lib/store/zustand/persist-storage.ts`, `src/lib/store/zustand/throttled-storage.ts`, `src/lib/store/zustand/index.ts`, new hydration-gate tests under `src/lib/store/zustand/__tests__/`.
- Source: Remediation Phase 2.
- Dependencies: Step 6 preferred. Must precede Steps 10-12.
- How to verify/test: Unit-test already-hydrated stores, asynchronously hydrating stores, multiple-store waiting, and listener cleanup with mocked async storage.
- Existing `arch-adjust` mapping: Missing from `arch-adjust`.

### Step 10. Phase 3: Legacy UI Preferences, Token Metadata, And Analytics ID Migration

- What needs to change: Migrate `persist:temple-root` and `analytics_user_id` into `uiStore`/`metadataStore` after hydration, including the legacy root `tokensMetadata` payload. Use safe parsers and public setters only: validate object shape, ignore `__proto__`/`constructor`/`prototype`, never spread parsed objects into stores, validate scalar/enumerated fields, and fail closed on malformed data. Add durable `legacyMigrated` state and gate analytics emission until migration completes.
- Why it needs to change: Upgrading users otherwise lose preferences and may get a new analytics identity before migration can read the real stored ID.
- Relevant files/modules: `src/lib/store/zustand/ui.store.ts`, `src/lib/store/zustand/metadata.store.ts`, new legacy UI migration module, `src/app/hooks/use-user-id-sync.ts`, `src/lib/constants.ts`, `src/lib/temple/back/main.ts`, prod reference files under `origin/dev:src/app/store/**`.
- Source: Remediation Phase 3.
- Dependencies: Step 9. Must precede asset and IndexedDB migrations.
- How to verify/test: Migration fixture tests for `browser.storage.local` plain-object payloads, localStorage serialized fallback, malformed/`__proto__` payload fail-closed behavior, second-run no-op, fresh-install no-op, durable flush before completion, and analytics ID preservation.
- Existing `arch-adjust` mapping: Missing from `arch-adjust`; partially replaces old persisted-state concerns embedded in `22`/`23`/`25`.

### Step 11. File Phase 9 Legacy Retirement Follow-Up

- What needs to change: When Step 10 lands, file the future Phase 9 deletion ticket with exact keys/modules and deletion markers. Do not delete the legacy payloads yet.
- Why it needs to change: The remediation plan requires tracking deletion as soon as the first legacy migration lands so bridge code does not rot.
- Relevant files/modules: Migration modules from Steps 10-12, `src/intercom-client.ts`, seven legacy keys: `persist:temple-root`, `persist:root.assets`, `persist:root.collectibles`, `persist:root.rwas`, `persist:root.collectiblesMetadata`, `persist:root.rwasMetadata`, `persist:root.partnersPromotion`, plus localStorage fallback copies.
- Source: Remediation Phase 9 trigger.
- Dependencies: Step 10.
- How to verify/test: Ticket/ledger exists and every migration bridge module has a `// DELETE IN <version>` marker. No runtime deletion should happen in this PR.
- Existing `arch-adjust` mapping: Missing from `arch-adjust`.

### Step 12. Phase 4: Legacy Assets, Adult Flags, Partner Promotion, And Nested Metadata Migration

- What needs to change: Migrate `persist:root.assets` token/collectible/RWA records into `assetsStore`, migrate `persist:root.collectibles` and `persist:root.rwas` `adultFlags`, migrate `persist:root.partnersPromotion` durable UI fields into `uiStore`, and migrate legacy `persist:root.collectiblesMetadata` / `persist:root.rwasMetadata` records into `metadataStore`. The old metadata reducers persist `records` as arrays of built `TokenMetadata`; convert them back to slug-keyed records through the existing token-slug helper and add a direct RWA metadata setter if the new store lacks one. Prove data is present in memory and persisted storage before setting the completion flag.
- Why it needs to change: This is the actual 2.0.0 custom-asset/status data-loss vector; the old IndexedDB diagnosis alone is insufficient. The nested metadata keys are part of the same legacy persistence surface and dropping them would lose offline collectible/RWA metadata after upgrade.
- Relevant files/modules: New `src/lib/store/zustand/legacy-assets-migration.ts`, `src/lib/store/zustand/assets.store.ts`, `src/lib/store/zustand/ui.store.ts`, `src/lib/store/zustand/metadata.store.ts`, `src/lib/store/zustand/throttled-storage.ts`, prod reference `origin/dev:src/app/store/assets/reducer.ts`, `origin/dev:src/app/store/assets/utils.ts`, `origin/dev:src/app/store/collectibles-metadata/reducer.ts`, `origin/dev:src/app/store/rwas-metadata/reducer.ts`.
- Source: Remediation Phase 4.
- Dependencies: Steps 9 and 10.
- How to verify/test: Fixture tests with real 2.0.0 `persist:root.assets` shape; custom tokens survive; disabled/default asset statuses survive; manual flags are preserved; adult flags survive; partner promotion timestamps validate; collectible/RWA metadata survives; malformed payloads fail closed; reload twice and confirm no duplicate assets.
- Existing `arch-adjust` mapping: Replaces `25-separate-custom-assets-from-api-asset-state.md`; splits part of `04-extract-advertising-and-promotion-loading.md`; covers the migration half of `23-extract-collectible-rwa-metadata-server-state.md`.

### Step 13. Phase 5: IndexedDB Asset Migration Safety Net

- What needs to change: Re-register `migrateFromIndexedDB` as `assets-migrations@2.0.1`, gate it on hydrated `metadataStore` and `assetsStore`, fetch metadata before classifying residual records where possible, default unclassified records to token/manual false or add explicit re-bucketing, and clear `Repo.accountTokens` only after durable write verification. Add `.catch` logging around `void migrate([...])`.
- Why it needs to change: It only matters for pre-1.18.2 direct upgrades, but the existing PR code can drop records with missing metadata and clear the IndexedDB table too early.
- Relevant files/modules: `src/lib/assets/migrations.ts`, `src/app/hooks/use-assets-migrations.ts`, `src/lib/assets/repo.ts` or `Repo.accountTokens` owner, `src/lib/store/zustand/assets.store.ts`, `src/lib/store/zustand/metadata.store.ts`, `src/lib/local-storage/migrator.ts`.
- Source: Remediation Phase 5.
- Dependencies: Steps 9, 10, and 12. Phase 3 must restore legacy `tokensMetadata` first.
- How to verify/test: Pre-1.18.2 fixture test; no-metadata record handling; durable read-back before clear; thrown failure retries next boot; migration idempotency after reload.
- Existing `arch-adjust` mapping: Replaces the IndexedDB portion of `25-separate-custom-assets-from-api-asset-state.md` and corrects the old asset-migration diagnosis.

### Step 14. Phase 6: Reactive Collectible/RWA Detail Selectors Without N+1

- What needs to change: Keep the batched detail fetcher, give it stable account/chain keys, normalize responses into per-slug query cache entries, make leaf hooks reactive without `queryFn`, replace dead exact-key loading helpers with prefix-scoped `useIsFetching`, consolidate local key factories into `src/lib/query-keys.ts`, avoid mutating `slugs.sort()`, and resolve duplicate hook names.
- Why it needs to change: PR #30 uses non-reactive `queryClient.getQueriesData()` snapshots and loading helpers that always return false, but per-slug fetching would cause an N+1 regression.
- Relevant files/modules: `src/lib/collectibles/use-collectibles-details.query.ts`, `src/lib/rwas/use-rwas-details.query.ts`, `src/app/hooks/use-collectibles-details-loading.ts`, `src/app/hooks/use-rwa-details-loading.ts`, `src/lib/query-keys.ts`, `src/app/pages/Collectibles/**`, `src/app/pages/RWAs/**`.
- Source: Remediation Phase 6.
- Dependencies: Step 6 preferred. Must precede Phase 8.
- How to verify/test: Tests for cache write causing hook re-render, leaf hooks not fetching, loading helper true during batch fetch, null miss handling, and no mutation of caller slug arrays. Manual check: grid/list cards and detail pages show loading states.
- Existing `arch-adjust` mapping: Replaces `21-extract-collectible-rwa-details-server-state.md`.

### Step 15. Phase 8a: Query-Only Server Domains

- What needs to change: For server data with no offline/durable requirement, remove Zustand/store mirrors and use TanStack Query as the only read path. Do this one domain per branch or commit: notifications, exchange rates, buy-with-credit-card, swap token/DEX lists, advertising API data, and promotion API data.
- Why it needs to change: The investigation correctly found duplicate caches. The remediation plan fixes ownership within the new stack instead of reverting to SWR/Redux.
- Relevant files/modules: `src/lib/notifications/hooks/use-notifications.query.ts`, `src/app/hooks/use-exchange-rates.query.ts`, `src/lib/buy-with-credit-card/use-buy-with-credit-card.query.ts`, `src/lib/swap/use-swap.query.ts`, `src/app/hooks/use-advertising-promotion.query.ts`, `src/app/hooks/use-partners-promo.query.ts`, `src/lib/query-keys.ts`, any remaining store mirror call sites.
- Source: Remediation Phase 8 ownership table.
- Dependencies: Steps 6 and 14. Step 12 must be complete before promotion persisted preferences are assumed migrated.
- How to verify/test: Per-domain tests for query keys, loading/error/success states, cache invalidation, and no store writes from query functions. Run `yarn ts` and `yarn test` after each domain branch/commit.
- Existing `arch-adjust` mapping: Rewrites `03`, `04`, `05`, `06`, and `07`.

### Step 16. Phase 8b: Assets, Scamlist, And Whitelist Ownership

- What needs to change: Keep user asset list/statuses and scamlist/whitelist in persisted `assetsStore`; make queries feed the store through one explicit named sync function and remove feedback-loop gating such as `enabled: knownChain && !tokensAreLoading`.
- Why it needs to change: User assets are durable client state, and scamlist/whitelist must fail closed on cold start or network failure.
- Relevant files/modules: `src/lib/assets/use-assets-query.ts`, `src/lib/assets/load-account-assets.ts`, `src/lib/store/zustand/assets.store.ts`, asset list/manage screens, scam/delegate tags.
- Source: Remediation Phase 8 ownership table and Phase 4 migration constraints.
- Dependencies: Steps 12 and 13. Step 14 preferred.
- How to verify/test: Unit tests for explicit sync function, no self-gated query feedback loop, persisted scamlist fallback. Manual fail-closed test: populate scamlist, block network, cold-start extension, confirm scam labels still render.
- Existing `arch-adjust` mapping: Rewrites `25-separate-custom-assets-from-api-asset-state.md`; also updates concepts from `22`/`23` only where metadata classification touches assets.

### Step 17. Phase 8c: Metadata Ownership

- What needs to change: Keep token/collectible/RWA metadata in persisted `metadataStore`; queries feed the store through explicit metadata sync functions; query hooks must not also be component read paths for metadata-owned domains.
- Why it needs to change: Metadata needs offline behavior and participates in upgrade migrations/classification. Query-only ownership would lose that.
- Relevant files/modules: `src/lib/metadata/index.ts`, `src/lib/store/zustand/metadata.store.ts`, metadata loading/refresh hooks, token/collectible/RWA item and detail consumers, `src/lib/query-keys.ts`.
- Source: Remediation Phase 8 ownership table.
- Dependencies: Steps 10, 13, and 14.
- How to verify/test: Tests for predefined metadata, fetched metadata, missing metadata fallback, persistence, explicit sync behavior, and no duplicate component read path. Run `yarn ts` and targeted metadata tests.
- Existing `arch-adjust` mapping: Rewrites `22-extract-token-metadata-server-state.md` and `23-extract-collectible-rwa-metadata-server-state.md`.

### Step 18. Phase 8d: Balances Ownership

- What needs to change: Keep balances in persisted `balancesStore`; ensure API/query loading feeds balances through one explicit named sync function and does not split one account-assets response across unrelated caches.
- Why it needs to change: Balance data needs offline display, and `load-account-assets` returns slugs and balances together.
- Relevant files/modules: `src/lib/balances/**`, `src/lib/assets/load-account-assets.ts`, `src/lib/store/zustand/balances.store.ts`, `src/app/hooks/use-balances-loading.ts`, home/manage-asset balance consumers.
- Source: Remediation Phase 8 ownership table.
- Dependencies: Steps 12, 13, and 14. Step 16 should land first because the same account-assets response touches assets.
- How to verify/test: Tests for initial load, account/network cache separation, explicit sync function, offline persisted balance display, block/MVKT update behavior, loading/error states. Run `yarn ts` and relevant balance tests/smokes.
- Existing `arch-adjust` mapping: Rewrites `24-extract-balances-server-state.md`.

### Step 19. Final Core Architecture PR To `dev`

- What needs to change: After Track A remediation and Track B peel-offs are merged and synced, open the final core PR from `dev-architecture-update` to `dev`. The remaining atomic change is the new architecture itself plus PR #30 features that depend on it.
- Why it needs to change: The state-stack swap cannot be merged piecemeal into Redux-based `dev`; the preceding steps make the final diff smaller and remediated.
- Relevant files/modules: `package.json`, `yarn.lock`, `src/app/store/**`, `src/lib/store/zustand/**`, `src/lib/query-keys.ts`, `src/lib/swr/index.ts`, `src/lib/temple/front/use-mavryk-client.ts`, `src/lib/temple/front/**`, `src/app/**` call sites, PR #30 UI/product feature files.
- Source: PR #30 core architecture plus remediation Track B5.
- Dependencies: Steps 0-18 complete; no unresolved sync ledger items; no remediation edits under `src/mavryk/api`.
- How to verify/test: Full gate: `yarn ts`, `yarn test`, `yarn build`, `yarn build:firefox`; upgrade-path test from prod profile; confirmation-window tests; MV3 worker-eviction test; swap staleness test; scamlist fail-closed test; migration idempotency reload; dApp smoke test; verify PR #30 product features still work.
- Existing `arch-adjust` mapping: Replaces `01-split-wallet-actions-from-state-selectors.md`, `15-replace-effector-background-store.md`, and the new-stack parts of the old server-state tasks.

### Step 20. Future Release: Phase 9 Legacy Dead-Code Retirement

- What needs to change: After one clean release cycle, delete legacy migration modules and their markers, remove all seven legacy redux-persist keys plus localStorage fallback copies, delete dead `src/intercom-client.ts` after confirming zero callers, optionally align `balances.store.ts` persistence key naming, and sweep anchored historical patterns.
- Why it needs to change: Migration bridge code should not become permanent architecture.
- Relevant files/modules: Migration modules from Steps 10-13, browser/localStorage cleanup helper, `src/intercom-client.ts`, `src/lib/store/zustand/balances.store.ts`.
- Source: Remediation Phase 9.
- Dependencies: Final core architecture release has shipped and upgrade telemetry/manual verification is clean.
- How to verify/test: Upgrade from the previous release still works before deletion; after deletion, fresh install and already-migrated profile boot cleanly; no active code references legacy keys except historical docs/comments.
- Existing `arch-adjust` mapping: Missing from `arch-adjust`; future-only, not part of PR #30 remediation landing.

## Documentation Update

This document replaces the old `arch-adjust` folder assumptions as the actionable PR #30 implementation plan. The `arch-adjust` folder has been regenerated into `remed-task-<number>-<short-description>.md` developer tasks plus `remed-final-report.md`; the older investigation-derived task files should not be used as source of truth.

When Phase 0 or the final core PR changes actual package versions, scripts, folder conventions, or testing workflow, update `AGENTS.md` in the same PR after verifying `package.json` and local config. In particular, the current guide still names the old active-branch TypeScript stack, while PR #30 resolves newer versions that Phase 0 must pin exactly.
