# Load performance

Baseline and per-phase deltas for the load-time plan. Every phase appends a section; numbers are **median / p90 in ms over 10 runs** (one discarded warm-up run per scenario) unless stated otherwise.

## Method

- **Builds.** "dev" is `origin/dev` `e735af46` built in a detached worktree (`yarn install --frozen-lockfile && yarn build`). "branch" is the phase branch built with `LOAD_PERF_MARKS=true yarn build` (Chrome target). The flag only adds `window.__WE_LOAD__` marks (`src/lib/load-perf`); it is off in normal builds.
- **Runner.** A local puppeteer-core script (the copy already installed in `e2e/node_modules`; no new dependency) loads each unpacked build into a fresh profile of system Chrome via `installExtension`. It imports a disposable Basenet test seed, ensures 3 accounts, selects account 1 and Basenet, and waits 25 s for first discovery. Popups are opened with `page.triggerExtensionAction` (a real action popup, not a tab). Cold runs stop the service worker through CDP `Target.closeTarget` before opening. Locking uses an intercom `TEMPLE_LOCK_REQUEST`. The runner and seed stay outside the repository.
- **Build-agnostic endpoints** (DOM, injected `MutationObserver`, times from navigation start of the measured document):
  - `firstScreen`: first `Unlock/Password Input` or `Home/Send Button` in the DOM.
  - `tokenRow`: first `Assets/Asset Item Crypto Balance Button` (the row renders only once metadata exists).
  - `balancesFetched`: `responseEnd` of the later of the first TzKT native-account and token-balance requests (resource timing).
  - `unlock→home`: from the Unlock button click to `Home/Send Button`; `tokenRow`/`balancesFetched` in the unlock flow are also measured from the click.
  - `wall`: Node-side time from triggering the popup/navigation to `firstScreen` (popup includes window creation, ~290 ms).
- **Branch-only marks** (`window.__WE_LOAD__.marks`): `entry-start`, `entry-evaluated`, `owner-snapshot`, `redux-read`, `get-state`, `i18n`, `fonts`, `app-committed`, `redux-rehydrated`, `unlock-painted`/`welcome-painted`/`home-painted`, `token-row-painted`, `balances-fresh` (first settled current-account balance Query). In the Phase 0 data the component mark named `redux-rehydrated` actually measured the **first commit of the whole app tree**; it has since been renamed `app-committed`, and `redux-rehydrated` now marks the persistor bootstrap.
- **Long tasks** were collected with a buffered `longtask` observer; on this machine they were 0–52 ms total before the first screen in every scenario, so they are not a meaningful signal here.

## Phase 0 baseline (2026-10-28)

Environment: Apple M1, 16 GB, macOS 26.7.1, Google Chrome 156.0.8078.49 (headful). dev `e735af46`; branch `MAV-3974/load-phase-0` on `7e3ce634` (+ marks). Test account: 3 accounts, Basenet, 23 FA tokens with balance; Home renders 12 rows on dev and 14 on the branch (classification differs; not a load issue).

### Bytes (Chrome production build, normal flags)

|                         | dev `e735af46`                  | branch `7e3ce634`                       |
| ----------------------- | ------------------------------- | --------------------------------------- |
| Popup/fullpage eager JS | 7 scripts, 4.66 MB / 1.43 MB gz | 8 scripts, 4.73 MB / 1.45 MB gz (+1.5%) |
| Background JS           | 9 files, 3.64 MB                | 10 files, 3.71 MB (+2%)                 |
| Content script          | 25 KB                           | 26 KB                                   |

### Scenarios — first screen and post-unlock data

| ID  | Scenario                     | Metric               | dev         | branch      | Δ median |
| --- | ---------------------------- | -------------------- | ----------- | ----------- | -------- |
| a   | Popup, worker warm, locked   | firstScreen (Unlock) | 130 / 140   | 110 / 120   | **−20**  |
| a   | Popup, worker warm, unlocked | firstScreen (Home)   | 616 / 949   | 340 / 748   | **−276** |
| b   | Popup, worker cold, locked   | firstScreen (Unlock) | 198 / 207   | 224 / 227   | **+26**  |
| b   | Popup, worker cold, unlocked | firstScreen (Home)   | 703 / 1173  | 859 / 931   | **+156** |
| c   | Fullpage, warm, locked       | firstScreen (Unlock) | 75 / 80     | 80 / 88     | +5       |
| c   | Fullpage, warm, unlocked     | firstScreen (Home)   | 579 / 877   | 317 / 700   | **−262** |
| c   | Fullpage, cold, locked       | firstScreen (Unlock) | 170 / 180   | 200 / 201   | **+30**  |
| d   | Popup warm, unlocked         | tokenRow             | 616 / 949   | 612 / 970   | −4       |
| d   | Popup warm, unlocked         | balancesFetched      | 819 / 913   | 404 / 752   | −415     |
| d   | Popup cold, unlocked         | tokenRow             | 1097 / 1488 | 887 / 1181  | −210     |
| d   | Popup cold, unlocked         | balancesFetched      | 889 / 1267  | 1135 / 1519 | +246     |
| d   | Fullpage warm, unlocked      | tokenRow             | 610 / 931   | 533 / 914   | −77      |
| d   | Fullpage warm, unlocked      | balancesFetched      | 784 / 1120  | 373 / 736   | −411     |
| d   | Unlock flow (popup, warm)    | unlock→home          | 591 / 637   | 1031 / 1114 | **+440** |
| d   | Unlock flow (popup, warm)    | tokenRow             | 591 / 936   | 1187 / 1320 | **+596** |
| d   | Unlock flow (popup, warm)    | balancesFetched      | 359 / 810   | 1311 / 1655 | **+952** |

Wall time for the popup (trigger → firstScreen) is ~290 ms above the document-relative numbers on both sides (window creation).

