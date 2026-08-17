# PR #30 Architecture Investigation

Date: 2026-08-13

PR: https://github.com/mavryk-network/mavryk-wallet/pull/30

Current branch inspected: `MAV-3979/book-scoping`

Current HEAD inspected: `ddd5e0a9` (`Merge branch 'MAV-3943/intercom' into MAV-3979/book-scoping`)

PR head inspected: `dad4cc8d4b6dea96728a66191ab38727f08cf93a`

Original merge base: `db67580f2a41b8d593e421e07f48592646532579`

## Executive Summary

PR #30 is not safe to merge or cherry-pick wholesale into the current repository.

The PR contains useful ideas, but it is an older, very broad architecture branch. It changes 602 files against its original base, removes the current Redux/SWR/Effector architecture, introduces Zustand and TanStack Query, updates many dependencies and build tools, and includes product/UI changes and security fixes in the same branch.

The current branch has evolved materially since PR #30 was opened. Most importantly, the current branch contains a newer `src/mavryk/api` layer and authentication/intercom work that PR #30 would delete if compared directly against current `HEAD`. A direct adoption would regress current Mavryk API/auth behavior, contacts behavior, network storage behavior, and related tests.

The best path is to treat PR #30 as a source of candidates:

1. Adopt the split between "wallet actions" and "wallet state selectors", but implement it on top of the current branch and current auth/API code.
2. Reduce providers incrementally by removing or localizing providers that have narrow or no real usage.
3. Move server/API state out of Redux gradually, but do not replace Redux, SWR, and Effector with TanStack Query and Zustand in one migration.
4. Prioritize dependency cleanup and security upgrades that remove known vulnerable or unused packages.
5. Adopt specific security hardening from PR #30, especially operation parameter validation in background dry-run/signing paths.
6. Avoid broad library modernization unless it removes real current complexity or measurable bundle/security risk.

TanStack Query is a strong server-state library, but PR #30 uses it alongside Zustand in a way that creates duplicate caches and non-reactive selectors. Given the current wallet already uses SWR narrowly, a full TanStack migration is not justified today.

Zustand is small and useful for some client-state cases, but PR #30 introduces it as a full Redux replacement while also changing persistence, assets, balances, and metadata. That migration is high risk and not currently justified. If Redux server-state slices are cleaned up first, the remaining durable UI/client state may not need Zustand at all.

## Sources And Method

This report is based on:

- GitHub PR metadata and review comments fetched with `gh pr view` and GitHub API calls.
- Local PR ref `origin/pr/30`, fetched from `pull/30/head`.
- Diffs from `db67580f..origin/pr/30` and `HEAD..origin/pr/30`.
- Current repository inspection with local grep/sed commands.
- Current dependency manifest and lockfile inspection.
- PR dependency manifest and lockfile inspection.
- `yarn audit --json --groups dependencies`, run on 2026-08-13. The audit output was very large, but the summary and key advisories were inspected.
- Package metadata for TanStack Query, TanStack Virtual, Zustand, SWR, Redux Toolkit, and Effector via npm metadata.

## Current Architecture Assessment

### Runtime Entry And Provider Stack

The current app root is `src/app/App.tsx`.

Current provider stack:

```tsx
DialogsProvider
  Suspense
    AppProvider
      AppEnvProvider
        StoreProvider
          Woozie.Provider
            TempleProvider
              TzktConnectionProvider
                Dialogs
                DisableOutlinesForClick
                AwaitI18N
                AwaitFonts
                BootAnimation
                ConfirmPage | PageRouter
```

This is not extreme for a browser extension with multiple execution surfaces, but several providers are broader than their actual usage requires.

Important current providers:

- `src/app/store/provider.tsx`
  - Wraps Redux `Provider` and `PersistGate`.
  - Owns persisted app state and Redux epics.
- `src/lib/temple/front/provider.tsx`
  - Wraps wallet readiness, RPC setup, block triggers, and shortcut account selection state.
- `src/lib/temple/front/client.ts`
  - Large `TempleClientProvider`.
  - Mixes background state fetching, confirmation state, wallet specs from storage, and wallet action methods.
- `src/lib/temple/front/ready.ts`
  - Provides many wallet selectors through `constate`.
  - Contains side effects such as selected account/network reconciliation, authorization, contacts sync, KYC update, and error-boundary reset.
- `src/lib/temple/front/tzkt-connection.tsx`
  - Owns SignalR connection setup.
  - In current usage, it is primarily consumed by `src/app/hooks/use-balances-loading.ts`.

The biggest issue is not simply "too many providers". The bigger issue is that high-level providers mix multiple responsibilities:

- global wallet state
- wallet actions
- API/state synchronization
- persistence repair
- background authorization
- chain/RPC toolkit creation
- feature-specific polling

### State Management

Current state systems:

- Redux Toolkit in `src/app/store`
- Redux Observable/RxJS epics in `src/app/store/*/epics.ts`
- Redux Persist for durable app state
- SWR in `src/lib/swr` and a few wallet/domain hooks
- Effector only in `src/lib/temple/back/store.ts`
- Local React contexts for route, dialogs, dropdowns, shortcut state, and feature-local UI state
- Extension/background storage through `lib/temple/back` and `lib/temple/front`

Current Redux root slices in `src/app/store/root-state.reducer.ts` include:

- settings
- advertising
- currency
- notifications
- swap
- partnersPromotion
- balances
- assets
- tokensMetadata
- collectiblesMetadata
- rwasMetadata
- abTesting
- buyWithCreditCard
- collectibles
- rwas
- newsletter

This is the main architecture smell: Redux stores a mixture of durable client state and server/API cache state. Assets, balances, metadata, collectives, RWAs, exchange rates, swap tokens/dexes/params, notifications, promotions, and buy-with-credit-card data are all server/API-derived state.

That makes Redux larger than it needs to be and forces effects, loading flags, invalidation, and persistence concerns into one global app store.

### Epics Drift

`src/app/store/root-state.epics.ts` has several epics commented out:

- `advertisingEpics`
- `notificationsEpics`
- `swapEpics`
- `partnersPromotionEpics`

Some corresponding actions are still dispatched:

- `src/app/hooks/use-advertising.hook.ts`
  - dispatches `loadAdvertisingPromotionActions.submit()`
- `src/app/hooks/use-long-refresh-loading.hook.ts`
  - dispatches `loadNotificationsAction.submit()`
- `src/app/WithDataLoading.tsx`
  - dispatches `loadSwapDexesAction.submit()`
  - dispatches `loadSwapTokensAction.submit()`
