# Task 16: Query-owned server domains

## Refs and implementation

Started from clean `MAV-3974/architecture` at `b816dceb93075b5bb6b768dbfcb91884b7da8aff`; no Task 16 branch or equivalent work existed. Created `task-16-redem` from that local integration HEAD. The supplied Tasks 10–15 ancestry and baseline were reused; no fetch, dependency installation, PR #30 import, push or merge into `dev` was performed. Package version remains **3.0.0**. Final documentation/merge hashes are reported in the delivery message rather than embedded self-referentially here.

| Commit     | Domain/change                                                  |
| ---------- | -------------------------------------------------------------- |
| `0b5959d1` | Exchange-rate Query driver and all valuation consumers         |
| `1d8023e2` | Card catalogs, pair limits and form refresh                    |
| `e44f03ce` | Dormant notifications and durable read/viewed separation       |
| `49b52fb7` | Dormant swap token/DEX lists; quote path retained              |
| `bfb2e24b` | Dormant advertising and owner-backed dismissal                 |
| `649a0c46` | Account/placement-scoped dormant partner decisions             |
| `168fda54` | Card cache projection excludes obsolete catalog-input versions |
| `e95c02e7` | Fresh rate transports and read-only legacy fallback separation |
| `24e1187e` | Card late-response regression coverage                         |
| `2d74e307` | Cross-domain ownership guards                                  |

Final notification compatibility correction and persistence-test mock cleanup: `8d61b5db`. Imperative card limits/output ownership correction: `784da496`.

Reused Query **4.41.0**, the one stable foreground `DetailsQueryProvider` client, its readiness/PersistGate placement, existing transports/mappers, card limit calculation, owner command middleware and Task 9/15 key contracts. The provider's historical name remains; no provider/client/persistence adapter was added. New modules live beside their existing domain consumers rather than importing the reference architecture.

## Ownership and keys

All factories live in `src/lib/query-keys.ts`. Fixed public feeds do not gain artificial wallet/network dimensions: their endpoints and configured environments do not change with wallet selection. Account-dependent partner data explicitly includes the account and placement. No previous key's data is used as `keepPreviousData` across scopes.

| Domain            | Query keys                                                                                                                        | Production disposition and transport                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exchange rates    | `['exchange-rates', 'coingecko-mavryk', 'dodo-mav']`; `['exchange-rates', 'legacy-price-fallback']`                               | Active. Fresh CoinGecko Mavryk USD/all configured fiat quotes and validated Dodo GraphQL price mapping; fixed configured endpoints.                                   |
| Card catalogs     | `['buy-card', 'currencies', provider]`                                                                                            | Active while card consumers mount. Existing MoonPay, Utorg and AliceBob(false) transports and mappers. Provider-specific failures remain independent.                 |
| Card limits       | `['buy-card', 'limits', fiat, crypto, provider, [fiatCatalogEntry, cryptoCatalogEntry]]`                                          | Active after a catalog exists and pair symbols are nonempty. Existing `getUpdatedFiatLimits`; catalog min/max and other request-affecting fields are part of the key. |
| Card estimates    | `['buy-card', 'output', provider, amountOrNull, [inputCodePrecision, outputCodePrecision, fiatCatalogEntry, cryptoCatalogEntry]]` | Active only through existing imperative form refresh/edit callbacks. Shared Query limits gate preserved MoonPay/Utorg/AliceBob estimates.                             |
| Notifications     | `['notifications', 'extension', startFromTime]`                                                                                   | **Dormant**, matching the previously unregistered epic. Retained `/notifications` transport uses Extension platform and the durable cursor; it is not called.         |
| Swap lists        | Existing `['swap', 'tokens']`, `['swap', 'dexes']`                                                                                | **Dormant**, matching the previously unregistered epic. Existing fixed Route3 `/tokens` and `/dexes` transports remain available but are not called.                  |
| Advertising       | `['advertising', 'temple', 'active']`                                                                                             | **Dormant**. Existing `getAdvertisingInfo$` transport retained without calls. Banner and overlay remain commented out in PageLayout.                                  |
| Partner promotion | `['partner-promotion', 'optimal', '1729', account, variant]`                                                                      | **Dormant**. Existing Optimal decision transport uses fixed chain prefix `1729`, account and placement; no tracking or decision request is activated.                 |