### Branch startup breakdown (marks, median)

| Scenario                     | entry-start | entry-evaluated | owner-snapshot | get-state | fonts | app committed\* | first screen mark                         |
| ---------------------------- | ----------- | --------------- | -------------- | --------- | ----- | --------------- | ----------------------------------------- |
| Popup warm locked            | 47          | 72              | 93             | 97        | 104   | 107             | unlock 109                                |
| Popup warm unlocked          | 39          | 58              | 73             | 79        | 90    | 113             | home 113 (DOM Send button 340)            |
| Popup cold locked            | 95          | 160             | 206            | —         | 216   | 219             | unlock 223                                |
| Popup cold unlocked          | 96          | 161             | 210            | ~290      | 306   | 799             | home 801                                  |
| Fullpage cold locked         | —           | 136             | 180            | —         | 191   | 195             | unlock 199                                |
| Unlock flow (from nav start) | —           | 59              | 75             | —         | 84    | 87              | unlock 89; home 1195; balances-fresh 1726 |

\* Recorded as `redux-rehydrated` in this run (see Method).

### Findings and re-prioritisation

1. **The branch is not uniformly slower.** Warm unlocked Home appears ~260–280 ms earlier than dev (popup and fullpage), and fresh balances are fetched ~400 ms earlier when warm. Locked warm starts are equal within noise.
2. **The unlock flow is the largest regression (d).** From the Unlock click, Home takes +440 ms, the first token row +596 ms, and the first balance fetch +952 ms versus dev. Fresh balance requests start only after Home commits, so the time between unlock acknowledgement and Home commit sits directly on the critical path. This was not in the plan's phase list; it should be investigated first in Phase 1/5.
3. **Cold worker + unlocked (b) is +156 ms.** Marks show owner snapshot at ~210 ms and fonts at ~306 ms, then ~490 ms until the app tree commits: something under `TempleProvider` suspends for about half a second only when the worker is cold. Finding that suspension is the biggest single item for (b).
4. **Cold locked starts are +26–30 ms**, consistent with the slightly larger bundle (`entry-evaluated` ~160 ms in a cold popup) and the extra owner round trip (~45 ms between `entry-evaluated` and `owner-snapshot`). The plan's Phase 1 items 1–3 (start the owner request, GetState and Redux read before React) target exactly this gap.
5. **Owner → GetState → i18n → fonts is already short when warm** (~30 ms in total). Parallelising those gates (Phase 1.2–1.4) can only win tens of milliseconds warm; its value is in the cold path.
6. **Home's first commit is not "interactive".** `home-painted` (Home's layout effect) precedes the Send button by ~230 ms when warm, so a nested boundary inside Home suspends. The DOM endpoint is used for comparisons.
7. **Long tasks are not the bottleneck** on this hardware (0–52 ms before first screen). Byte reductions (Phase 3) will mainly help evaluation time (`entry-start`→`entry-evaluated`, 20–65 ms), so expected gains are modest.

Suggested order after Phase 0: (1) unlock→Home critical path and the cold-unlocked suspension, (2) Phase 1 waterfall items for the cold path, (3) Phase 5 post-unlock data, then Phase 2/3 only if re-measurement shows a remaining gap.

## Phase 1 (2026-10-28)

Branch `MAV-3974/load-phase-1` (from `MAV-3974/architecture-load` `f3cb073b`). Same machine and Chrome as Phase 0. "before" = `f3cb073b` built with marks in this session; cells marked † were not re-run this session (the final interleaved run was cut short) and show the Phase 0 medians instead. "dev" = this session where available, otherwise Phase 0 (†).

### What changed

1. **Home no longer suspends on staking/baker lookups** (`MainBanner`, token `ListItem`, `StakeTezosTag`). `useDelegate` (TzKT, ~210 ms) and then `useKnownBaker` (~210 ms) used to hold the whole Home page — Send button, tabs, token rows — behind `PageLayout`'s Suspense, serially. They now read with `suspense: false`; the banner total shows a same-height placeholder until staking stats load (a partial total is never shown), the MAV row shows a placeholder row, and the stake/baker tag appears once loaded. A first attempt with local Suspense boundaries was replaced: React 18's retry throttle still held the page commit for up to ~500 ms in some sessions.
2. **Owner snapshot request at page entry** (Phase 1 item 1). `lib/store/zustand/start-owned-ui` is imported first in popup/fullpage/confirm/options. An idle owner request queue now sends synchronously, so the request leaves before the bundle evaluates; `initializeOwnedUI()` adopts it once; StoreProvider gating, fallback and retry are unchanged.

### Measured and reverted (no gain)

| Item                                                                       | Result                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2. `GetStateRequest` at page entry (with a `StateUpdated` staleness guard) | A cold worker answers it only after its own init/session recovery; cold-unlocked Home got worse (222 → 325 ms). Reverted.                                              |
| 3. Redux root read concurrent with the owner request                       | The owner → `redux-read` gap was already 0–3 ms; first-screen within noise. Reverted. (Verified safe: the owner only reads `persist:temple-root*`, never writes them.) |
| 4. Start loading the 4 Aeonik weights at page entry (AwaitFonts kept)      | `get-state`→`fonts` gap shrank ~6 ms; first-screen medians within noise across two interleaved sessions. Reverted.                                                     |
| 5. Move `App.tsx` side-effect imports after first paint                    | Measured each module's own execution: ≤1 ms (cold and warm). Not worth moving; the lock-up check and keep-alive port should stay early anyway. No change.              |

### Results (median / p90 ms; firstScreen unless noted)