- `src/app/hooks/use-load-partners-promo.ts`
  - dispatches `loadPartnersPromoAction.submit()`

This is a concrete maintainability problem independent of PR #30. The code can enter loading states without an active epic to resolve them.

### Server/API State

Current server-state loading is centralized in `src/app/WithDataLoading.tsx`.

It calls hooks for:

- asset migrations
- scamlist loading
- assets loading
- metadata loading
- metadata refresh
- balances loading
- collectible details loading
- RWA details loading
- long refresh loading
- advertising loading
- swap tokens/dexes loading
- storage analytics
- user ID sync

This boot-time aggregation is easy to find, but it is also broad. It means unrelated server/API concerns are started globally, even when only some screens need them.

The current branch already has `src/mavryk/api`, including auth-aware clients, contacts/history/RWA/token methods, parsers, storage, and tests. This layer is newer than PR #30 and must remain the source of truth for Mavryk API work.

### SWR Usage

SWR is already installed and used narrowly:

- `src/lib/swr/index.ts`
- `src/lib/temple/front/client.ts`
- `src/lib/temple/front/ready.ts`
- `src/lib/temple/front/baking/baking.ts`
- `src/lib/temple/front/chain.ts`
- `src/app/pages/AddAsset/AddAsset.tsx`

SWR is not currently the source of most API/server cache state. That gives the repo a lower-risk migration path: expand existing SWR/domain hooks selectively instead of adding another cache library immediately.

### Forms

Current form stack:

- React Hook Form `5.3.1`
- Yup in a small number of validation flows
- Zod already used in the newer `src/mavryk/api` layer

React Hook Form v5 is old, but a repo-wide v7 migration is a form behavior migration, not just a dependency upgrade. It should be separate from provider/state architecture work.

Yup usage is small enough that it can be migrated gradually to Zod when touching those flows, but it is not a top-level architecture blocker.

### Routing

Routing currently uses the internal Woozie abstraction:

- `src/lib/woozie`
- `src/app/PageRouter.tsx`

There is no clear evidence that replacing routing is needed. The more valuable work is reducing side effects and state coupling around routes, not replacing the router.

## PR #30 Architecture Overview

PR #30 title:

`feat: architecture overhaul - Zustand + TanStack Query, privacy mode, UI polish, security hardening`

The PR states the main goals as:

- Replace Redux and Effector with Zustand.
- Replace SWR with TanStack Query v5.
- Split `useTempleClient` into an action-only hook and state selectors.
- Rename Taquito-oriented naming toward Mavryk/WebMavryk naming.
- Add virtualized lists through `@tanstack/react-virtual`.
- Add lazy image loading and UI polish.
- Add privacy mode and full address display behavior.
- Redesign receive page.
- Add testing build variant.
- Apply security hardening and bug fixes.

The PR is large:

- 602 files changed
- 13,583 insertions
- 15,706 deletions

Directory impact against the PR's original base:

- 69.8% of changed files are under `src/app`
- 25.5% are under `src/lib`
- 18.6% are under `src/app/store`
- 25.8% are under `src/app/pages`
- 11.3% are under `src/app/templates`

### PR State Architecture

PR #30 adds `src/lib/store/zustand`.

Important added files include:

- `src/lib/store/zustand/QueryProvider.tsx`
- `src/lib/store/zustand/query-client.ts`
- `src/lib/store/zustand/wallet.store.ts`
- `src/lib/store/zustand/intercom-sync.ts`
- `src/lib/store/zustand/ui.store.ts`
- `src/lib/store/zustand/assets.store.ts`
- `src/lib/store/zustand/balances.store.ts`
- `src/lib/store/zustand/metadata.store.ts`
- `src/lib/store/zustand/persist-storage.ts`
- `src/lib/store/zustand/throttled-storage.ts`

It removes the Redux app store tree under `src/app/store` and removes `src/lib/swr`.

It changes the app root from Redux provider usage to a TanStack Query provider. Provider count does not meaningfully collapse. The PR removes `StoreProvider` but adds `QueryProvider`, while most other app, wallet, routing, dialogs, and API providers remain.

### PR Wallet Client Split

The most valuable architecture idea in PR #30 is the wallet-client split.

Current branch:

- `src/lib/temple/front/client.ts` exposes a broad `useTempleClient()` object that mixes state and actions.

PR #30:

- `src/lib/temple/front/client.ts` becomes a thin intercom/request helper.
- `src/lib/temple/front/use-mavryk-client.ts` exposes action methods.
- Wallet state is read from Zustand stores/selectors.
- `TempleProvider` gates readiness through wallet selectors instead of subscribing to the whole client object.

This is directionally correct. It can reduce render churn and makes action methods easier to test. However, the implementation in PR #30 cannot be adopted directly because it predates current `src/mavryk/api` auth and current intercom changes.

### PR TanStack Query Usage

PR #30 adds:

- `@tanstack/react-query`
- `@tanstack/react-virtual`

Examples:

- `src/lib/assets/use-assets-query.ts`
- `src/lib/balances/hooks.ts`
- `src/lib/swap/use-swap.query.ts`
- `src/lib/collectibles/use-collectibles-details.query.ts`
- `src/lib/rwas/use-rwas-details.query.ts`
- `src/lib/query-keys.ts`

The query client defaults include:

- `refetchOnWindowFocus: false`
- `retry: 2`
- `staleTime: 30_000`

The concern is not TanStack Query itself. The concern is the PR's usage pattern: query functions frequently perform side effects into Zustand stores. This means TanStack Query is not the source of truth. It is a fetch scheduler layered beside Zustand, which creates two caches and harder invalidation semantics.

### PR Zustand Usage

PR #30 uses Zustand for:

- wallet state
- UI preferences
- assets
- balances
- metadata
- background vault state

This removes Redux and Effector dependencies, but it also rebuilds much of the same state topology in a different library. It does not fully solve server-state ownership because assets, balances, and metadata still become global client stores.

### PR Dependency Changes

Major additions:

- `@tanstack/react-query`
- `@tanstack/react-virtual`
- `zustand`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `@tailwindcss/postcss`
- `@mavrykdynamics/webmavryk-core`

Major removals:

- `@reduxjs/toolkit`
- `react-redux`
- `redux-observable`
- `redux-persist`
- `@redux-devtools/remote`
- `ts-action`
- `ts-action-operators`
- `swr`
- `effector`
- `@vespaiach/axios-fetch-adapter`
- `@ledgerhq/hw-transport-http`
- `@temple-wallet/youves-sdk`
- `dayjs`
- `query-string`
- old Tailwind/PostCSS packages

Major upgrades:

- axios `0.26.1` to `^1.7.9`
- React Hook Form `5.3.1` to `7.51.0`
- Dexie alpha to `^4.0.11`
- Jest `27` to `29`
- TypeScript `4.5.5` to `5.8.3`
- Tailwind `2` to `4`
- Ledger packages
- libsodium

The dependency cleanup intent is good, but the PR bundles too many unrelated dependency moves into one branch.

## PR #30 Vs Current Branch Comparison

### Current Branch Has Newer Mavryk API/Auth Work

This is the most important difference.

Comparing current `HEAD` against `origin/pr/30`, the PR would delete current files under `src/mavryk/api`, including auth, client, contacts, history, RWAs, tokens, parsers, storage, and tests.

Examples of current files that PR #30 would remove:

- `src/mavryk/api/auth/*`
- `src/mavryk/api/client.ts`
- `src/mavryk/api/contacts/*`
- `src/mavryk/api/history/*`
- `src/mavryk/api/rwas/*`
- `src/mavryk/api/tokens/*`
- `src/mavryk/api/__tests__/*`

Current background actions also contain newer auth and intercom protections:

- `src/lib/temple/back/actions.ts`
- `src/lib/temple/back/intercom-permissions.ts`
- `src/lib/temple/back/dapp.ts`

PR #30 does not know about all of this current work. Any adoption must be rebuilt on top of the current branch.

### Some PR Security Fixes Are Already Present

PR #30 added a top-frame guard and changed content-script behavior.

Current `webpack/manifest.ts` already has:

- `all_frames: false` for `scripts/contentScript.js`

Current `src/contentScript.ts` already uses top-frame checks around message handling/analytics. This means part of the PR's content-script hardening is already present.

One PR idea that may still be worth evaluating is stricter origin checking in the content script:

- PR checks `evt.origin === window.location.origin`.
- Current code should be reviewed for dApp compatibility before adopting that exact condition.

### Some PR Feature Changes Are Outdated In Current Branch

PR #30 includes ad/persona iframe and content-script related changes that do not map cleanly to the current branch.

Current branch does not have the same `public/iframes/persona-ad.html` path or matching persona iframe feature surface. Those PR changes should not be carried forward unless the feature is intentionally restored.

### PR Review Comments Still Matter

The PR had a detailed review comment from `AlexBelz123` on 2026-04-08. Several important findings remain relevant to the final PR head.

#### Intercom Timeout Regression

PR #30 adds a global 30 second request timeout in `src/lib/intercom/client.ts`.

Background confirmation flows can stay open longer than 30 seconds while the user reviews and confirms. The PR's timeout can reject the UI request before the background confirmation auto-decline window expires.

This is a behavioral regression risk for:

- sending operations
- signing operations
- dApp confirmations
- any long-lived approval prompt

Do not adopt this timeout behavior as-is.

#### Asset Migration Data Loss Risk

PR #30's asset migration uses metadata seeded only from predefined records and skips records that do not have metadata, then clears the old IndexedDB table.

Files involved:

- `src/app/hooks/use-assets-migrations.ts`
- `src/lib/assets/migrations.ts`

This can drop custom/non-predefined assets. Do not adopt that migration logic as-is.

#### Persisted UI State Reset

PR #30 moves UI persistence from Redux persist state to a new Zustand key (`zustand-ui`) without migrating old `temple-root` values.

This can reset:

- user preferences
- analytics user ID
- other persisted UI settings

If Zustand or a new persistence key is ever introduced, an explicit migration from current persisted state is required.

#### Non-Reactive Detail Selectors

PR #30 uses `queryClient.getQueriesData()` snapshots for collectible/RWA details and loading helpers that check broad keys instead of the actual slug-specific query keys.

Files involved:

- `src/lib/collectibles/use-collectibles-details.query.ts`
- `src/lib/rwas/use-rwas-details.query.ts`

That pattern is not reactive enough for UI selectors and can report wrong loading states. Do not copy it.

#### Stale Swap Quotes

PR #30 changes swap quote fetching to TanStack Query with a 30 second stale time, but does not tie swap params to block updates or add a reliable refetch interval.

Files involved:

- `src/lib/swap/use-swap.query.ts`
- `src/app/templates/SwapForm/SwapForm.tsx`

Swap quotes are block-sensitive. Any migration must preserve block-triggered refresh semantics or use explicit short refetch intervals and invalidation on network/account/input changes.

## Changes Worth Adopting

### 1. Split Wallet Actions From Wallet State

Adopt the idea, not the PR implementation.

Current issue:

- `src/lib/temple/front/client.ts` exposes a broad `useTempleClient()` value.
- Components can subscribe to more state than they need.
- Action methods and state selectors are coupled.

Recommended current-branch target:

- Create an action-only wallet client hook, for example `useMavrykClientActions()` or `useTempleClientActions()`.
- Keep state reads in selector hooks.
- Preserve current auth/intercom behavior from:
  - `src/lib/temple/back/actions.ts`
  - `src/lib/temple/back/dapp.ts`
  - `src/lib/temple/back/intercom-permissions.ts`
  - `src/mavryk/api`

Likely files:

- `src/lib/temple/front/client.ts`
- `src/lib/temple/front/provider.tsx`
- `src/lib/temple/front/ready.ts`
- call sites currently using `useTempleClient()`

Migration complexity: medium to high, depending on how many call sites read both state and actions.

Bundle impact: neutral.

Security impact: positive if current auth code is preserved and the client surface becomes easier to audit.

### 2. Add Runtime Validation For Background Operation Params

PR #30 adds Zod validation in `src/lib/temple/back/dryrun.ts` for operation params.

Current branch has:

- `opParams: any[]`
- no runtime schema validation before dry-run estimation/sending
- mutable `buildFinalOpParmas`

Recommended adoption:

- Add a current-branch-specific Zod schema for supported operation kinds.
- Validate before dry run/sign/send handling.
- Preserve current current-branch auth and permission checks.
- Make `buildFinalOpParmas` immutable.
- Keep the existing misspelled export name `buildFinalOpParmas` unless doing a compatibility alias, because renaming could break call sites.

Likely files:

- `src/lib/temple/back/dryrun.ts`
- `src/lib/temple/back/actions.ts`
- tests near background operation handling, if present

Migration complexity: low to medium.

Bundle impact: low because Zod is already in current dependencies.

Security impact: positive.

### 3. Remove Or Localize Narrow Providers

Useful provider reductions:

- `TzktConnectionProvider`
  - Currently used mainly by `src/app/hooks/use-balances-loading.ts`.
  - Consider moving SignalR connection setup into a balance/domain hook or module.
