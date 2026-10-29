# Manual checks for the load-time work (Phases 1–6)

Branch `MAV-3974/architecture-load` @ `f643ea52`. This covers every user-visible change from the load plan (`load-plan.md`, numbers in `docs/load-performance.md`). Phase 4 changed no code.

## Setup

- Build both browsers from `MAV-3974/architecture-load`: `yarn build` (Chrome, `dist/chrome_unpacked`) and `yarn build:firefox`.
- Use a disposable test wallet: 3+ accounts, Basenet, some FA tokens, at least one collectible/RWA, some history. Never a production key.
- Keep a profile created with prod **2.0.0** (`origin/dev`) for the upgrade check.
- **Cold worker (Chrome):** `chrome://serviceworker-internals` (or `chrome://extensions` → the extension → "service worker") → **Stop**, then open the popup. Make sure no extension tab is open first: the keep-alive content script wakes the worker on any open tab.
- Watch the background and page consoles for errors throughout (DevTools on the popup; "Inspect views: service worker" in Chrome; `about:debugging` → Inspect in Firefox).

## What changed, and where it can break

| Phase | Change | Where to look |
| --- | --- | --- |
| 1 | Home no longer waits for delegate/baker lookups: the banner total, MAV row and stake/baker tag show placeholders and fill in when loaded | Home banner, MAV row, staking tag |
| 1 | Owner snapshot request starts at page entry (popup, fullpage, confirm, options) | Every page's first screen |
| 2 | Foreground owner snapshots are structurally shared; components re-render only when their slice changes; storage-change refreshes are coalesced | Anything that should update live: balances, metadata, asset lists, settings toggles, across two open pages |
| 3 | Every route except Unlock, Home/explore and Welcome loads on demand (spinner while loading, idle preload after Home) | Navigation to every route |
| 3 | node-forge loads only for Kukai backup import; Apollo loads on the first objkt request | Kukai import, collectible details |
| 3 | Async chunks split per library (model-viewer/three, ledger/libsodium, node-forge, Apollo) | 3D collectibles, Ledger |
| 5 | Native MAV balance request bypasses the HTTP cache | MAV balance freshness on Home |
| 6 | Cold unlocked start (Chrome) recovers the session with one decryption fewer | Popup after the worker was stopped while unlocked |

## Checklist (do both browsers unless marked)

### 1. First screens

- [ ] Popup, locked: Unlock appears, no blank flash or endless spinner.
- [ ] Popup, unlocked: Home appears with the Send button, tabs and cached token rows at once.
- [ ] Fullpage (`fullpage.html`), locked and unlocked: same as above.
- [ ] No wallet yet (fresh profile): Welcome appears; Create and Import wallet both open.
- [ ] Options page opens.

### 2. Cold start (Chrome only), the Phase 6 change

- [ ] Unlocked → stop the worker → open the popup: **Home** appears without asking for the password; balances update.
- [ ] Locked → stop the worker → open the popup: **Unlock** appears; unlocking works.
- [ ] Unlocked → stop the worker → open fullpage: Home appears.
- [ ] Repeat the unlocked case 3–4 times; it must never land on Unlock unexpectedly or show an error.
- [ ] Browser restart while unlocked: behaves as before (the session is browser-session scoped, so the wallet is locked after a full restart).
- [ ] Lock on recovery: while unlocked, delete the API auth token keys from `chrome.storage.local` (service-worker console; or wait until the access token is within 60 s of expiry), stop the worker, open the popup → **Unlock** (not Home), and unlocking works.
- [ ] Auto-lock setting (if enabled) still locks after its delay, warm and after a worker stop.

### 3. Unlock → Home, balances (d)

- [ ] Unlock with the password → Home; token rows show cached balances immediately, then fresh values within ~1 s.
- [ ] MAV row: placeholder first, then the balance; staked/delegated rows appear for a delegated account.
- [ ] Banner total: placeholder until staking stats load, never a partial total.
- [ ] Stake/baker tag appears once loaded.
- [ ] Send MAV from another wallet to the test account: the MAV balance updates without reopening (socket/refresh), and the fiat value follows.
- [ ] Wrong password shows the error; correct password still works afterwards.

### 4. Account and network switch

- [ ] Switch accounts: tokens, balances, collectibles and history change to the new account with no values from the previous one.
- [ ] Switch network (Basenet ↔ Mainnet and back): lists and balances re-scope; no stale rows.
- [ ] Create a new account and import one; both appear and load balances.
- [ ] Rename an account; the name updates in the header and in other open pages.