| ID  | Scenario               | Metric             | dev         | before        | after Phase 1 |
| --- | ---------------------- | ------------------ | ----------- | ------------- | ------------- |
| a   | Popup warm locked      | Unlock             | 114 / 129   | 107 / 120     | **95 / 122**  |
| a   | Popup warm unlocked    | Home (Send button) | 614 / 1064  | 343 / 722     | **131 / 197** |
| b   | Popup cold locked      | Unlock             | 198 / 212   | 226 / 281     | **202 / 227** |
| b   | Popup cold unlocked    | Home               | 700 / 1198  | 859 / 931 †   | **336 / 351** |
| c   | Fullpage warm locked   | Unlock             | 75 / 80 †   | 80 / 88 †     | **76 / 89**   |
| c   | Fullpage warm unlocked | Home               | 579 / 877 † | 317 / 700 †   | **119 / 126** |
| c   | Fullpage cold locked   | Unlock             | 170 / 180 † | 200 / 201 †   | **180 / 182** |
| d   | Popup warm unlocked    | tokenRow           | 635 / 1356  | 893 / 933     | **131 / 197** |
| d   | Popup warm unlocked    | balancesFetched    | 839 / 1173  | 693 / 781     | **415 / 749** |
| d   | Popup cold unlocked    | tokenRow           | 1129 / 1498 | 887 / 1181 †  | **336 / 351** |
| d   | Popup cold unlocked    | balancesFetched    | 903 / 1248  | 1135 / 1519 † | **633 / 953** |
| d   | Fullpage warm unlocked | tokenRow           | 610 / 931 † | 533 / 914 †   | **119 / 126** |
| d   | Unlock flow            | unlock→home ‡      | 591 / 637 † | 1031 / 1114 † | **179 / 199** |
| d   | Unlock flow            | tokenRow ‡         | 591 / 936 † | 1187 / 1320 † | **179 / 199** |
| d   | Unlock flow            | balancesFetched ‡  | 359 / 810 † | 1311 / 1655 † | **445 / 467** |

‡ **Unlock-flow numbers depend on auth state.** `lock()` clears the API tokens (`logoutAuth`), so an unlock normally pays challenge → sign → verify (~590 ms, awaited by `unlock()` before it responds; vault decrypt is ~120 ms). Background tracing showed the Phase 0 "+440 ms vs dev" was this handshake: on dev, the tokens **reappear 0.3–1.5 s after lock while the wallet is still locked**, so dev's next unlock skips auth. The same reappearance was later observed on the branch once Home rendered sooner, and the final run's unlock→home (179 ms) is consistent with tokens being present. Kept by decision: unlock still awaits auth. The token reappearance after lock is a separate auth/security issue, not fixed here.

Bytes are unchanged (popup/fullpage eager JS 4.73 MB / 1.45 MB gz; background 3.71 MB).

### Notes for later phases

- Cold-unlocked is bimodal across sessions (a ~470 ms mode came from the Suspense retry throttle described above); compare sessions interleaved, not across days.
- `IntercomClient.subscribe`'s unsubscribe uses `findIndex(callback)` (the subscriber is used as predicate), so subscribers are never removed. Pre-existing; not changed here.

## Phase 2 (2026-10-28)

Branch `MAV-3974/load-phase-2` (from `MAV-3974/architecture-load` `92786208`). Same machine and Chrome as Phase 0/1. Scope decision (load plan open question 2): **the owner contract change is deferred**. `ui-owner.contract.ts` and the owner are unchanged; only the foreground client `src/lib/store/zustand/ui-client.ts` changed.

### Measured first (before = `92786208` + temporary counters)