- `ShortcutAccountSelectStateProvider`
  - Defined in `src/app/hooks/use-account-select-shortcut.ts`.
  - Verify whether the shortcut overlay is mounted. If not, remove provider and dead shortcut state.
- `ContentPaperRefContext`
  - Defined in `src/app/layouts/context.ts`.
  - No meaningful current usage found beyond the definition.
- no-op `usePushNotifications()`
  - Called from `src/lib/temple/front/provider.tsx`.
  - If still no-op, remove the provider-side call.
- `FileTransferProvider`
  - Used around large settings surfaces.
  - Scope it to the exact import/export flow if possible.
- `NewBlockTriggersProvider`
  - Useful, but only if consumers require provider-driven block callbacks.
  - If only narrow consumers remain, move to a hook-level subscription.

Migration complexity: low to medium if done one provider at a time.

Bundle impact: small, but render-path clarity improves.

Security impact: neutral to positive, because fewer global effects are easier to audit.

### 4. Clean Up Dead Or Vulnerable Dependencies

Adopt the PR's dependency cleanup intent, but do it as focused dependency PRs.

High-value current cleanup candidates:

- `@temple-wallet/youves-sdk`
  - Current source usage appears to be only in commented-out imports under `src/lib/apis/youves`.
  - Pulls old axios transitively.
- `@ledgerhq/hw-transport-http`
  - No current source import found.
  - Pulls old axios transitively.
- `query-string`
  - No current source import found.
- `graphql-request`
  - No current source import found.
- `use-force-update`
  - Used only in a couple places.
  - Replace with a local `useReducer` pattern or small hook.
- `effector`
  - Used only in `src/lib/temple/back/store.ts`.
  - Can be replaced later with a tiny local store if dependency cleanup is a priority.
- Yup
  - Small usage. Migrate opportunistically to Zod when touching those forms.

Upgrade candidates:

- axios
- Dexie
- libsodium
- Ledger packages
- Nanoid/transitive packages
- TypeScript, but only as a separate compiler-migration task

Migration complexity: variable. Unused dependency removals are low complexity. Axios and TypeScript upgrades are medium to high because behavior/tooling can change.

Security impact: high for old axios and vulnerable transitive packages.

### 5. Virtualize Large Lists If Measurement Supports It

PR #30 uses `@tanstack/react-virtual` for token/manage-asset lists.

Potential current targets:

- `src/app/pages/Home/OtherComponents/Tokens.tsx`
- manage asset/token list screens under `src/app/pages/AddAsset` or related asset-management pages
- collectibles/RWAs grids if large data sets are common

Recommendation:

- Adopt virtualization only for screens that actually render large lists.
- `@tanstack/react-virtual` is small and focused.
- Keep it separate from TanStack Query. It does not imply adopting TanStack Query.

Migration complexity: low to medium per list.

Bundle impact: small added dependency, potentially lower runtime rendering cost.

Security impact: low, but pin exact versions if added.

### 6. Lazy Image Loading And UI Polish

PR #30 includes lazy image loading and formatting/display polish.

These are low-risk if implemented directly in current components:

- lazy images for token/collectible/RWA artwork
- tabular numeric formatting
- consistent full/short address display rules
- privacy mode if product still wants it

These should be product/UI tasks, not blockers for architecture work.

## Changes Useful But Should Be Implemented Differently Today

### Server/API State Extraction

PR #30 tries to remove Redux server/API slices by moving to TanStack Query plus Zustand.

The underlying goal is good. The implementation is not ideal for current branch.

Recommended current approach:

- Keep Redux for durable client state first.
- Move one server-state domain at a time to domain hooks.
- Prefer existing SWR or a small local async hook unless the domain clearly needs TanStack Query features.
- Avoid mirroring query results into a second global store.

Good first domains:

- swap tokens/dexes
- exchange rates
- advertising/promotions, if still active
- buy-with-credit-card provider/config data

Harder domains:

- balances
- assets
- token metadata
- collectible metadata
- RWA metadata

Balances/assets/metadata have persistence, migrations, chain invalidation, and account/network coupling. They should not be the first migration target.

### Effector Removal

PR #30 replaces Effector with Zustand in the background vault store.

Current Effector usage is isolated:

- `src/lib/temple/back/store.ts`

Replacing Effector is reasonable only as a dependency cleanup task.

Better options:

1. Keep Effector for now.
2. Replace it with a tiny local external store implemented with closures/subscribers.
3. Use vanilla Zustand only if Zustand is already adopted elsewhere for a broader reason.

Do not introduce Zustand solely to remove this small Effector usage.

### React Hook Form v7 Upgrade

PR #30 upgrades React Hook Form from v5 to v7.

This is probably desirable eventually, but not as part of the architecture simplification project.

Recommended approach:

- Create a separate migration task.
- Start with shared form helpers/resolvers.
- Migrate one flow at a time with tests.
- Avoid changing Yup/Zod/form library and state architecture in the same PR.

### Tailwind v4 Upgrade

PR #30 upgrades Tailwind/PostCSS tooling.

This is a broad styling/build migration. It may be useful later, but it is not required to reduce providers or server-state complexity.

Recommended approach:

- Keep separate from architecture migration.
- Verify extension builds for Chrome and Firefox.
- Verify CSS output and visual regressions.

### Naming Cleanup From Taquito To Mavryk/WebMavryk

PR #30 does broad naming cleanup:

- `useTezos`
- `ReactiveTezosToolkit`
- `taquito-fast-rpc`
- Tzkt naming

This is directionally good for Mavryk maintainability, but it touches many files. Do it gradually around actual code changes. Avoid a repo-wide rename in the same PR as state architecture work.

## Changes That Should Not Be Adopted

### Do Not Merge Or Cherry-Pick PR #30 Wholesale

Reasons:

- It deletes current `src/mavryk/api` work.
- It predates current auth/intercom work.
- It still contains important PR review defects.
- It mixes state architecture, query architecture, UI product changes, security changes, dependency upgrades, build tooling, and tests.
- It would be difficult to review or safely roll back.

### Do Not Copy The 30 Second Global Intercom Timeout

PR #30's global timeout can break long-running confirmation flows.

The wallet has user-mediated approval flows that may legitimately take longer than 30 seconds. Timeouts need to be per-request-type and aligned with background auto-decline behavior.

### Do Not Copy Asset Migration Logic

The PR migration can drop custom/non-predefined assets.

Any asset migration must preserve unknown/custom assets or explicitly quarantine them for user review. It must not clear the old store until the new store is verified.

### Do Not Reset Persisted UI State Without Migration