`useDormantQuery` has `enabled: false`, infinite stale time, five-minute inactive cache retention, no retries or mount/focus/reconnect refetch, and an explicit rejecting query function. It exposes no `refetch`. Even invalidation or a client default query function cannot activate endpoints. Dormant domains have absence, success and error state in Query; their legacy view adapters return the established empty presentation defaults and no fabricated loading spinner.

## Exchange rates

`useLongRefreshLoading` now mounts the Query rate driver. It preserves immediate startup refresh and five-minute background polling. Readers are fetch-disabled observers. Inactive cache lifetime is five minutes; retries, focus and reconnect refetch are disabled. Query deduplicates concurrent requests and preserves the last successful combined result on any feed failure.

The three feeds still publish atomically. RWA prices override token prices on duplicate slugs; USD token values remain strings and fiat-per-Mavryk values remain numbers. Fiat selection remains in its existing browser preference storage. Valuation fallbacks and unit conversion remain unchanged.

Fresh helpers reuse CoinGecko transport, Dodo schema and mapping, and propagate failures without logging payloads or writing price storage. The retained Redux currency values seed the cache with timestamp zero, allowing immediate refresh. A separate one-time Query read supplies `MVRK_PRICE`/`RWA_ASSET_PRICES` fallback values when no result exists; those keys are not deleted or refreshed by the active path. Fallback data does not change the fresh query's error/success status, and a fallback storage-read failure is exposed as `fallbackError`. Existing exported cached transport wrappers retain their contracts but have no production callers. They are compatibility code, not parallel active fetchers.

Ported the currency selector, `lib/fiat-currency/core.ts`, SwapForm, BalanceGas and both current/other-account total-balance hooks. Sorting and other fiat consumers follow those shared hooks. No direct live Redux valuation read remains outside the one-way upgrade seed.

## Card data

Catalogs and limits use twenty-second stale time, five-minute inactive cache retention, no retries, and no focus/reconnect refresh. Existing form refresh cadence remains twenty seconds and explicit refresh invalidates only catalogs and the current pair, in that order. Request amounts, purchase-link submission, provider selection and form fields remain in their existing hooks; payment estimate responses now use Query without redesigning payment submission. Swap quotes remain outside this task.

Missing pairs retain `PAIR_NOT_FOUND_MESSAGE`; existing provider calculation/mapping and its HTTP-400 fallback behavior are reused. Helper errors become Query errors, retaining usable data on refresh failure. Loading adapters use actual fetching state, so a disabled dependent query is not an endless initial spinner.

Old selector names now derive view entities from Query. The all-pairs menu/imperative selection hook subscribes to the Query cache with batched external-store notifications and projects only entries matching the current provider catalog. It stores no second response cache. The form's Redux load/update dispatches and both card epics are removed. The imperative `usePaymentProvider` estimate path also uses the shared limit-query options through `fetchQuery`, removing its duplicate direct limit request and local fetched-output/error/loading state. Its Redux shape remains inert and blacklisted from persistence.

`useCardOutputQuery` keys each estimate by provider, amount, input/output code and precision, and provider catalog entries. Existing MoonPay fee adjustment, Utorg conversion and AliceBob estimation are preserved. Disabled reactive observers read the selected input key; existing debounced form callbacks explicitly fetch, with zero stale time, no retry/focus/reconnect fetching and five-minute cache retention. Invalid/absent amounts do not request estimates; zero remains zero and unavailable estimates use Query `null`, adapted to the form's `undefined`. Errors remain in Query and usable same-input estimates survive refresh failure. Late responses for earlier amounts cannot replace the selected amount. Purchase-link generation remains an explicit submission/mutation with its existing form state, not a reusable fetched cache.

## Dormant domains and durable choices