A temporary, uncommitted probe in `ui-client.ts` counted owner round trips, foreground parse time and render time (from `notify()` to the microtask after React's synchronous re-render) while Home stayed open for 20 s; CDP `Performance.getMetrics` gave page script time. 5 runs per scenario.

- **Startup snapshot is small and cheap.** The full snapshot is ~85 KB (assets 45 KB, metadata 36 KB, balances 3 KB, ui 0.3 KB); the first owner round trip is ~20 ms and its foreground parse ~3 ms (warm). Two-stage readiness (plan item 1) could save a few ms at most, so it was not built. The ~210 ms cold `owner-snapshot` is worker boot and hydration (Phase 4), not snapshot size.
- **Applying `changes[key].newValue` directly (item 2 option) is not safe**: owner metadata state merges predefined token metadata at hydration, so raw storage values differ from owner snapshots. Not built.
- **The real cost was re-rendering.** In 20 s on Home: 86 owner round trips, 41 of them storage-change refreshes, and **54 of the 86 responses were identical** to the previous one (the commanding page receives the new snapshot and then refetches it on `storage.onChanged`). Every response replaced the snapshot object, so all ~443 `useOwnedUI` subscribers re-rendered each time (~6.5 ms per response, ~40k hook calls). In the first 1.5 s after opening Home this was ~45 round trips and ~350 ms of main-thread parse and render.

### What changed

1. **Structural sharing.** Each parsed owner snapshot passes through `replaceEqualDeep` (already exported by the pinned `@tanstack/react-query`; no new dependency). Unchanged slices keep their identity; an identical response notifies nobody.
2. **Selector bail-out.** `useOwnedUI` now runs its selector inside `useSyncExternalStore`, so a component re-renders only when its selected slice changes. Selectors must return snapshot slices, primitives or module constants (all 24 existing call sites do).
3. **Coalesced storage-change refreshes.** A storage-change refresh that is still queued (not yet sent) absorbs later changes, because it reads the owner's state when it is sent. Commands, the first request, retries and fail-closed error handling are unchanged.

### Results

Main-thread work on Home over 20 s (median of 5; both sides carry the same probe):

| Scenario               | Metric                           | before  | after Phase 2 |
| ---------------------- | -------------------------------- | ------- | ------------- |
| Fullpage warm unlocked | owner round trips / refreshes    | 86 / 41 | **67 / 22**   |
| Fullpage warm unlocked | subscriber notifications         | 86      | **32**        |
| Fullpage warm unlocked | render after notify (ms)         | 649     | **187**       |
| Fullpage warm unlocked | `useOwnedUI` hook calls          | 40,509  | **10,909**    |
| Fullpage warm unlocked | page script time (CDP, ms)       | 807     | **389**       |
| Fullpage warm unlocked | first 1.5 s: parse + render (ms) | 366     | **127**       |
| Popup warm unlocked    | owner round trips / refreshes    | 86 / 41 | **68 / 23**   |
| Popup warm unlocked    | render after notify (ms)         | 588     | **198**       |
| Popup warm unlocked    | page script time (CDP, ms)       | 771     | **411**       |
| Popup warm unlocked    | first 1.5 s: parse + render (ms) | 347     | **123**       |

Foreground parse rose slightly (~105 → ~119 ms per 20 s) because it now includes the deep comparison.

Load endpoints (median / p90 ms; marks build without the probe, 5 runs; "before" = Phase 1 final run, 10 runs, previous session):

| ID  | Scenario               | Metric          | before (Phase 1) | after Phase 2 |
| --- | ---------------------- | --------------- | ---------------- | ------------- |
| a/d | Popup warm unlocked    | Home / tokenRow | 131 / 197        | 127 / 136     |
| d   | Popup warm unlocked    | balancesSettled | 351 / 430        | 347 / 354     |
| d   | Popup warm unlocked    | balancesFetched | 415 / 749        | 392 / 479     |
| c/d | Fullpage warm unlocked | Home / tokenRow | 119 / 126        | 121 / 127     |
| d   | Fullpage warm unlocked | balancesSettled | 332 / 345        | 342 / 402     |
| d   | Fullpage warm unlocked | balancesFetched | 403 / 784        | 394 / 757     |
| d   | Unlock flow            | unlock→home ‡   | 179 / 199        | 171 / 178     |
| d   | Unlock flow            | balancesSettled | 396 / 435        | 388 / 397     |
| d   | Unlock flow            | balancesFetched | 445 / 467        | 435 / 541     |

‡ Auth tokens were present for these unlocks (same as the Phase 1 final run). First-screen and balance endpoints are unchanged within noise: the gain is main-thread time during syncs (scrolling/typing responsiveness and headroom on slower machines), not an earlier first paint. Locked and cold scenarios were not re-run: startup is one owner response either way, and its parse was ~3 ms. Bytes are unchanged (popup/fullpage eager JS 4.73 MB / 1.45 MB gz; background 3.71 MB). The two client changes were measured together; refresh coalescing alone accounts for the round-trip reduction (41 → 22 refreshes).

### Deferred

Two-stage readiness and per-domain owner refresh (contract changes) are deferred: the measured startup gain on this profile is a few ms. Re-evaluate with a much larger profile, or with Task 21.

## Phase 3 (2026-10-28)

Branch `MAV-3974/load-phase-3` (from `MAV-3974/architecture-load` `2a9c126c`). Same machine and Chrome as Phase 0–2. Open question 4 answered: no bundle-analyzer dependency; bytes were attributed with webpack's built-in `--json` stats (production build, no repo change) plus terser-minified sizes of the emitted modules. `SOURCE_MAP=true` is ignored in production builds (`webpack/env.ts`), so the plan's source-map-explorer route would have needed a config change.

### Where the bytes went (measured first)

Popup, fullpage and confirm share the same eager chunks (each entry file is ~5 KB), so every page module was evaluated in all three. Minified share of the 4.73 MB eager JS:

| Candidate                                               | Eager min (gz)    | Reached through                                                      | Decision                                     |
| ------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| Non-first-screen routes                                 | ~0.43 MB          | `PageRouter.tsx` static page imports                                 | Lazy                                         |
| node-forge                                              | 308 KB (86 KB)    | `lib/temple/front/kukai.ts` (Kukai backup decrypt only)              | `import()` inside the decrypt                |
| Apollo + graphql                                        | 229 KB (82 KB)    | `lib/apis/objkt` (collectible details driver)                        | `import()` on the first objkt request        |
| Taquito + mavryk-domains + idna                         | ~615 KB (~137 KB) | `tzdns.ts`; its domain validator is synchronous (AddressChip, forms) | Not changed: would make validation async     |
| react-json-view                                         | 117 KB            | ConfirmPage `OperationsBanner` (renders immediately)                 | Not changed: would add a fallback to confirm |
| lodash (whole `lodash.js` via named imports, ~30 files) | 71 KB             | many modules                                                         | Not changed: mass edit for a small gain      |

Estimate before building: evaluation (`entry-start`→`entry-evaluated`) was ~20 ms warm and ~47 ms cold; routes alone (~9% of bytes) looked like noise, routes + node-forge + Apollo (~20%) like −10 to −25 ms cold.

### What changed

1. **Lazy pages without Suspense** (`lib/ui/lazy-page.tsx`). Every route except Unlock, Home (with `/explore`) and Welcome loads on demand; ConfirmPage is untouched (the confirm window never renders `PageRouter`). Route wrappers and the route table are unchanged; only the component references are lazy. A loaded page renders synchronously; a page that is not loaded yet renders the existing `RootSuspenseFallback` spinner and re-renders through a normal state update when its module arrives. `React.lazy` was not used: its re-render is a Suspense retry, and React 18 throttles a retry commit by up to ~500 ms when the page's own nested boundaries suspend in it (the Phase 1 failure mode). A failed chunk load goes to the error boundary; the next mount retries.
2. **Idle preload.** Once ready (not while locked), pages are loaded one per idle callback: Send, Receive, Settings, collectible/RWA pages, then the rest. While no wallet exists, ImportWallet and CreateWallet.
3. **node-forge** is imported inside the Kukai decrypt; **Apollo/graphql** moved to `lib/apis/objkt/client.ts`, loaded on the first objkt request (`fetchObjktCollectibles$`, `fetchCollectibleExtraDetails`). Request contracts are unchanged.
4. **`splitChunks.name` fix** (`webpack.config.ts`). The name function joined chunk names, so every async-only split got the same name `.split-chunk` and webpack merged them: node-forge, libsodium, model-viewer, Apollo and three.js landed in one ~2 MB group, loaded by any of them. Splits of named (entry) chunks keep their names, so eager chunk names are unchanged; async splits are now unnamed and per library (model-viewer/three, ledger/libsodium, node-forge, Apollo each separate).

### Results

Bytes (Chrome production build, normal flags; Firefox build has the same eager script count):

|                         | before (Phase 2)                | after Phase 3                              |
| ----------------------- | ------------------------------- | ------------------------------------------ |
| Popup/fullpage eager JS | 8 scripts, 4.73 MB / 1.45 MB gz | **6 scripts, 3.71 MB / 1.15 MB gz** (−22%) |
| Background JS           | 10 files, 3.71 MB               | 10 files, 3.71 MB                          |
| Content script          | 26 KB                           | 26 KB                                      |

Load endpoints (median / p90 ms, 5 runs). Both sides were run in this session: the Phase 2 build gave popup cold locked 179 ms against 202 ms in the Phase 1 table, a session drift as large as the expected gain, so the documented numbers were not used as "before".

| ID  | Scenario             | Metric                             | before (Phase 2) | after Phase 3 |
| --- | -------------------- | ---------------------------------- | ---------------- | ------------- |
| b   | Popup cold locked    | Unlock                             | 179 / 181        | **174 / 188** |
| b   | Popup cold locked    | evaluation (entry-start→evaluated) | 47               | **36**        |
| b   | Popup cold unlocked  | Home                               | 331 / 334        | **328 / 335** |
| b   | Popup cold unlocked  | evaluation                         | 48               | **35**        |
| c   | Fullpage cold locked | Unlock                             | 173 / 181        | **166 / 172** |
| c   | Fullpage cold locked | evaluation                         | 51               | **39**        |
| a/d | Popup warm unlocked  | Home / tokenRow                    | 127 / 136 §      | 120 / 125     |
| d   | Popup warm unlocked  | balancesSettled                    | 347 / 354 §      | 346 / 483     |

§ Phase 2 table (previous session). JS heap at the locked first screen fell from ~14.0 to ~12.6 MB (not GC-normalized).

Evaluation is 11–16 ms shorter in every cold scenario, but the first screen gains only 3–7 ms: after evaluation, a cold page waits for the worker (`owner-snapshot`, and `get-state` when unlocked), so the remaining cold cost is Phase 4. The confirm window loads the same smaller eager set. Not measured separately per item (routes, node-forge, Apollo); their byte shares are in the table above.

Navigation to a lazy route (fullpage unlocked, hash navigation, time until the new page shows, median of 5): after idle preload (3 s after Home) Send 28 vs 28 ms, Settings 12 vs 9, Receive 23 vs 23, no spinner. Navigating immediately after Home appears, before preload, costs +0–6 ms and shows the route spinner for a frame.

### Notes for later phases

- The cold first screen is now bounded by worker boot and session recovery, not page evaluation (Phase 4).
- Remaining eager byte candidates: tzdns/Taquito (~615 KB, needs async domain validation), react-json-view in the confirm window (117 KB), lodash per-method imports (71 KB).

## Phase 4 (2026-10-28)

Branch `MAV-3974/load-phase-4` (from `MAV-3974/architecture-load` `25cfbf9e`). Same machine and Chrome as Phase 0–3. **Outcome: no code change.** The one item built (plan item 3) showed no gain and was reverted; the other items were measured as negligible or blocked and were not built. Bytes are unchanged (popup/fullpage eager JS 3.71 MB / 1.15 MB gz; background 10 files, 3.71 MB).

### Fact check

- **Background chunks load eagerly in Chrome.** `webpack-target-webextension` (MV3 only) sets the entry's chunk loading to `import-scripts` and emits `__webpack_require__.f.i(<id>)` for every reachable async chunk at startup, before any module evaluates. All nine chunks are loaded on every cold start: `775.chunk.js` (1.5 MB, wasm-themis glue for the sync payload), `265`/`67`/`280`/`502`/`743`/`899` (ledger), `320` (IndexedDB assets migration) and `483`. The existing `import()` calls (`lib/temple/back/ledger.ts`, the vault's `wasm-themis`, `ui-owner.ts`'s IndexedDB migration) resolve against these already installed chunks, so they are safe in Chrome but defer nothing. Chrome only allows `importScripts` of new scripts during the first evaluation, so this cannot be made lazy.
- **Firefox differs.** `BACKGROUND_IS_WORKER` is false (MV2 background page); the plugin is not applied, so the same `import()` calls are real lazy script loads there, and `unlockFromSession` is skipped.
- **Owner hydration is half eager.** The four destination stores start reading storage when their modules evaluate (`destination-store.ts`); the migration readiness chain (`initialize()` × 4, flush, snapshot, read-back) runs on the first owner message. It does not await `Actions.init`, but shares the worker's event loop with it.

### Where the cold time goes (measured first)

A temporary, uncommitted probe recorded epoch-ms marks in the worker (`globalThis.__WE_BG_TRACE__`, read by the runner; no payloads) plus marks patched into a copy of the built `background/index.js`; the runner also returned the page's `timeOrigin`, so both sides are on one clock. Medians of 5 runs, ms from page navigation start:

| Step                                                              | popup cold locked | popup cold unlocked | fullpage cold locked |
| ----------------------------------------------------------------- | ----------------- | ------------------- | -------------------- |
| Page sends owner request (`entry-start`) / worker starts          | 81 / 84           | 79 / 88             | 81 / 85              |
| `index.js` loaded and compiled (first statement runs)             | 96                | 101                 | 98                   |
| Nine eager chunks loaded (`775` ≈ 4 ms of it)                     | 102               | 107                 | 103                  |
| Module evaluation done, `start()` called                          | 113               | 119                 | 115                  |
| First owner message handled                                       | 124               | 126                 | 127                  |
| Owner answers (migration chain ≈ 15 ms, snapshot ≈ 5 ms)          | 146               | 143                 | 141                  |
| Page has the owner snapshot                                       | 151               | 149                 | 150                  |
| GetState answered                                                 | 152               | **235**             | 152                  |
| First screen                                                      | 169               | 322                 | 170                  |

- **Worker script evaluation is ~29 ms** (load/compile 12, eager chunks 5, module evaluation 11).
- **No async work completes until evaluation ends.** A `storage.local.get` issued by the first module resolves only right after evaluation (117 vs 116); the four stores finish hydrating at 124, the same moment the first owner message is handled (125). The migration chain after that is ~8 serial storage round trips plus the snapshot read-back.
- **Cold unlocked is bound by session recovery** (127 → 235): ~22 ms of `storage.session` and IndexedDB reads for the session key, then three PBKDF2-SHA256 derivations (310,000 iterations: the check item, accounts, settings) at ~28 ms each. In this Chrome, three PBKDF2 derivations take ~84 ms whether serial or in `Promise.all`: WebCrypto runs them on one sequenced thread, so reading accounts and settings concurrently would gain nothing.
- The remaining cold-unlocked time after GetState (235 → 322) is foreground Home rendering, not the worker.

### Built, measured and reverted

| Item                                                                                                     | Result                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3. Owner readiness at boot: `startUIOwner` queues the four migration `initialize()` calls once, before any request (failures silent, retried by the first request) | Boot run finished at the same time the first-request run did before (popup cold locked `owner-migrated` 141 → 145, fullpage 135 → 141); first screen 169 → 174, 170 → 175, cold unlocked 322 → 319 (noise). The chain waits on store hydration, which ends when the message arrives anyway, so only ~1 ms could be won. Reverted with its tests. |

### Not built

| Item                                                                 | Reason                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2. Defer top-level work in the worker                                | Module evaluation totals 11 ms; deferring individual modules could win a few ms at most.                                                                                                       |
| Start session recovery concurrently with `Actions.init`              | ~8 ms on cold unlocked (2.5%, below session drift); `unlocked` must not run before `inited`, so it is an ordering risk for little gain. Declined by decision.                                    |
| Lazy background chunks                                               | Not possible in Chrome (see fact check).                                                                                                                                                       |
| Read accounts and settings concurrently during session recovery      | No gain: PBKDF2 does not overlap.                                                                                                                                                              |

### Remaining options (each needs an explicit decision; none is in Phase 4 scope)

- **Fewer session decryptions** (vault semantics): `recoverFromSession` decrypts the check item before accounts and settings; each decryption is one ~28 ms PBKDF2. Dropping or merging one would save ~28 ms on every cold unlocked start.
- **Parallel owner migration reads** (Task 11/13/17/19 owner change): the ~15 ms readiness chain is serial storage round trips on an already migrated profile; issuing the read-only checks concurrently might save ~5–10 ms on every cold start.
- **Smaller background bundle:** load/compile of `index.js` (2.1 MB) plus the eager chunks is ~17 ms per cold start.

## Phase 5 (2026-10-28)

Branch `MAV-3974/load-phase-5` (from `MAV-3974/architecture-load` `500fcb01`). Same machine and Chrome (156.0.8078.49) as Phase 0–4. Scenario (d): after unlock / on Home, token list with balances and metadata visible (cached, then fresh). The endpoint is the `balances-fresh` mark (first settled current-account balance Query, both native and tokens), measured from `home-painted`.

### Fact check

- **Item 1 (cached data first) was already done.** `token-row-painted` lands in the same commit as `home-painted` (within 1 ms) in popup warm, fullpage warm, the unlock flow and popup cold; cached owner balances and metadata render with Home, without a spinner. Nothing built.
- **Item 2 (serial fetch chains): no gating chain in code.** The drivers mount in Home's commit (`PageRouter` wraps the routed element in `WithDataLoading`); the balance Query functions start ~1 ms after `home-painted`, their `balances-start` reservations are the first owner commands in the queue, and REST balances are not gated on the TzKT socket. The chain was in the network (below).
- **Item 3 (non-visible work) does not compete.** Asset/security start commands queue behind the balance reservations; rates and collectible/RWA details call other hosts, and their only owner write (adult flags) lands after fresh balances; `useStorageAnalytics` runs a sub-millisecond localStorage scan into a no-op `trackEvent` (transport disabled); `useUserIdSync` is a bare selector. Parse + render of every owner response between Home and the balance acknowledgement totals ~40 ms. Not built.
- **Earlier `balancesFetched` numbers were misattributed.** The runner took the first `/accounts/<address>` request, which is the delegate lookup on Home (`lib/temple/front/baking`), not the native balance. `balancesSettled` (last balance-text change) also does not track freshness, because cached values usually equal fresh ones. Phase 5 uses the mark instead.

### Where the time went (measured first)

A temporary, uncommitted probe recorded owner commands (queued/sent/response/parsed/rendered by kind), the `syncBalances` phases, socket events and resource timing (paths only, addresses redacted). Popup warm unlocked, median ms after `home-painted`, 5 runs (the other three scenarios matched):

| Step                                                             | ms after Home       |
| ---------------------------------------------------------------- | ------------------- |
| Balance Query functions start (driver start; no gating waits)    | +1                  |
| Owner `balances-start` acknowledged, native transport starts     | +37                 |
| Tokens transport starts (its reservation queues behind native's) | +58                 |
| `tokens/balances` response                                       | ~+285 (~215 ms)     |
| Native `/accounts/<address>` response                            | **~+450 (~410 ms)** |
| `balances-sync` + `balances-cancel` acknowledged, re-render      | ~+35 → mark ~+485   |

Native was the last balance response in 20 of 20 probe runs. Cause: **Chrome's HTTP cache lock.** Home's delegate lookup sends the identical `GET /accounts/<address>` at commit, and Chrome holds a second in-flight request for the same URL until the first response arrives, then sends it. In a plain Chrome page, two identical concurrent GETs took 220/400 ms; with a different URL, `cache: 'no-store'` or a `Cache-Control: no-cache` request header both took ~220 ms. Server-side (curl over one HTTP/2 connection) identical requests are not serialized.

### What changed

- `fetchTezosBalanceFromTzkt` (`lib/apis/tzkt/api.ts`) requests `/accounts/<address>` with a `Cache-Control: no-cache` request header, so it bypasses the HTTP cache and is no longer held behind the delegate lookup. The request is still issued after the owner's `balances-start` reservation (Task 19 reserve-before-transport unchanged); URL, response shape and validation are unchanged; the delegate lookup keeps the default cache mode. Option chosen by decision over sharing one in-flight request (which could reuse a response begun before the reservation) or changing the baking lookup.

### Results

Same session, before = `500fcb01` marks build, after = this branch with marks; 5 runs per scenario (popup warm and cold unlocked: 10, from two passes). Median / p90 ms; balance rows are ms after `home-painted`.

| ID  | Scenario               | Metric                       | before     | after Phase 5 |
| --- | ---------------------- | ---------------------------- | ---------- | ------------- |
| d   | Popup warm unlocked    | Home / tokenRow              | 120 / 125  | 116 / 120     |
| d   | Popup warm unlocked    | native balance fetched       | 513 / 774  | **261 / 610** |
| d   | Popup warm unlocked    | balances-fresh               | 565 / 1117 | 644 / 699 §   |
| d   | Fullpage warm unlocked | Home / tokenRow              | 109 / 116  | 111 / 112     |
| d   | Fullpage warm unlocked | native balance fetched       | 528 / 795  | **254 / 600** |
| d   | Fullpage warm unlocked | balances-fresh               | 575 / 1091 | **328 / 991** |
| d   | Unlock flow ‡          | unlock→home / tokenRow       | 169 / 177  | 161 / 169     |
| d   | Unlock flow ‡          | native balance fetched       | 420 / 451  | **239 / 244** |
| d   | Unlock flow ‡          | balances-fresh               | 463 / 498  | **308 / 313** |
| d   | Popup cold unlocked    | Home / tokenRow              | 318 / 323  | 305 / 384     |
| d   | Popup cold unlocked    | balances-fresh               | 464 / 1438 | 660 / 1465 §  |
| a   | Popup warm locked      | Unlock (regression check)    | 88 / 100   | 83 / 114      |
| d   | All unlocked, pooled   | balances-fresh (n = 30 / 24) | 474 / 1117 | **365 / 991** |
| d   | All unlocked, pooled   | balances-fresh p25 / p75     | 459 / 1050 | **316 / 655** |
| d   | All unlocked, pooled   | runs under 400 ms            | 0 of 30    | **13 of 24**  |

‡ Auth tokens were present for every unlock (`authKeysBefore`), as in the Phase 1/2 final runs. One "after" unlock run and one runner start (worker did not stop) failed for harness reasons and were excluded/re-run.

§ **Network variance dominates the per-scenario medians.** About 15% of TzKT requests near Home stall ~350 ms (before 19 of 120, after 13 of 84: unchanged by this change). A run whose native or tokens balance request stalls settles at ~640–700 ms on both builds; without a stall, fresh balances settle at ~320–380 ms after the change versus ~460–580 ms before (the lock). Runs above ~1 s on both sides are runs where the socket's `Subscribed` refresh arrived (~+700 ms) while the first fetch was still in flight, so the mark waits for the follow-up fetch (existing `refreshBalances` semantics). The pooled rows are the reliable comparison.

Bytes are unchanged (popup/fullpage eager JS 3.71 MB / 1.15 MB gz; background 3.71 MB).

### Not built

| Item                                                                     | Reason                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Paint cached data first                                               | Already the case (above).                                                                                                                                                                                       |
| 3. Defer collectible/RWA details, rates, storage analytics, user-id sync | Measured as not competing with the first fresh balances (owner queue order, other hosts, no-op analytics); expected gain ≈ 0.                                                                                   |
| Parallel `balances-start` reservations for native and tokens             | Tokens' reservation waits ~20 ms behind native's in the serial foreground owner queue; changing that is an owner/intercom ordering change. Tokens is now usually the critical path, so this is the next ~20 ms. |
| Skip the `Subscribed` follow-up refresh                                  | It closes the gap between the REST snapshot and the socket subscription (correctness); it only affects runs where the first fetch is slow.                                                                      |
## Phase 6 (2026-10-28)

Branch `MAV-3974/load-phase-6` (from `MAV-3974/architecture-load` `287046db`). Same machine and Chrome (156.0.8078.49) as Phase 0–5. Phase 6 was optional: every candidate was re-measured or re-estimated first, and only one was built (by decision). Firefox profiling was skipped by decision (the Firefox build will be updated later).

### Measured first

| Candidate                                                                          | Measurement                                                                                                                                                                                                                                                                                                                                                                                                         | Estimated gain                                                                                                        | Decision                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Virtualize the Home token list                                                     | Temporary React Profiler probe (profiling React build, uncommitted), popup and fullpage warm unlocked, 5 runs each, 8 s on Home, 14 rows: list mount ~6 ms (~0.43 ms per row, ~60% of Home's ~10.5 ms mount); ~50 list commits totalling 130–170 ms, two thirds in the first second; largest single commit ~10 ms; no long tasks. History already pages 20 items per request; Collectibles/RWA use infinite scroll. | ~3 ms at Home paint, nothing on the load endpoints. Linear projection to 100 tokens: ~40 ms mount, ~70 ms per update. | Not built: negligible on this profile (no many-token profile exists); needs a new dependency or hand-rolled windowing inside page scroll, and off-screen rows would leave the DOM (e2e test ids). |
| Dedupe packages across popup and background                                        | Webpack `--json` stats (Phase 3 build; module graph unchanged since): 0 packages bundled from more than one path in any compilation. `resolve.modules` is pinned to the root `node_modules` (`webpack/base.config.ts`), so each bundle holds one copy of every package by construction. Popup and background are separate JS contexts and cannot share a copy.                                                      | 0                                                                                                                     | Nothing to do; no lockfile change.                                                                                                                                                                |
| tzdns/Taquito off the eager path (~615 KB)                                         | Scaled from Phase 3 (−20% eager bytes gave −11–16 ms cold evaluation, −3–7 ms first screen)                                                                                                                                                                                                                                                                                                                         | ~2–6 ms first screen                                                                                                  | Not built: would make domain validation async.                                                                                                                                                    |
| react-json-view in the confirm window (117 KB) / lodash per-method imports (71 KB) | 3% / 2% of eager bytes                                                                                                                                                                                                                                                                                                                                                                                              | ~1–2 ms / <1 ms evaluation                                                                                            | Not built.                                                                                                                                                                                        |
| Parallel owner migration reads                                                     | Phase 4 figure                                                                                                                                                                                                                                                                                                                                                                                                      | 5–10 ms per cold start, below the ~20 ms session drift                                                                | Not built.                                                                                                                                                                                        |
| Parallel `balances-start` reservations for native and tokens                       | Phase 5 figure                                                                                                                                                                                                                                                                                                                                                                                                      | ~20 ms on fresh balances (~6%), below the TzKT stall noise; needs ~20+ pooled runs per side to show                   | Not built: owner-queue ordering change for a gain that is hard to verify.                                                                                                                         |
| Fewer session decryptions on cold unlocked                                         | Popup cold unlocked, this session: Home at 320 ms, `get-state` 86 ms after `owner-snapshot` (three serial ~28 ms PBKDF2 derivations: check item, accounts, settings)                                                                                                                                                                                                                                                | ~28 ms per cold-unlocked Chrome start                                                                                 | **Built** (by decision).                                                                                                                                                                          |
| Firefox (`build:firefox`)                                                          | Not measured: the runner needs Chrome-only APIs (action popup trigger, service-worker targets, CDP). A WebDriver BiDi runner could cover fullpage warm and the unlock flow, not the popup or a cold background.                                                                                                                                                                                                     | Unknown                                                                                                               | Skipped by decision; the Firefox build will be updated later.                                                                                                                                     |

### What changed

- **Session recovery decrypts one item less** (`lib/temple/back/vault/index.ts`, `actions.ts`). `Vault.recoverFromSession` now validates the saved session key by decrypting the accounts item instead of the check item first (a wrong key fails AES-GCM authentication the same way), and returns `{ vault, accounts }`; `unlockFromSession` uses those accounts instead of decrypting them again. A key that cannot decrypt the accounts still removes the session and leaves the wallet locked. The lock-on-recovery check, settings decryption, the password unlock path (`Vault.setup`, which still verifies the check item), storage format and key names are unchanged. Semantic difference (accepted by decision): a corrupt or missing accounts item with a valid session key now drops the session and shows Unlock, where it used to throw inside the unlock queue. Chrome only; Firefox's background page does not recover from the session.

### Results

Same session, before = `287046db` marks build, after = this branch with marks. Cold scenarios count only truly cold runs (`owner-snapshot` more than 20 ms after `entry-evaluated`; the runner's worker stop sometimes left a warm worker: before 6 of 8, after 5 of 8 cold). Median / p90 ms from navigation start.

| ID  | Scenario                           | Metric                                            | before    | after Phase 6 |
| --- | ---------------------------------- | ------------------------------------------------- | --------- | ------------- |
| b   | Popup cold unlocked (n = 6 / 5)    | Home (first screen)                               | 320 / 330 | **295 / 307** |
| b   | Popup cold unlocked                | session recovery (`get-state` − `owner-snapshot`) | 86 / 87   | **54 / 56**   |
| b   | Popup cold unlocked                | `owner-snapshot`                                  | 151 / 160 | 154 / 164     |
| a   | Popup warm locked (n = 10, pooled) | Unlock (regression check)                         | 78 / 92   | 87 / 89 §     |

§ Not a regression: the foreground bundles of the two builds are byte-identical (only `background/index.js` differs), and a warm worker never runs session recovery. Both builds show the same two modes (~77 and ~89 ms) at the `AwaitFonts` gate (`get-state` → `fonts`); the second interleaved pass gave 80 / 92 before and 82 / 89 after.

Bytes are unchanged (popup/fullpage eager JS 3.71 MB / 1.15 MB gz; background 10 files, 3.71 MB; content script 26 KB).

### Notes for later

- Token-list virtualization is worth re-evaluating only with a profile of ~100+ tokens. The list re-renders ~50 times in the first seconds on Home (balance, delegate and metadata updates per row); fewer row re-renders would help before windowing does.
- Firefox remains unmeasured on the branch.