Changing persistence keys or state libraries requires migration from current persisted Redux state.

At minimum, preserve:

- user ID / analytics ID
- selected settings
- privacy/display preferences
- relevant opt-in/out state

### Do Not Mirror TanStack Query Results Into Zustand Stores

This creates two sources of truth.

If TanStack Query is used, the query cache should generally be the source of truth for server data. If Zustand is used, it should hold durable client state or transient UI state, not copied API results.

### Do Not Migrate Forms, Tailwind, Redux, SWR, And Effector Together

The PR combines too many risk areas. Future work should isolate:

- dependency security upgrades
- form library upgrades
- styling/build upgrades
- state architecture
- provider cleanup
- wallet client split

## TanStack Assessment

### What TanStack Query Would Replace

If adopted broadly, TanStack Query would replace or reduce:

- SWR usage in `src/lib/swr` and current SWR hooks
- many Redux server/API slices
- many Redux Observable epics
- manual loading/error flags for API state
- some invalidation logic in `WithDataLoading`

### Where It Fits Well

TanStack Query can fit well for:

- idempotent API reads
- exchange rates
- swap token/dex lists
- swap params, if block-sensitive invalidation is handled correctly
- buy-with-credit-card limits/config
- RWA/token/collectible details if keys and selectors are correctly reactive
- API state that should not be persisted as durable client state

Strengths:

- mature query caching
- query keys and invalidation
- mutations
- request deduping
- stale/refetch policies
- cache garbage collection
- built-in loading/error semantics

### Where It Is Risky In This Wallet

TanStack Query is not automatically a good fit for:

- wallet vault state
- selected account/network settings
- approval/confirmation lifecycle
- persisted user preferences
- custom asset persistence/migrations
- block-sensitive swap quotes unless invalidation is explicit
- extension background state if request/response lifetimes are long-lived

### PR #30's TanStack Problems

The PR uses TanStack Query as a fetch scheduler while writing results into Zustand. This weakens the main reason to use TanStack Query.

Concrete issues:

- Duplicate cache/store ownership.
- Query cache can update without UI selectors reacting if selectors read Zustand snapshots.
- Zustand can update without TanStack invalidation semantics.
- `getQueriesData()` use for details is snapshot-based and not reactive.
- Global `staleTime: 30_000` is too blunt for block-sensitive data.
- Swap quote refresh no longer clearly follows new blocks.

### Dependency And Security Impact

Npm metadata inspected:

- `@tanstack/react-query@5.90.20`
  - dependency: `@tanstack/query-core`
  - unpacked size around 736 KB
  - MIT
- `@tanstack/react-virtual@3.13.12`
  - dependency: `@tanstack/virtual-core`
  - unpacked size around 18 KB
  - MIT

The libraries are not large relative to the current Redux stack, but the current project already has SWR. Adding TanStack Query while SWR remains installed increases architecture and dependency surface.

PR #30 uses broad semver ranges (`^5`, `^3`). For a wallet browser extension, exact runtime dependency pins are preferable.

### Objective Recommendation

Do not adopt TanStack Query as a repo-wide replacement right now.

Use the current SWR dependency and domain hooks for near-term server-state cleanup. If TanStack Query is reconsidered later, run a focused pilot:

1. Pick one non-critical server-state domain.
2. Make TanStack Query the source of truth for that domain.
3. Do not mirror data into Zustand.
4. Pin exact versions.
5. Add tests for invalidation, network/account changes, and stale data.
6. Verify bundle impact.

Good pilot candidates:

- exchange rates
- swap token/dex lists, not live quotes first
- buy-with-credit-card provider config

Poor first candidates:

- balances
- custom assets
- metadata migrations
- wallet background state
- confirmation flows

## Zustand Assessment

### What Zustand Would Replace

PR #30 uses Zustand to replace:

- Redux app store
- Redux Persist
- Redux Observable state orchestration
- Effector background vault store
- SWR-backed wallet state

### Where Zustand Fits Well

Zustand can fit well for:

- small global client state
- UI preferences
- transient view state shared across distant components
- action-only state modules
- vanilla non-React stores
- replacing isolated Effector usage if the project already uses Zustand

Strengths:

- small package
- simple API
- selector-based subscriptions
- no required provider for global stores
- works outside React via vanilla stores

Npm metadata inspected:

- `zustand@5.0.8`
  - unpacked size around 92 KB
  - MIT
  - peer dependencies are mostly optional depending on import path

### Where It Is Risky In This Wallet

Zustand does not itself solve:

- server-state invalidation
- stale network data
- cache lifetimes
- persisted-state migrations
- background request lifetimes
- block-triggered refresh
- API auth boundaries

The current problem is not "Redux syntax". The current problem is too much server/API state and side-effect orchestration in the global app store.

### PR #30's Zustand Problems

Specific PR concerns:

- `ui.store.ts` starts with a new persistence key and does not migrate old Redux-persist state.
- asset/balance/metadata stores reproduce many Redux responsibilities.
- TanStack Query writes into Zustand stores, causing duplicate ownership.
- migrating all app state at once makes behavior regressions hard to isolate.

### Objective Recommendation

Do not introduce Zustand as a full Redux replacement now.

Keep Redux for durable app/client state while moving server/API state out gradually. After that extraction, reassess whether the remaining durable state is small enough to:

1. stay in Redux,
2. move to local React/context state,
3. move to a tiny local external store,
4. or justify Zustand.

If Zustand is introduced later:

- use exact dependency pins
- use it for client state, not API cache mirrors
- provide migrations from current persisted Redux state
- keep server data in SWR/TanStack Query/domain hooks
- avoid running Redux and Zustand as two long-term app stores

## Alternative Libraries And Approaches

### Preferred Near-Term Alternative: Redux For Durable State, SWR For Server State

What it replaces:

- gradually replaces Redux server/API slices and epics
- keeps Redux for durable client settings and feature flags

Why it fits current architecture:

- SWR already exists.
- Current code already has domain hooks and API clients.
- It avoids adding TanStack Query while still solving many server-state problems.
- It reduces migration blast radius.

Migration complexity:

- low to medium per domain
- high only for balances/assets/metadata if migrated too early

Performance and bundle impact:

- no new runtime dependency
- potential eventual removal of Redux Observable/RxJS from frontend orchestration if all epics are removed

Maintenance impact:

- fewer global loading flags
- more colocated data fetching
- clearer ownership by domain

Security/dependency impact:

- lower supply-chain impact because no new state library is added

### Local External Store With `useSyncExternalStore`

What it replaces:

- parts of `TempleClientProvider`
- possibly the isolated Effector background store
- maybe selected wallet-state subscription logic