- **Notifications:** existing cursor, list order, news filtering, unread calculation and item lookups remain. Query can adopt retained list content as an upgrade seed; the list is never updated by fetched actions. Read/viewed choices are a separate persisted Redux `statuses` map. Existing item-read actions remain; the list component sends all cached IDs (including news hidden by the preference filter) with the new viewed action. The old view-all action still handles retained-list IDs. Reading an item and subsequently viewing it cannot downgrade Read to Viewed. News-enabled preferences remain owner-backed. The notification page's existing redirect is unchanged.
- **Swap:** list selectors now read Query; retained persisted lists are one-way upgrade seeds. Startup list dispatches and list reducer/epic branches are removed. Task 9's Redux `swapParams`, readiness, timeout/retry behavior, block refresh, quote keys and transaction execution are unchanged. The old quote epic remains unregistered as before; the live quote hook still owns orchestration.
- **Advertising:** removed the no-op loading hook/dispatch and obsolete epic/fetched reducer cases. Retained content may seed Query, but no surface is restored. The retained overlay uses a new dismissal action carrying its Query-read campaign name into the existing owner middleware. The no-argument skip action remains compatible with its legacy-name source; no live component submits it. Consent and last-seen ownership do not change.
- **Partner promotion:** removed no-op dispatching and obsolete epic/fetched reducer cases. The old loader hook becomes a scoped disabled observer. An unscoped legacy response cannot safely seed account/placement keys, so it is retained but unused; the existing blank promotion object remains a presentation fallback. Owner-controlled visibility choices and hiding timestamps remain authoritative. The Token placement hook remains dormant, and the commented token promotional surface stays commented out.

Activation of any dormant endpoint remains a future product decision. There is no unresolved decision blocking this behavior-preserving task. Activation will require explicit fetching gates (including consent/visibility where relevant), scoped transport integration and transport/refresh tests; merely toggling an epic registration is no longer a supported route.

## Lifetime, persistence and compatibility

Promise transports do not accept abort signals today. Requests may finish into their original scoped Query entry after a consumer changes pair; late results never replace the newly selected pair. Foreground provider teardown clears/cancels Query publication, without claiming that it aborts underlying HTTP. Global rate/catalog requests are intentionally independent of account/network selection. No request uses a dynamically selected wallet API context, and reserved `src/mavryk/api/**` is untouched.

Old action exports and root state shapes remain for compatibility and retained source payloads. Currency/card fetched handlers are inert; notification/advertising/promotion fetched handlers and swap-list handlers are removed. No production fetch-action submitter or result-to-Redux/Zustand writer remains for these domains. The legacy read seeds are one-way initialization, not synchronization loops. Root persistence registration, prefixes, blacklist and unrelated fields are unchanged; retained legacy data is not deleted.

Tasks 11/13/14 background ownership, hydration, serialization, durable flush/read-back, analytics identity/consent/readiness, asset/security caches, metadata, migration recovery, `assets-migrations@3.0.0`, historical entries and Web Locks are preserved. Task 15 provider/batch/leaf ownership, keys and null/error semantics are unchanged. No Task 12 marker waiver was reopened. No Tasks 17–20 ownership port or broader Phase 8 completion is claimed.

## Verification

Logs are outside the repository under `/tmp/task-16-*`.

| Check                                     | Result                                                                                                                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused domain/ownership checks           | Passed. Real QueryClient/React DOM hooks cover all six domains; transport boundaries are mocked.                                                                                                                                   |
| `yarn ts`                                 | Same 11 dependency declaration syntax diagnostics in Apollo, Babel traverse types and Lodash types.                                                                                                                                |
| Semantic comparison against starting HEAD | 434 diagnostics before and after, identical counts by file/code. Final changed-source comparisons reused the saved baseline.                                                                                                       |
| Full Jest plus affected/new suites        | 69 passing suites / same four baseline failing suites; 478 passing tests / same one failing test.                                                                                                                                  |
| Chrome production build                   | Passed initially and after the notification and card-output corrections; `chrome.zip` produced.                                                                                                                                    |
| Firefox production build                  | Passed after the notification and card-output corrections; `firefox.xpi` produced.                                                                                                                                                 |
| Scoped ESLint                             | No task-introduced errors. One pre-existing unresolved `@mavrykdynamics/taquito/dist/types/wallet/batch-operation` import in touched SwapForm, verified present at starting HEAD; existing/new assertion and hook warnings remain. |
| Source formatting                         | All changed source files pass Prettier.                                                                                                                                                                                            |
| Browser smoke                             | No connected browsers/apps; no installed-profile or live-endpoint smoke performed.                                                                                                                                                 |

