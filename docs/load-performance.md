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