Why it fits:

- React already provides the subscription primitive.
- Wallet background state is not typical server cache state.
- It avoids adding Zustand only for a small external store.

Migration complexity:

- medium for wallet front state
- low for isolated background store, if interface is preserved

Performance impact:

- positive if selectors subscribe to narrow state
- no new dependency

Maintenance impact:

- more custom code than Zustand, but small and auditable
- good fit for security-sensitive wallet state

Security/dependency impact:

- no new dependency
- easier audit surface if implementation stays small

### Domain-Specific SWR Key Factories

What it replaces:

- ad hoc Redux action/epic pairs for simple reads
- some boot-time loading in `WithDataLoading`

Why it fits:

- similar conceptual model to TanStack Query but already installed
- lower migration risk
- explicit keys can encode account, network, chain ID, block level, asset slug, and filters

Migration complexity:

- low to medium

Performance impact:

- request dedupe and cache reuse
- no extra bundle dependency

Maintenance impact:

- improves invalidation discipline
- easier to test per domain

Security/dependency impact:

- no new dependency

### Zod For New Runtime Boundaries

What it replaces:

- `any[]` operation parameter acceptance
- scattered Yup schemas over time, when touched

Why it fits:

- Zod is already installed.
- Current `src/mavryk/api` already uses schemas.
- Runtime validation is valuable in background/intercom/API boundaries.

Migration complexity:

- low for new operation schemas
- medium if replacing existing Yup form schemas

Performance impact:

- small overhead at boundary validation points

Maintenance impact:

- stronger contracts
- fewer implicit `any` paths

Security/dependency impact:

- positive, no new dependency

### TanStack Virtual As A Standalone Performance Tool

What it replaces:

- full rendering of large token/manage-asset lists

Why it fits:

- independent of TanStack Query
- small package
- focused problem/solution

Migration complexity:

- low to medium per list

Performance impact:

- positive for large lists

Security/dependency impact:

- one small dependency; pin exact version

## Provider And Context Reduction Opportunities

### Priority 1: Remove Dead Or Effectively Dead Providers

#### `ContentPaperRefContext`

Current file:

- `src/app/layouts/context.ts`

Current finding:

- No meaningful usage found beyond definition.

Recommendation:

- Delete if confirmed unused.
- If a hidden usage exists, move ownership to the layout that needs it.

#### `ShortcutAccountSelectStateProvider`

Current files:

- `src/app/hooks/use-account-select-shortcut.ts`
- `src/lib/temple/front/provider.tsx`

Current finding:

- Provider is global.
- Verify whether shortcut account switch overlay is actually mounted.

Recommendation:

- If feature is inactive, remove provider and hook.
- If active, mount provider only around the overlay/shortcut handler.

#### no-op `usePushNotifications()`

Current file:

- `src/lib/temple/front/provider.tsx`

Recommendation:

- If still no-op, remove from provider.
- If planned, replace with an explicit feature TODO or implementation task.

### Priority 2: Localize Narrow Global Providers

#### `TzktConnectionProvider`

Current files:

- `src/lib/temple/front/tzkt-connection.tsx`
- `src/app/hooks/use-balances-loading.ts`
- `src/app/App.tsx`

Current finding:

- Its value is consumed narrowly by balance loading.

Recommendation:

- Move connection lifecycle into a balance/domain service or hook.
- Expose only the derived balance-loading behavior to the app.
- Keep global provider only if multiple unrelated features need the raw connection.

Note:

- The current project uses Tzkt naming for the connection, while PR uses Mvkt naming. Naming cleanup can be done later.

#### `NewBlockTriggersProvider`

Current files:

- `src/lib/temple/front/chain.ts`
- `src/lib/temple/front/provider.tsx`

Recommendation:

- Keep if multiple components register block callbacks.
- If the remaining use is narrow, replace provider with direct `useOnBlock`/domain-level subscriptions.

### Priority 3: Split Broad Wallet Providers

#### `TempleClientProvider`

Current file:

- `src/lib/temple/front/client.ts`

Recommended split:

- state subscription module
- action-only client hook
- confirmation lifecycle hook/store
- wallet specs storage hook

Do not perform this as a mechanical move. Preserve current behavior first and add tests around:

- unlock/lock
- account creation/import
- signing
- operation sending
- dApp permissions
- auth challenge and refresh
- confirmation lifecycle

#### `ReadyTempleProvider`

Current file:

- `src/lib/temple/front/ready.ts`

Recommended split:

- selectors for accounts/networks/settings
- side-effect hooks for selected account/network reconciliation
- authorization/contacts/KYC sync hooks
- toolkit/RPC creation

This can be done incrementally after `TempleClientProvider` is split.

## Dependency Cleanup Opportunities

### High Priority

#### axios

Current direct version:

- `axios@0.26.1`

Current risk:

- Current `yarn audit` reports multiple axios advisories.
- Old axios also enters transitively through unused/deprecated packages.

Recommendation:

- Upgrade axios in a dedicated PR.
- Replace/remove `@vespaiach/axios-fetch-adapter` usage:
  - `src/lib/apis/temple/endpoints/templewallet.api.ts`
  - `src/mavryk/api/client.ts`
- Use the current patched axios version at implementation time.
- Pin exact version.
- Add request tests for base URL, absolute URL handling, auth headers, timeout, and adapter behavior.

#### `@temple-wallet/youves-sdk`

Current finding:

- Appears only in commented-out code under `src/lib/apis/youves`.

Recommendation:

- Remove package and dead/commented Youves code if feature is not used.
- This also removes vulnerable transitive axios.

#### `@ledgerhq/hw-transport-http`

Current finding:

- No current source import found.

Recommendation:

- Remove if build/test confirms unused.
- This also removes vulnerable transitive axios.

#### `query-string`

Current finding:

- No current source import found.

Recommendation:

- Remove if build/test confirms unused.

#### `graphql-request`

Current finding:

- No current source import found.
- Current GraphQL usage appears to go through Apollo files.

Recommendation:

- Remove if build/test confirms unused.

### Medium Priority

#### `use-force-update`

Current files:

- `src/lib/woozie/history.ts`
- `src/app/a11y/RootSuspenseFallback.tsx`

Recommendation:

- Replace with a local hook or `useReducer`.
- Remove dependency.

#### Effector

Current file:

- `src/lib/temple/back/store.ts`

Recommendation:

- Replace only after higher-risk dependency work is complete.
- Prefer a tiny local store unless Zustand is adopted for other reasons.

#### Yup

Current usage:

- small number of form schemas/resolvers

Recommendation:

- Migrate opportunistically to Zod when touching those flows.
- Do not block architecture work on this.

### Low Priority / Separate Projects

#### React Hook Form v7

Recommendation:

- Separate migration project.
- Requires form-by-form behavior verification.

#### TypeScript 5.x

Recommendation:

- Separate compiler/tooling project.
- Current AGENTS.md says to verify pinned versions in `package.json`; current manifest pins TypeScript `4.5.5`.

#### Tailwind v4

Recommendation:

- Separate styling/build project.
- Requires visual regression checks.

## Security Considerations

### Current Audit Findings

`yarn audit --json --groups dependencies` on 2026-08-13 reported:

- total dependencies: 1885
- low vulnerabilities: 52
- moderate vulnerabilities: 185
- high vulnerabilities: 256
- critical vulnerabilities: 1

Important categories observed:

- axios advisories affecting current direct and transitive versions
- old axios through `@temple-wallet/youves-sdk`
- old axios through `@ledgerhq/hw-transport-http`
- nanoid advisories through direct/transitive packages
- js-yaml advisory through transitive packages

The exact fix versions should be checked at implementation time because this report is dated 2026-08-13 and advisories may change.

### Dependency Pinning

For wallet extension runtime dependencies, prefer exact pinned versions instead of broad ranges.

PR #30 adds broad ranges for important runtime packages:

- `@tanstack/react-query: ^5`
- `@tanstack/react-virtual: ^3`
- `zustand: ^5`

This increases supply-chain exposure. If any of these are adopted, pin exact versions and review lockfile diffs carefully.

### Preserve Current Auth And Intercom Hardening

Current branch contains newer auth/intercom work in:

- `src/mavryk/api`
- `src/lib/temple/back/actions.ts`
- `src/lib/temple/back/dapp.ts`
- `src/lib/temple/back/intercom-permissions.ts`

Do not replace this with PR #30 code.

Any wallet-client split must preserve:

- auth challenge handling
- auth token refresh
- auth wallet-address synchronization
- extension UI port checks
- dApp permission checks
- confirmation lifecycle constraints

### Operation Validation

Adopt current-compatible Zod validation for operation params.

The background/signing boundary should not accept unchecked `any[]` operation params. Runtime schemas should validate operation kind and required fields before estimation/sign/send behavior.

### Content Script Boundaries

Current branch already has important top-frame protections and `all_frames: false`.

Consider, but do not blindly adopt, PR #30's origin check:

- `evt.origin === window.location.origin`

This may improve safety but needs compatibility testing with supported dApps and injected script communication.

### Super Admin Private Key

Current files:

- `src/app/pages/ProVersion/utils/tezosSigner.ts`
- `src/lib/env.ts`

Current behavior references `SUPER_ADMIN_PRIVATE_KEY` from environment variables.

Recommendation:

- Verify whether this key is ever bundled into production extension builds.
- If the key enables privileged behavior, move signing server-side or hard-disable in production extension builds.
- If retained only for testnet/development, enforce explicit environment guards and build-time checks.

## Performance And Bundle-Size Considerations

### Redux Removal Is Not The First Optimization

Redux Toolkit has a larger installed footprint than Zustand, but replacing Redux wholesale is high risk.

The current bundle/performance problem is more likely to come from:

- unnecessary global data loading
- large list rendering
- stale/duplicated server caches
- dependency bloat from unused packages
- broad UI renders caused by wide context values

Do not optimize bundle size by replacing Redux before reducing server-state usage and dead dependencies.

### TanStack Query Adds Capability But Also Another Cache

If SWR remains installed, adding TanStack Query increases bundle and architecture surface.

Adopt only if:

- a domain needs features SWR does not cover well
- query cache is the actual source of truth
- the migration removes more complexity than it adds

### TanStack Virtual Is A Separate Decision

`@tanstack/react-virtual` is small and solves a clear rendering problem.

Adopt if:

- token/manage-asset lists can be large
- list rendering is measurable in performance traces
- row heights and keyboard/accessibility behavior are tested

### Lazy Images Are Low Risk

Use lazy image loading for:

- token logos
- collectible previews
- RWA artwork
- remote metadata images

This can reduce initial page weight without architecture churn.

### Boot-Time Loading Should Be Reduced

`src/app/WithDataLoading.tsx` currently starts many global loaders.

Recommended direction:

- keep must-have wallet/bootstrap state global
- move screen-specific fetches closer to screens
- use domain hooks with account/network-aware keys
- avoid dispatching dead actions

## Recommended Target Architecture

### Durable Client State

Keep in Redux for now:

- settings
- selected UI preferences
- persisted user ID / analytics ID
- feature opt-ins
- durable local-only app choices

Future option:

- After server-state extraction, reassess whether remaining Redux state is small enough to keep, localize, or move to a smaller store.

### Server/API State

Move gradually to domain hooks.

Preferred near-term implementation:

- SWR with typed key factories and domain-specific fetchers.

Possible later implementation:

- TanStack Query for selected domains only, if the domain needs stronger mutation/invalidation/cache controls than SWR.

Rules:

- One source of truth per domain.
- Do not mirror query results into a second global store.
- Query keys must include account, network, chain ID, relevant filters, and block level when data is block-sensitive.
- Avoid boot-time loading unless the app genuinely needs data globally.

### Wallet/Background State

Target:

- action-only wallet client hook
- selector-based wallet state reads
- small external store or existing provider state
- current auth/intercom preserved

Avoid:

- using generic server-state cache for vault/approval lifecycle
- copying background state into multiple global stores
- global request timeouts that conflict with confirmation UX

### Providers

Target provider stack:

- app environment
- Redux or eventual durable client-state provider
- routing
- wallet readiness/auth boundary
- dialogs

Move out of global root:

- narrow SignalR/balance connection provider
- shortcut account selection state if inactive
- content paper ref
- file-transfer provider
- no-op push notification hook

### Validation

Target:

- Zod schemas at external and intercom/background boundaries.
- Keep form schema migration separate.
- Avoid accepting `any` where dApps or background messages can influence operation behavior.

## Prioritized Migration Plan

### Phase 0: Do Not Merge PR #30

Outcome:

- PR remains reference material only.
- No direct cherry-picks except carefully reviewed small patches.

### Phase 1: Dependency And Security Cleanup

Recommended tasks:

1. Remove unused `@temple-wallet/youves-sdk`.
2. Remove unused `@ledgerhq/hw-transport-http`.
3. Remove unused `query-string`.
4. Remove unused `graphql-request`.
5. Replace `use-force-update` with a local hook.
6. Upgrade axios in a dedicated PR and replace `@vespaiach/axios-fetch-adapter`.
7. Re-run `yarn audit --groups dependencies`.