The full Jest invocation initially reported **67 passing/five failing suites and 475 passing/one failing tests**. The extra suite was Task 13 persistence's obsolete mock of the removed notification epic. Removing that mock restored both tests in its targeted rerun. The notification hook suite also passed after preserving view-all behavior for filtered news. No second full Jest run or suppression was used; the reconciled totals above combine the full run, affected-suite reruns and the subsequently added passing card-output suite. The final card caller audit found and ported imperative limit/estimate fetching; only its affected tests, semantic check and both browser builds were repeated.

The unchanged failing suites are `basenet_kyc_onboard.spec.ts`, `src/lib/temple/back/store.test.ts`, `src/lib/temple/beacon.test.ts`, and `src/lib/utils/amounts/index.test.ts`. Full-run logs are `/tmp/task-16-final-{ts,jest,chrome,firefox}.log`; affected reruns use `/tmp/task-16-persistence-rerun.log`, `/tmp/task-16-notifications-review-test.log`, and `/tmp/task-16-final-chrome-after-review.log`. Final card-output checks use `/tmp/task-16-output-review-test.log`, `/tmp/task-16-semantic-output.log` and `/tmp/task-16-output-{chrome,firefox}.log`. Semantic reports are `/tmp/task-16-semantic-{before,after}.json` and `/tmp/task-16-semantic-final.log`.

Focused coverage includes shared fetching, enabled gates, absence/loading/success/error, key dimensions, invalidation, refresh failure retention, previous-pair late responses, imperative limit deduplication, scoped output estimates, obsolete catalog inputs, durable read-status separation, owner-backed dismissal and disabled endpoints. Structural guards establish that legacy fetchers are absent from root registration, fetched actions are inert and Query functions do not dispatch or write stores. Full Jest also exercises the prior-task suites; the repaired persistence test verifies security data, retained nested payloads and failed-read gating.

The compiler-host comparison restores changed/deleted starting sources and excludes new files against the same installed dependencies. It does not claim the full TypeScript command passes. Browser build success likewise does not replace installed-extension smoke testing.

## Documentation Update and next work

Updated AGENTS ownership/testing facts, Task 10's deferred Task 16 entry, Task 12's concrete compatibility inventory and Task 15's shared-provider scope. Ignored `arch-adjust/` descriptions are preserved. Task 17 still owns the asset/security-cache port; later tasks own metadata, balances and wallet/background changes. A populated test profile should validate valuation, card provider errors/refresh and account switching before release; dormant endpoint activation needs its own explicit decision and tests.

## Exact changed files

