# Code Deletion Log

## [2026-03-31] Post-Architecture-Migration Dead Code Audit

Analysis run after completing Redux→Zustand+TanStack Query and Effector→Zustand migrations.
All findings below are REPORT ONLY — no changes have been made.

---

### Summary of Findings

| Category | Count | Risk |
|---|---|---|
| Unused named selector hooks (re-exports) | 8 | SAFE |
| Unused UI state (BalanceMode) | 1 enum + 1 hook | SAFE |
| Dead commented-out imports | 1 file, 3 lines | SAFE |
| Orphaned `.selectors.ts` files (test automation) | 4 files | VERIFY |
| Stale phase comment in intercom-sync.ts | 1 comment block | SAFE |

No orphaned files, no remaining Redux/Effector/SWR imports, no dead Redux slices found.

---

### 1. Unused Named Wallet Selector Hooks — `src/lib/store/zustand/index.ts`

These 8 hooks are exported from `wallet.store.ts` and re-exported via `index.ts`, but have **zero consumers** anywhere in the codebase. The actual wallet state is accessed exclusively via `useWalletStore(s => s.field)` inside `src/lib/temple/front/client.ts`, which bypasses these named selectors entirely.

**File:** `src/lib/store/zustand/wallet.store.ts`
**Re-export file:** `src/lib/store/zustand/index.ts` lines 5–13

Dead exports:
- `useWalletStatus` — line 5 of index.ts, defined at wallet.store.ts
- `useWalletAccounts` — line 6 of index.ts
- `useWalletNetworks` — line 7 of index.ts
- `useWalletSettings` — line 8 of index.ts
- `useWalletReady` — line 9 of index.ts
- `useWalletLocked` — line 10 of index.ts
- `useWalletConfirmation` — line 11 of index.ts
- `useWalletHydrated` — line 12 of index.ts

**Note:** `useWalletSuspense` has 2 consumers — keep it.

**Recommended action:** Remove the 8 dead hooks from both `wallet.store.ts` and the corresponding re-export block in `index.ts`. The underlying `walletStore` and `useWalletStore` remain in use.

**Risk:** LOW. Confirmed zero grep hits across all `*.ts`/`*.tsx` excluding definition and index files.

---

### 2. Unused `BalanceMode` Enum and `useBalanceMode` Hook — `src/lib/store/zustand/ui.store.ts`

`BalanceMode` is defined as an enum, stored in UIState, and a selector hook is exported — but nothing outside `ui.store.ts` references any of these.

**File:** `src/lib/store/zustand/ui.store.ts`
- Line 23: `export enum BalanceMode { ... }`
- Line 35: `balanceMode: BalanceMode` field in `UIState` interface
- Line 56: `setBalanceMode: (mode: BalanceMode) => void` in `UIActions`
- Line 76: `balanceMode: BalanceMode.Fiat` in initial state
- Line 96: `setBalanceMode` action implementation
- Line 153: `export const useBalanceMode = () => useUIStore(s => s.balanceMode)`

**Recommended action:** Remove the enum, the state field, the action, the initial state value, and the selector hook. This is a self-contained block — no external consumers exist.

**Risk:** LOW. Full codebase grep for `BalanceMode` and `useBalanceMode` confirms zero hits outside `ui.store.ts`.

---

### 3. Commented-Out Dead Import Block — `src/lib/analytics/use-analytics.hook.ts`

Lines 3, 7, 8, and 14 contain commented-out imports from deleted Redux slices and utilities that no longer exist. The hook itself is marked as a mockup stub.

**File:** `src/lib/analytics/use-analytics.hook.ts`

```
line 3:  // import { useUserTestingGroupNameSelector } from 'app/store/ab-testing/selectors';
line 7:  // import { sendPageEvent, sendTrackEvent } from './send-events.utils';
line 8:  // import { useAnalyticsNetwork } from './use-analytics-network.hook';
line 14: // const userId = useUserIdSelector();
         // const rpc = useAnalyticsNetwork();
         // const testGroupName = useUserTestingGroupNameSelector();
```

`app/store/ab-testing/selectors` — the Redux ab-testing slice has been deleted. These are tombstone comments pointing to removed code.

**Recommended action:** Delete the commented lines. The active hook body (lines 12–48) is clean and used.

**Risk:** NONE. Commented code only.

---

### 4. Stale Phase Comment — `src/lib/store/zustand/intercom-sync.ts`

**File:** `src/lib/store/zustand/intercom-sync.ts` line 13

```
* Phase 5b: Components switch from useTempleClient() to useWalletStore() selectors,
```

This is a migration note from Phase 5b which is now complete. The comment references a future state that is now current.

**Recommended action:** Remove or update the phase comment to reflect that Phase 5b is complete.

**Risk:** NONE. Comment only.

---

### 5. Orphaned `.selectors.ts` Test Automation Files

These files export selector enums used for E2E test automation (`data-testid` strings). Four have **zero consumers**:

| File | Consumers |
|---|---|
| `src/app/layouts/PageLayout/Header.selectors.ts` | 0 |
| `src/app/templates/DelegateForm.selectors.ts` | 0 |
| `src/app/templates/About/About.selectors.ts` | 0 |
| `src/app/templates/DAppSettings/DAppSettings.selectors.ts` | 0 |
| `src/app/pages/Receive/Receive.selectors.ts` | 0 |
| `src/lib/notifications/components/item/notifications-content.selectors.ts` | 0 |

**Note:** These selectors files follow a project-wide convention (`*.selectors.ts` = test automation string enums). Before deleting, verify:
1. That the corresponding component does not use `data-testid` attributes referencing these enums directly via string literal rather than import.
2. That no E2E test suite outside `src/` imports them (e.g., a separate `e2e/` or `cypress/` directory).

**Recommended action:** Verify against any external E2E test repo before deleting. If no E2E suite references them, they are safe to remove.

**Risk:** CAREFUL. Cannot confirm absence of external E2E test consumers without checking the test runner separately.

---

### What Is Clean (No Action Needed)

- No Redux imports remain anywhere in `src/`
- No Effector imports remain anywhere in `src/`
- No SWR imports remain anywhere in `src/`
- No Redux-Observable epic files remain
- `throttled-storage.ts` is actively used by metadata, assets, and balances stores
- `persist-storage.ts` (`browserStorage`) has 2 consumers — keep
- `startIntercomSync` has 1 consumer — keep
- All assets/balances/metadata store selector hooks are actively consumed
- `ui.store.ts` remaining selectors are all consumed (verified)
- `StoredAsset` type not in `index.ts` re-exports — correct, it's an internal type
- `WalletState`/`WalletStore` type re-exports in `index.ts` — no external consumers found, but these are defensive type exports and low-risk to retain
- `vault.store.ts` (background store) — used internally by background actions, not consumed from UI

---

### Estimated Impact If All Safe Items Removed

- Lines of code removed: ~50–80 lines
- Files deleted: 0–6 (depending on selectors.ts verification)
- Bundle size reduction: negligible (types/enums tree-shake already)
- Risk: LOW for items 1–4, CAREFUL for item 5

---

### Testing Checklist (Before Applying)

- [ ] `yarn ts` — TypeScript type check passes
- [ ] `yarn build` — production build succeeds
- [ ] `yarn test` — all unit tests pass
- [ ] Visual check: wallet loads, balance displays, promotions work
- [ ] Verify no E2E test suite imports the 6 orphaned `.selectors.ts` files