Why first:

- Reduces security exposure.
- Lowers dependency noise before architecture changes.
- Avoids adding new state libraries while known dead packages remain.

### Phase 2: Fix Existing Epics Drift

Recommended tasks:

1. Audit commented epics in `src/app/store/root-state.epics.ts`.
2. Remove dead dispatches or restore working epics.
3. For simple API reads, replace dead Redux actions with SWR/domain hooks.
4. Add tests or smoke checks for affected screens.

Why second:

- Current code has dispatches that may never resolve.
- This is a real bug/maintenance risk today.

### Phase 3: Provider Reduction

Recommended tasks:

1. Remove `ContentPaperRefContext` if confirmed unused.
2. Remove or localize `ShortcutAccountSelectStateProvider`.
3. Remove no-op `usePushNotifications()` call.
4. Move `TzktConnectionProvider` into balances domain if only balances need it.
5. Reassess `NewBlockTriggersProvider`.
6. Scope `FileTransferProvider` to import/export flows.

Why third:

- Small, reviewable changes.
- Improves root architecture without risky state-library replacement.

### Phase 4: Wallet Client Split

Recommended tasks:

1. Inventory all `useTempleClient()` call sites.
2. Split action methods from wallet state.
3. Keep current auth/API/intercom implementation intact.
4. Introduce selector hooks for wallet state.
5. Add tests around confirmation, signing, send, lock/unlock, account switching, and dApp flows.

Why fourth:

- High architectural value.
- Medium/high risk, so it should happen after easier cleanup.

### Phase 5: Server-State Extraction From Redux

Recommended order:

1. Exchange rates.
2. Swap tokens/dexes.
3. Buy-with-credit-card config/limits.
4. Advertising/promotions if still active.
5. Collectible/RWA details.
6. Token metadata.
7. Balances.
8. Custom assets/migrations.

Rules:

- Use existing SWR first.
- Consider TanStack Query only after a domain proves SWR is not enough.
- Never mirror server cache into Zustand.
- Preserve custom assets and persisted data during migrations.

### Phase 6: Optional Performance Work

Recommended tasks:

1. Measure list rendering cost.
2. Add virtualization to token/manage-asset lists if needed.
3. Add lazy loading to remote images.
4. Add Firefox/chrome bundle performance hints if useful.

### Phase 7: Separate Tooling/Form Upgrades

Recommended separate projects:

- React Hook Form v7 migration
- TypeScript 5 migration
- Tailwind v4 migration
- Jest/testing-library modernization

These should not be coupled to provider/state changes.

## Concrete Files And Areas That Would Need Changes

### Wallet Client Split

- `src/lib/temple/front/client.ts`
- `src/lib/temple/front/provider.tsx`
- `src/lib/temple/front/ready.ts`
- `src/lib/temple/front/index.ts`
- call sites using `useTempleClient()`
- `src/lib/temple/back/actions.ts`
- `src/lib/temple/back/dapp.ts`
- `src/lib/temple/back/intercom-permissions.ts`
- `src/mavryk/api`

### Provider Reduction

- `src/app/App.tsx`
- `src/lib/temple/front/provider.tsx`
- `src/lib/temple/front/tzkt-connection.tsx`
- `src/app/hooks/use-balances-loading.ts`
- `src/app/hooks/use-account-select-shortcut.ts`
- `src/app/layouts/context.ts`
- settings file-transfer provider usage
- `src/lib/temple/front/chain.ts`

### Server-State Cleanup

- `src/app/WithDataLoading.tsx`
- `src/app/store/root-state.epics.ts`
- `src/app/store/root-state.reducer.ts`
- `src/app/store/swap/*`
- `src/app/store/currency/*`
- `src/app/store/balances/*`
- `src/app/store/assets/*`
- `src/app/store/tokens-metadata/*`
- `src/app/store/collectibles*`
- `src/app/store/rwas*`
- `src/app/store/buy-with-credit-card/*`
- `src/app/hooks/use-assets-loading.ts`
- `src/app/hooks/use-balances-loading.ts`
- `src/app/hooks/use-metadata-loading.ts`
- `src/app/hooks/use-metadata-refresh.ts`
- `src/app/hooks/use-collectibles-details-loading.ts`
- `src/app/hooks/use-rwa-details-loading.ts`
- `src/app/hooks/use-long-refresh-loading.hook.ts`
- `src/app/hooks/use-advertising.hook.ts`

### Operation Validation

- `src/lib/temple/back/dryrun.ts`
- `src/lib/temple/back/actions.ts`
- tests around dApp/sign/send operation flows

### Dependency Cleanup

- `package.json`
- `yarn.lock`
- `src/lib/apis/youves`
- `src/lib/apis/temple/endpoints/templewallet.api.ts`
- `src/mavryk/api/client.ts`
- `src/lib/woozie/history.ts`
- `src/app/a11y/RootSuspenseFallback.tsx`

### Build/Tooling If Pursued Later

- `webpack/base.config.ts`
- `webpack/manifest.ts`
- `postcss.config.js`
- `tailwind.config.js`
- `tsconfig.json`
- Jest config and tests

## Final Recommendation

Use PR #30 as an architecture research branch, not as a merge candidate.

Adopt these ideas selectively:

1. Split wallet actions from wallet state selectors.
2. Add Zod validation for operation params at background/intercom boundaries.
3. Reduce narrow or unused providers.
4. Move server/API state out of Redux one domain at a time.
5. Clean unused and vulnerable dependencies before adding new state libraries.
6. Consider `@tanstack/react-virtual` for measured large-list rendering problems.
7. Keep current Mavryk API/auth/intercom work as source of truth.

Do not adopt these parts:

1. Wholesale Redux/SWR/Effector replacement.
2. Zustand as a full app-state replacement at this stage.
3. TanStack Query as a repo-wide replacement at this stage.
4. Query-to-Zustand mirrored caches.
5. Asset migration that can drop custom assets.
6. Persisted UI-state reset without migration.
7. Global 30 second intercom timeout.
8. Broad form, Tailwind, TypeScript, and state migrations in one PR.

The practical target is a smaller architecture with fewer global effects, fewer global providers, fewer dependencies, and clearer state ownership:

- Redux for durable client state until it is small enough to reassess.
- SWR/domain hooks for server state unless a domain proves it needs TanStack Query.
- A wallet action client separated from wallet state selectors.
- Zod at security-sensitive runtime boundaries.
- Exact pinned dependency upgrades and removal of unused vulnerable packages.