- `AGENTS.md`
- `docs/task-10-zustand-foundation.md`
- `docs/task-12-legacy-retirement-ledger.md`
- `docs/task-15-reactive-details-handoff.md`
- `docs/task-16-query-only-server-domains-handoff.md`
- `src/app/WithDataLoading.tsx`
- `src/app/hooks/use-advertising-promotion.query.test.tsx`
- `src/app/hooks/use-advertising-promotion.query.ts`
- `src/app/hooks/use-advertising.hook.ts`
- `src/app/hooks/use-exchange-rates.query.test.tsx`
- `src/app/hooks/use-exchange-rates.query.ts`
- `src/app/hooks/use-load-partners-promo.ts`
- `src/app/hooks/use-long-refresh-loading.hook.ts`
- `src/app/hooks/use-partners-promo.query.test.tsx`
- `src/app/hooks/use-partners-promo.query.ts`
- `src/app/pages/BuyWithCreditCard/BuyWithCreditCard.tsx`
- `src/app/pages/BuyWithCreditCard/hooks/use-form-inputs-callbacks.ts`
- `src/app/pages/BuyWithCreditCard/hooks/use-one-payment-provider.ts`
- `src/app/pages/Home/OtherComponents/MainBanner/BalanceGas.tsx`
- `src/app/pages/Home/OtherComponents/MainBanner/use-total-balance.ts`
- `src/app/store/advertising/actions.ts`
- `src/app/store/advertising/epics.ts`
- `src/app/store/advertising/reducers.ts`
- `src/app/store/advertising/selectors.ts`
- `src/app/store/buy-with-credit-card/epics.ts`
- `src/app/store/buy-with-credit-card/reducers.ts`
- `src/app/store/buy-with-credit-card/selectors.ts`
- `src/app/store/currency/actions.ts`
- `src/app/store/currency/epics.ts`
- `src/app/store/currency/reducers.ts`
- `src/app/store/currency/selectors.ts`
- `src/app/store/owned-ui.middleware.test.ts`
- `src/app/store/owned-ui.middleware.ts`
- `src/app/store/partners-promotion/epics.ts`
- `src/app/store/partners-promotion/reducers.ts`
- `src/app/store/partners-promotion/selectors.ts`
- `src/app/store/root-state.epics.ts`
- `src/app/store/swap/epics.ts`
- `src/app/store/swap/reducers.ts`
- `src/app/store/swap/selectors.ts`
- `src/app/store/task13-persistence.test.ts`
- `src/app/templates/SwapForm/SwapForm.tsx`
- `src/app/templates/advertising/advertising-overlay/advertising-overlay.tsx`
- `src/lib/apis/temple/endpoints/get-exchange-rates.ts`
- `src/lib/buy-with-credit-card/use-buy-with-credit-card.query.test.tsx`
- `src/lib/buy-with-credit-card/use-buy-with-credit-card.query.ts`
- `src/lib/buy-with-credit-card/use-card-output.query.test.tsx`
- `src/lib/buy-with-credit-card/use-card-output.query.ts`
- `src/lib/fiat-currency/core.ts`
- `src/lib/notifications/components/notifications/index.tsx`
- `src/lib/notifications/hooks/use-notifications.query.test.tsx`
- `src/lib/notifications/hooks/use-notifications.query.ts`
- `src/lib/notifications/index.ts`
- `src/lib/notifications/store/actions.ts`
- `src/lib/notifications/store/epics.ts`
- `src/lib/notifications/store/reducers.ts`
- `src/lib/notifications/store/selectors.ts`
- `src/lib/notifications/store/state.ts`
- `src/lib/query-keys.ts`
- `src/lib/query/server-ownership.test.ts`
- `src/lib/query/use-dormant-query.ts`
- `src/lib/swap/use-swap.query.test.tsx`
- `src/lib/swap/use-swap.query.ts`

## Task 17 resolution

[Task 17](task-17-assets-security-ownership-handoff.md) completes the asset/security handoff described above using this same provider/client. Query owns those requests, while their durable asset/security data stays with the background owner. All Task 16 active/dormant endpoint decisions, keys and compatibility fallbacks remain unchanged. No Task 18/19 metadata/balance ownership port or wider Phase 8 completion is claimed.

## Task 18 shared-provider extension

[Task 18](task-18-metadata-ownership-handoff.md) adds metadata orchestration to the existing foreground client. All active/dormant endpoint decisions and server-domain keys above remain unchanged. Metadata durable data remains owner-backed; this does not activate any dormant Task 16 endpoint or complete balance ownership.

## Task 19 balance ownership handoff

Current/other-account valuation keeps Task 16 Query rates and existing decimal/fiat conversion, but its balance selectors now read Task 19 owner snapshots. Rate/card keys, active/dormant endpoint dispositions and retained source handling are unchanged. See [Task 19](task-19-balances-ownership-handoff.md) for the current contract and verification.