### 5. Live updates across pages (Phase 2)

- [ ] Open popup and fullpage at the same time. Toggle a token's visibility in Manage Assets in one: the other updates.
- [ ] Change a setting (currency, language, hide zero balances): every open page updates.
- [ ] Keep Home open for ~30 s while balances refresh: no flicker, typing in the token search stays responsive.

### 6. Routes (Phase 3 lazy pages)

Open each right after Home appears (before preload) and again after ~3 s (after preload). Expect at most a brief spinner, then the page; never a blank page or an error screen.

- [ ] Send, Receive, Swap/Buy if enabled
- [ ] Settings and every settings subpage (General, Address book/contacts, Reveal seed/private key, DApps, Networks, About, Remove account)
- [ ] Add asset, Manage assets (tokens and collectibles)
- [ ] Collectible page, RWA page
- [ ] Token page / explore (`/explore/<slug>`), history item details
- [ ] Create account, Import account (private key, seed, Kukai backup, watch-only)
- [ ] Connect Ledger (if a Ledger is available)
- [ ] Browser back/forward and the in-app back button between these pages
- [ ] Offline: open a route that has not loaded yet → error boundary shows; go back online and reopen → it loads.

### 7. Collectibles and RWA tabs

- [ ] Collectibles tab lists items with images; scrolling loads more.
- [ ] RWA tab lists items; details open.
- [ ] Collectible details (objkt data: creators, collection, attributes) load — first objkt request now loads Apollo on demand.
- [ ] A 3D/GLB collectible renders (model-viewer chunk).
- [ ] Adult/blurred content behaviour unchanged.

### 8. Long lists and scrolling

- [ ] Token list with all tokens shown (turn off "hide zero balances"): scrolls smoothly, search and sort work, keyboard ↑/↓/Enter in search works.
- [ ] History: scroll to load several pages (20 per page), filters work, end-of-list message appears.
- [ ] Collectibles/RWA infinite scroll loads further pages.

### 9. Send and operations

- [ ] Send MAV and an FA token: fee estimate, confirm, the operation appears as pending, then in history.
- [ ] Delegate/stake flow if used.
- [ ] Balance after sending updates on Home.

### 10. dApp confirm window

- [ ] Connect a dApp (Beacon/TZIP-10), approve: the confirm window opens and renders fully.
- [ ] Operation request from a dApp: the confirm window shows the operations JSON (react-json-view) and fees; approve and reject both work.
- [ ] Sign payload request works.
- [ ] Confirm window opened while the worker is cold (Chrome): still renders.

### 11. Imports that now load code on demand

- [ ] Import a Kukai backup file with its password (node-forge chunk): succeeds; wrong password shows an error.
- [ ] Ledger connect/sign (ledger chunks), if a device is available.

### 12. Offline cold start with cached data

- [ ] Use the wallet online, then go offline (DevTools Network → Offline, or disconnect).
- [ ] Chrome: stop the worker, open the popup unlocked → Home with cached tokens and balances; no endless spinner; errors are non-blocking.
- [ ] Firefox: close and reopen the popup → same.
- [ ] Come back online: balances refresh by themselves.

### 13. Upgrade from 2.0.0

- [ ] With a 2.0.0 profile (wallet, several accounts, hidden tokens, custom network/settings, contacts), load the new build over it (Chrome: "Update"/reload the unpacked extension at the same path; Firefox: reinstall the temporary add-on over the same profile).
- [ ] Unlock: accounts, names, hidden/shown tokens, settings and contacts are kept.
- [ ] Balances and metadata load; asset security (scam warnings) works; no "asset security unavailable" alert once online.
- [ ] Stop the worker and reopen (Chrome): still correct.
- [ ] Repeat once with the wallet **unlocked** at upgrade time: after the update you land on Unlock or Home, never an error.

## Known, not in scope

- API auth tokens sometimes reappear in storage shortly after Lock (pre-existing; affects unlock→Home timing only). Do not report as a regression of this work.
- `IntercomClient.subscribe`'s unsubscribe never removes subscribers (pre-existing).
- Firefox load times were not measured; the Firefox build will be updated later.

## If something fails

Note the browser, popup or fullpage, warm or cold worker, locked or unlocked, and the console error (no addresses, keys or balances). Each phase is a separate merge commit on `MAV-3974/architecture-load`, so a single phase can be reverted: Phase 6 is `f643ea52` (its change: `a98db455`).
