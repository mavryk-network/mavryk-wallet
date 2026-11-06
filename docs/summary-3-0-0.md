# Mavryk Wallet 3.0.0 — release summary

PR [#48](https://github.com/mavryk-network/mavryk-wallet/pull/48): `MAV-3974/architecture` → `dev`. Head `6845c1d8`, 72 non-merge commits, 433 files (+24,000 / −3,776). Prepared 2026-10-29.

3.0.0 replaces 2.0.9, which is what users have installed today. Almost all use is on Basenet; Mainnet is rare, and users only run the two built-in RPCs.

## TL;DR

- **The state layer was rebuilt.** Persistent wallet data (UI preferences, asset lists and statuses, metadata, balances) moved from Redux to one background-owned Zustand store. Data fetched from servers moved to TanStack Query. Unrelated domains stay in Redux under a new root key.
- **The upgrade from 2.0.9 is migrated and verified on a real Basenet profile.** One data-loss bug was found and fixed (`19488fff`), and an anonymized 2.0.9 profile is now a regression test (`92d0e978`).
- **Keys and encryption formats did not change.** The vault storage format, password check, encryption, session handling, contacts encryption and API auth are byte-identical to 2.0.9. The vault has two small behaviour changes, described under [Security-sensitive changes](#security-sensitive-changes).
- **Before releasing, the KYC signer key needs a decision.** 2.0.9 shipped the super admin private key in its public bundle. 3.0.0 removes that path, but the deploy workflow now expects a `TESTNET_KYC_SIGNER_PRIVATE_KEY` secret that doesn't exist yet. See [KYC signer key](#kyc-signer-key-action-required).

## What changed

### Architecture and state

| Area | Change | Reference |
|---|---|---|
| Zustand foundation | Durable stores (`zustand-ui`, `zustand-assets`, `zustand-metadata`, `zustand-balances`) owned by the background. Foregrounds read snapshots and send commands. Hydration gate before render. | [Task 10](task-10-zustand-foundation.md) |
| UI preferences / identity | Migrated from the Redux root into `zustand-ui`; analytics ID adopted once and stays behind consent | [Task 11](task-11-legacy-ui-handoff.md) |
| Assets, adult flags, promotion | The 6 nested Redux keys (`persist:root.*`) migrated into the owner | [Task 13](task-13-legacy-assets-handoff.md) |
| IndexedDB assets | Migration through the owner with Web Locks; recorded as `assets-migrations@3.0.0` | [Task 14](task-14-indexeddb-assets-handoff.md) |
| Collectible/RWA details | Reactive batched Query cache, scoped by account, chain and API network | [Task 15](task-15-reactive-details-handoff.md) |
| Server domains | Exchange rates, card catalogs and limits in Query; notifications, swap lists, advertising and partners as dormant Query readers | [Task 16](task-16-query-only-server-domains-handoff.md) |
| Scamlist/whitelist | Owned by the background asset owner, with an explicit adoption marker | [Task 17](task-17-assets-security-ownership-handoff.md) |
| Metadata | Scoped records with owner-issued revisions; legacy unscoped records kept as fallback | [Task 18](task-18-metadata-ownership-handoff.md) |
| Balances | `zustand-balances` with exact scoped records over the legacy fallback | [Task 19](task-19-balances-ownership-handoff.md) |
| Legacy retirement | Inventory only. No 2.0.9 key is deleted in 3.0.0. | [Task 12](task-12-legacy-retirement-ledger.md) |

### Product and bug fixes

- **History:** purchase, refund, bridge and mint operation types, token history and pagination/filters.
- **RWAs:** pricing (market price, last sale, market value). `/assets` defines which assets are RWAs, with wUSDT kept as a token. See [RWA classification](rwa-classification-wallet-lifecycle-fix.md).
- **Home, staking and confirmations:** ported Home bug fixes and hardened stake success flows. Fixed the asset selector records, the confirmation overlay transition, the account initialization bug and the add-asset top bar.
- **Swap:** quotes refresh per block. The swap route is still disabled.
- **Intercom:** requests now time out (30 s by default, per-type values) and raise typed timeout/disconnect errors.
- **Pro/KYC:** fixed a KYC production bug, improved error messages, and moved signing to the testnet signer described below.

### Load-time performance (Phases 0–6)

- **What changed:**
  - Home no longer waits on staking and baker lookups.
  - The owner request now starts at page entry.
  - Re-render storms during syncs are gone.
  - Routes, node-forge and Apollo are lazy-loaded.
  - The native balance request bypasses the HTTP cache.
  - Session recovery does one decryption less.
- **Result:** the cold unlocked popup shows Home in about 295 ms (was 320 ms), and session recovery takes about 54 ms (was 86 ms).
- **Opt-in marks:** `LOAD_PERF_MARKS=true yarn build`; off by default.
- **Details:** [load-performance.md](load-performance.md).

### Build, CI and dependencies

- **CI:** new `ci.yml` workflow for PRs to `dev`, `MAV-3974/architecture` and `MAV-3979/book-scoping`. Frozen install, blocking `yarn ts` and `yarn test`, advisory lint.
- **Dependencies:** runtime versions pinned exactly (no `^` ranges). New: `zustand` 5.0.11 and `@tanstack/react-query` 4.41.0. TypeScript stays pinned at 4.9.5.
- **Build environment:** only an allowlist of variables is inlined into the bundle, and `SUPER_ADMIN_PRIVATE_KEY` is blocked ([webpack/dotenv.ts](../webpack/dotenv.ts)).
- **Manifest:** changes are listed under [Security-sensitive changes](#security-sensitive-changes).

## Storage migration 2.0.9 → 3.0.0

| 2.0.9 storage | 3.0.0 behaviour |
|---|---|
| `persist:temple-root` (Redux root) | Read once, used only as a fallback, never written. Live Redux data moves to `persist:temple-root-task11`. |
| `persist:root.assets`, `.collectibles`, `.rwas`, `.partnersPromotion`, `.collectiblesMetadata`, `.rwasMetadata` | Copied into `zustand-assets`, `zustand-metadata` and `zustand-ui`. The originals are left untouched as rollback snapshots. |
| Token metadata (in the root) | `zustand-metadata.tokensMetadata`; it covers tokens that TzKT has no metadata for |
| Balances (in the root) | Adopted into `zustand-balances.legacy` |
| IndexedDB `TempleMain.accountTokens` | Already emptied by 2.0.x (`assets-migrations@1.18.2`). 3.0.0 records `assets-migrations@3.0.0`. |
| Vault records, `network_id`, API sessions, contacts (backend) | Unchanged |

Properties of the migration:
- It runs in the background owner at service-worker start, before unlock.
- It marks itself complete (`legacyMigrated`, `legacyAssetsMigrated`) only after the written data reads back identical.
- It fails closed: a malformed source record stops it with a retry error instead of writing partial data.

**Rollback:** republishing 2.0.9 by hand (as 2.0.10) shows the data as it was before the upgrade. Changes made on 3.0.0 are lost; keys are safe.

## Testing

### Automated
- `yarn ts` is clean, and `yarn test` passes all 739 tests in 114 suites at the PR head.
- New tests in the last two commits:
  - [rwa-classification.test.ts](../src/lib/store/zustand/__tests__/rwa-classification.test.ts) reproduces the 2.0.9 reclassification case.
  - [profile-2.0.9-upgrade.test.ts](../src/lib/store/zustand/__tests__/profile-2.0.9-upgrade.test.ts) boots the real 3.0.0 owner on a captured 2.0.9 Basenet profile, [profile-2.0.9.json](../src/lib/store/zustand/test-support/fixtures/profile-2.0.9.json).
  - The fixture's wallet addresses and IDs are anonymized, and it contains no vault data or session tokens.
  - The test asserts that statuses, metadata, flags, settings, identity and balances carry over, that the 2.0.9 keys stay untouched, that reclassification keeps user choices, and that a restart changes nothing.
  - It fails on the pre-fix code.

### Upgrade in the installed extension (Chrome, Basenet test account)
Puppeteer installs the 2.0.9 build, builds up a profile through the UI, swaps in the 3.0.0 build at the same path (same extension ID and storage), and diffs storage plus UI.

| Scenario | Result |
|---|---|
| A: wallet locked, no UI open during the update | ✅ |
| B: wallet unlocked, fullpage open; reopened immediately during the migration | ✅ after the fix. Before it, tokens a user had hidden or removed that 3.0.0 reclassifies as RWAs came back. |
| Data checked | 11 tokens (2 hidden, 1 removed), 10 RWAs, 104 token metadata records, collectible/RWA metadata, adult flags, settings, migration history, IndexedDB |
| Vault | Unlocks with the same password in every run |
| Second restart | No changes |

### Smoke tests on the upgraded profile
- **Checked:**
  - **History:** the earlier test transfer shows as Applied.
  - **RWA detail:** the page opens with its details.
  - **Send:** 0.01 MVRK test transfers between the test account's own accounts were confirmed.
  - **Background worker:** after Chrome stops the worker, the wallet stays unlocked and keeps its data.
  - **Contacts:** 10 loaded from the API; JSON export matches the list; importing 1 contact and deleting it again leaves the list unchanged.
  - **Pro/KYC:** the Pro badge shows and the verification page opens; nothing was submitted.
  - **Rates:** the fiat value shows.
- **Not tested:** dApp connect/sign (skipped), Mainnet, Firefox. Firefox has no published version.
- **Not reachable in either version:** buy, withdraw and swap.

### Known behaviour, for release notes
- Users who are unlocked when Chrome applies the update have to enter their password once.
- Some older RWA-era tokens now show under Tokens, while `/assets` RWAs move to the RWA tab.

## Security-sensitive changes

### Unchanged since 2.0.9
Byte-identical:
- **Vault storage and encryption:** `vault/safe-storage.ts`, `session-store.ts`, `session-wrapping-key-store.ts`, `helpers.ts`, `misc.ts`, `migrations.ts`, `storage-keys.ts`, and `passworder.ts`.
- **Contacts encryption:** `contacts-crypto.ts`.
- **API auth and JWT storage:** `mavryk/api/auth.ts`, `client.ts`, `storage.ts`.
- **Background state and permissions:** `back/store.ts`, `back/intercom-permissions.ts`.

Ledger-related code changed by one line, which isn't security-relevant. Key derivation, the storage format of keys and accounts, and the password check are therefore unchanged.

### Vault: two behaviour changes ([vault/index.ts](../src/lib/temple/back/vault/index.ts))
1. **Session recovery** (`recoverFromSession`, `a98db455`): when the worker restarts while the wallet is unlocked, 3.0.0 checks the saved session key by decrypting the accounts item. 2.0.9 decrypted the check item first.
   - A wrong key still fails AES-GCM authentication and removes the session, as before.
   - The decrypted accounts are returned to the caller instead of being decrypted a second time. They contain no private keys.
   - **Password unlock is unchanged:** it still checks the check item (`toValidPassKey`).
   - Edge case: if the accounts item were corrupt but the check item intact, the session is now dropped. Before, the vault would have been restored and failed on its next read.
2. **Registration** (`clearAsyncStorages({ shouldPreserveOwnedState: true })`): creating or importing a wallet now keeps `zustand-ui`, `zustand-metadata`, `zustand-assets`, `zustand-balances` and `analytics_user_id`, and removes every other key.
   - These keys hold no secrets.
   - Privacy consequence: asset statuses and metadata from a previously registered wallet stay on disk, keyed by its addresses, until an explicit reset (`clearAllStorages`), which still wipes everything.

### dApp signing and confirmations ([dapp.ts](../src/lib/temple/back/dapp.ts), [dryrun.ts](../src/lib/temple/back/dryrun.ts))
- **Strict validation:** operation params must match a zod schema per operation kind (`validateOpParams`). Previously the only check was that `kind` is a string.
- **Source check:** any operation whose `source` differs from the requesting account is rejected as `InvalidParams`.
- **One-time token:** the confirmation window gets a single-use random token (`nanoid`) in its URL, and the payload is only released to a confirm-UI port that presents it once.
- **Auto-decline timeouts:** 60 s in the wallet and 120 s for dApps, centralised in `confirmation-timeouts.ts`. Ledger requests get 180 s.
- **Content script:**
  - It accepts page messages only from its own window with a real origin (`isProcessablePageMessage`).
  - It reads `window.location` instead of `window.parent.location`.
  - Page requests time out.

### Manifest
- **Iframes:** the content script now runs only in the top frame. It used to be `all_frames: true` with `match_about_blank` and `match_origin_as_fallback`. dApps embedded in iframes no longer get the provider; this closes a cross-frame surface.
- **Firefox CSP (Manifest V2):** `script-src 'self' 'wasm-unsafe-eval'` replaces `'unsafe-eval' blob:`. The Chrome (MV3) policy is unchanged.

### Analytics
- The transport is still disabled.
- Every entry point now returns early unless an adopted identity and consent are ready (`getReadyAnalyticsIdentity`).
- No new data is collected.

### KYC signer key (action required)
- **What 2.0.9 did:** it read `SUPER_ADMIN_PRIVATE_KEY` from the build environment and inlined it into the bundle, because `DefinePlugin` inlined every env variable. `deploy.yml` on `dev` injected it from the repository secret of the same name. **The published 2.0.9 bundles therefore contain the super admin private key.** A local 2.0.9 build confirms the key lands in `pages/options.js` and the shared popup/fullpage/confirm chunk.
- **What 3.0.0 does** (`5c300b95`, `bdb77b1b`):
  - The `SUPER_ADMIN_PRIVATE_KEY` variable is blocked from the bundle, and only allowlisted variables are inlined.
  - KYC signing uses the optional `TESTNET_KYC_SIGNER_PRIVATE_KEY`, only on Basenet. The Mainnet KYC contract is empty in both versions.
  - That signer key is public in the bundle by design and must never be a Mainnet or admin key; see AGENTS.md.
- **Findings on 2026-10-29:**
  - The repository secrets list only `SUPER_ADMIN_PRIVATE_KEY` and `KYC_CONTRACT`; there is no `TESTNET_KYC_SIGNER_PRIVATE_KEY`. Environment-level secrets were not checked. If none exists, a CI-built 3.0.0 has KYC signing turned off ("Testnet KYC signer key is not configured").
  - In the local `.env.local`, `TESTNET_KYC_SIGNER_PRIVATE_KEY` holds **the same key** as `SUPER_ADMIN_PRIVATE_KEY`. A local 3.0.0 build therefore still ships the old admin key under the new name.
- **Recommended before release:**
  1. Treat the super admin key as compromised: it has been public since 2.0.9 shipped. Move the KYC contract admin role, and any other powers that address holds on Basenet or Mainnet, to a new key that is never bundled.
  2. Create a separate Basenet-only registrar key with only the rights KYC onboarding needs. Add it as the `TESTNET_KYC_SIGNER_PRIVATE_KEY` secret and in local env files.
  3. Delete the `SUPER_ADMIN_PRIVATE_KEY` repository secret once nothing uses it.

### Handling of test data during this verification
- **Test wallet:** the runs used the Basenet perf test account. Its seed was read at runtime from a local file and never printed or stored in the repo.
- **Cleanup:** the Chrome test profiles were deleted after each run. API session tokens that had been captured in local storage snapshots were removed, and the exported contacts file was deleted.
- **What's committed:** only the anonymized fixture.

## Commits added at the end of this PR

| Commit | Description |
|---|---|
| `19488fff` | fix: keep 2.0.9 hide/remove choices when reclassifying tokens as RWAs |
| `92d0e978` | test: cover the 2.0.9 to 3.0.0 upgrade with a real Basenet profile |
| `6845c1d8` | merge of `MAV-3974/architecture-load` (load-time Phases 0–6 plus the two commits above) |
