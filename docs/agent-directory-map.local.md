# Local Agent Directory Reference

Moved from AGENTS.md to reduce default context. Read only the relevant section when locating unfamiliar code. This is a navigation aid; verify current paths in the working tree. The mandatory ownership and safety rules remain in AGENTS.md.

## Architecture and Boundaries

Target architecture:

- `webpack/`: dynamic extension build configuration
- `src/`: all runtime extension source. Keep top-level `src/*.ts(x)` files as entrypoints and globals only:
  - entrypoints such as `background.ts`, `popup.tsx`, `fullpage.tsx`, `confirm.tsx`, `options.tsx`, `contentScript.ts`, `replaceAds.ts`, and `keepBackgroundWorkerAlive.ts` choose the execution surface
  - shared globals such as `main.css` and `*.d.ts` stay here because they are consumed across surfaces
  - feature logic should live in one of the folders below, not in new root-level files
  - `app/`: React presentation layer for popup, full-page, confirm, and options windows. It contains routing, page composition, UI hooks, and app state wiring. This is the main consumer of `lib/` domain services.
    - `ConfirmPage/`: confirm-window-only flow, selectors, and small supporting components/mocks for approval requests
    - `a11y/`: boot-time accessibility and UX wrappers such as font loading, i18n readiness, focus-outline handling, document backgrounds, and suspense fallbacks
    - `atoms/`: smallest reusable UI primitives and atom-level hooks
    - `compound/`: generic controls composed from atoms, still reusable across features
    - `consts/`: UI-scoped constants such as theme definitions and error-code maps
    - `hooks/`: app orchestration hooks that connect screens to store, routing, analytics, and async loaders; nested groups such as `AliceBob/`, `ads/`, and `useFeeValue/` hold feature-specific hook sets
    - `icons/`: app-local SVG icon set, including operation icons used by screens and templates
    - `interfaces/`: sparse UI-facing mock or integration contracts; currently used for advertising promotion mock data
    - `layouts/`: shared page shells, headers, dialog hosts, layout context, and layout utilities
    - `misc/`: static UI assets such as logos, illustrations, token placeholders, and baker images
    - `mocks/`: app-level mock data used by UI flows that is not owned by a single feature folder
    - `molecules/`: mid-level reusable UI compositions built on atoms
    - `pages/`: route-level screens such as onboarding, home, send, receive, settings, staking, collectibles, RWAs, and account-management flows. Each page folder is the primary boundary for a route from `PageRouter.tsx`
    - `storage/`: UI-facing extension storage helpers; currently focused on app update state
    - `store/`: app Redux store setup, provider, migrations, root reducer/epics, and feature slices such as `assets`, `balances`, `settings`, `swap`, `collectibles`, `rwas`, `advertising`, and `buy-with-credit-card`
    - `templates/`: larger reusable feature blocks used across pages, including flows such as `History`, `SendForm`, `SwapForm`, `Synchronization`, `SettingsGeneral`, and partner promotion UI
    - `types/`: app-scoped TypeScript contracts
  - `content-scripts/`: DOM-facing scripts injected into third-party pages. These should stay thin and browser-specific, delegating reusable logic to `lib/`
    - `replace-ads/`: ad replacement pipeline with rules lookup, DOM action planning in `ads-actions/`, view generation in `ads-viewes/`, metadata, and observation helpers
  - `lib/`: shared cross-surface domain and infrastructure layer. It contains wallet logic, browser bridges, API adapters, typed utilities, and reusable hooks/components used by UI, background, and content scripts
    - `ads/`: extension-side ad-provider helpers and rule-refresh logic shared with the ad replacement flow
    - `analytics/`: analytics hooks, event helpers, test-id helpers, and `readme-assets/` used by analytics docs
    - `apis/`: raw external integration clients grouped by provider (`tzkt`, `route3`, `temple`, `objkt`, `rwa`, `youves`, `moonpay`, `utorg`, etc.). Keep transport details here; feature orchestration belongs above this layer
    - `assets/`: token, collectible, and RWA asset helpers, migrations, search/sort helpers, standards, contracts, and typed collection hooks in `hooks/`
    - `avatars-initials-sprites/`: generated avatar sprite assets
    - `balances/`: balance fetching hooks and helpers shared by wallet views
    - `browser/`: typed wrappers around browser extension APIs and browser capability checks
    - `buy-with-credit-card/`: shared provider-selection, fiat-limit, and top-up helpers for debit-card flows
    - `e2e/`: types/constants that support automated end-to-end scenarios
    - `fiat-currency/`: fiat currency models, constants, and conversion helpers
    - `form/`: shared form validation helpers
    - `i18n/`: translation loading, formatting, persistence, and React bindings
    - `icons/`: shared icon registries and token/fiat icon mapping, including `assets/`, `emoji/`, and `fiat/`
    - `intercom/`: message transport between extension contexts such as page, content script, UI, and background
    - `keep-bg-worker-alive/`: worker/background keepalive scripts and helpers
    - `ledger/`: Ledger signing integration, foreground proxy bridge in `proxy/`, and low-level transport adapters in `transport/`
    - `local-storage/`: browser-side local storage access and migrations
    - `lock-up/`: startup lock checks and lock-state guards
    - `metadata/`: metadata fetching and normalization, including on-chain readers in `on-chain/`
    - `michelson/`: Michelson-related helpers and exports
    - `notifications/`: notification feature pieces, with UI in `components/`, enums in `enums/`, state in `store/`, and shared helpers in `utils/`
    - `popup-mode/`: popup-vs-full-page behavior switches
    - `route3/`: Route3 domain helpers, interfaces, and mapping utilities used above the raw Route3 API client
    - `store/`: shared Redux and persistence utilities consumed by `app/store`; `zustand/` contains guarded vanilla destinations with hydration, staging, flush, and read-back contracts. Task 11 owns UI preferences/root token metadata in one background context; foregrounds use its read-only client and commands. Assets, nested metadata/adult flags and promotion destinations remain inactive until their migration/handoff. Do not add competing destination adapters or Redux synchronization loops.
    - `swap-router/`: swap route configuration and shared swap-router UI/helpers
    - `swr/`: typed SWR wrappers
    - `taquito-fast-rpc/`: RPC caching helpers such as chain-id and entrypoint caches
    - `temple/`: core wallet domain boundary. `back/` runs the background service and vault, `front/` exposes client/providers/hooks for React, `activity/` and `history/` shape operation data, and top-level files cover contracts, repo access, signing, reset, network definitions, and shared types
    - `ui/`: cross-feature UI utilities, hooks, and components that are reusable outside `app/`
    - `utils/`: generic pure helpers and small domain-neutral utilities
    - `woozie/`: internal routing/history abstraction used by `app/PageRouter.tsx`
  - `mavryk/`: Mavryk-specific backend integration layer that sits beside the generic wallet domain in `lib/`
    - `api/`: typed Mavryk API client, auth/storage handling, and modules for contacts, tokens, RWAs, and history
    - `front/`: thin front-end helpers/hooks that adapt Mavryk data for app UI usage
- `public/`: extension static markups and generated locales
- `docs/`: code and app documentation

