# PR #42 Review Validation

Date: 2026-08-21

Source of truth: `docs/contacts-sec-02.md`

## Scope Reviewed

- Current PR branch: `MAV-3979/book-scoping`
- Base branch reported by GitHub: `MAV-3943/intercom`
- Review state: one changes-requested review by `0xVoronov`
- Inline review comments reviewed: 6, including 1 reply in the version-label thread

## Comment 1: Reusing `AES-256-GCM-2` Can Let Old Clients Wipe Migrated Books

Reviewer requested:

- Do not write the new HKDF/AAD format under `AES-256-GCM-2`.
- Bump current writes to a fresh label, `AES-256-GCM-3`.
- Keep `AES-256-GCM-2` as read-only compatibility data.

Decision: agree.

Why:

- SEC-02 section 3.3 allowed reusing `AES-256-GCM-2` only if that label never shipped outside dev.
- Local tags confirm `v2.0.6` and `v2.0.7` exist, and `v2.0.7` contains the `AES-256-GCM-2` writer plus destructive unreadable-record recovery.
- Keeping the same label would allow a staggered rollout failure where an old client treats a new-format record as recoverable and overwrites it with an empty book.

Changed:

- `CONTACTS_ENCRYPTION_VERSION` is now `AES-256-GCM-3`.
- Added `CONTACTS_LEGACY_GCM_ENCRYPTION_VERSION = 'AES-256-GCM-2'`.
- Split decryption:
  - `GCM-3`: derived contacts key + AAD only.
  - `GCM-2`: PR-era derived contacts key using the old `GCM-2` HKDF info + version-bound AAD first, then legacy random/stored key or PBKDF2(publicKey) without AAD, read-only with `shouldReencrypt`.
  - `CBC-1`: unchanged legacy branch.
- Updated contacts API tests to assert current writes use `GCM-3` and `GCM-2` compatibility rows remain readable and marked for re-encryption.

PR response needed: none, implemented.

## Comment 2: Expected `GCM-2` to `GCM-3` Migration Behavior

Reviewer requested:

- Preserve the ability for 2.0.8 to read 2.0.6/2.0.7 `GCM-2` records.
- Re-encrypt them as `GCM-3` on the next write.

Decision: agree.

Why:

- This is the compatibility path required after accepting comment 1.
- It keeps existing server data readable while preventing older clients from silently treating the new format as recoverable.

Changed:

- The `GCM-2` branch returns `shouldReencrypt = true`.
- `saveContactsRecord` writes `CONTACTS_ENCRYPTION_VERSION`, now `GCM-3`.
- Tests cover PR-era derived-key/AAD `GCM-2`, old random-key `GCM-2`, public-key-derived `GCM-2`, and legacy `CBC-1` rewrite to the current version.

PR response needed: none, implemented.

## Comment 3: Imported-Account Key Uses Private-Key String Spelling

Reviewer requested:

- Canonicalize imported private keys before HKDF so equivalent 54-character seed and 98-character expanded forms derive the same contacts key.

Decision: agree.

Why:

- SEC-02 invariant #2 requires the contacts key to be reproducible from the wallet secret on another device.
- The implementation used UTF-8 bytes of the stored private-key string. This made equivalent secret-key spellings derive different HKDF inputs.
- The repo already normalizes private keys via `createMemorySigner(privateKey).secretKey()` for reveal-private-key behavior.

Changed:

- `Vault.deriveContactsKey` now normalizes imported private keys with `createMemorySigner(privateKey).secretKey()` before HKDF.
- Added vault tests proving the 54-character seed form and 98-character canonical form derive the same pinned contacts key.

PR response needed: none, implemented.

## Comment 4: Add Pinned Contacts Key Derivation Tests

Reviewer requested:

- Add hardcoded test vectors for HD and imported contacts key derivation.
- Include equivalent imported key spellings.
- Verify same key after lock/unlock.
- Verify adding/removing another HD group does not change the first group.

Decision: agree.

Why:

- SEC-02 section 8.1 calls determinism the primary invariant.
- A recomputed expectation would not catch accidental changes to HKDF inputs, version label, salt, info, or imported-key normalization.

Changed:

- Added `src/lib/temple/back/vault/index.test.ts`.
- Tests cover:
  - pinned HD `bookAddr` and contacts key from a fixed mnemonic;
  - same result through a fresh `Vault` instance using the same pass key, representing lock/unlock continuity;
  - HD group locality when a second HD group is added and removed;
  - pinned imported contacts key from equivalent 54-character and 98-character private-key forms.

PR response needed: none, implemented.

## Comment 5: Legacy Candidates Accepted Forever Enable Server-Side Downgrade Forgery

Reviewer requested:

- Add a per-book client-side latch, such as `lastSeenVersion`.
- Once a book has successfully read or saved the current version, stop passing legacy decryption candidates for that book.
- Optionally add a user-confirmation escape hatch for accepting a downgrade.

Decision: agree with the latch; do not implement the optional confirmation UX in this PR.

Why:

- SEC-02's adversary includes the server or anyone with a DB dump.
- Without a client-side latch, a compromised server can serve a forged legacy blob, let the client decrypt it with server-derivable legacy keys, and have the client re-encrypt that forged list as current data.
- A fresh device must still read legacy records for migration, so the latch has to be local/per-book.
- The confirmation flow would require new user-facing state and copy; a hard refusal into the existing explicit unavailable/decrypt-failed state is the smallest safe fix.

Changed:

- Added `lastSeenVersion?: string` to `TempleContactsAccountState`.
- Added helpers to read the latch and decide whether legacy contacts may be read.
- `fetchContactsRecord` and `saveContactsRecord` now return the encrypted record version.
- `address-book.ts` and `use-contacts-sync.hook.ts` stop passing `legacyAccountDataKey` / `legacyPublicKey` once `lastSeenVersion` equals the current version.
- Settings, vault migrations, and network-storage normalization preserve `lastSeenVersion`.
- Added settings tests for latch preservation and legacy-read behavior.

PR response for the optional confirmation piece:

> I implemented the per-book hard-refusal latch rather than a confirmation UX. Fresh devices can still migrate legacy rows, but a device that has already seen the current version no longer supplies legacy keys. The confirmation escape hatch would need new product copy/state and can be handled separately if we want a downgrade-restore workflow.

## Comment 6: Sync Writer Can Revert User Mutations from a Stale Snapshot

Reviewer requested:

- Capture cached contacts state when sync starts fetching.
- Before applying sync results, compare the current cache with the captured state.
- If the cache changed while sync was in flight, skip the stale sync write.

Decision: agree.

Why:

- SEC-02 sections 5.9 and 7.6 explicitly warn about single-writer/cache ownership.
- The current hook can fetch remote state, then overwrite a newer local cache written by `persistContacts`.
- This is most risky during the `shouldReencrypt` path because sync also writes to the server.

Changed:

- `useContactsSync` captures `cachedAtFetchStart`.
- Sync now compares the current cache with that captured state before re-encrypting/saving and again before writing settings.
- If local state changed, the sync result is skipped and a later sync/user action can reconcile.

Remaining risk:

- This is a client-side race reduction, not a full concurrency model.
- Cross-device edits and write races that happen after the comparison still require server-side optimistic locking or a single background writer.

PR response for the remaining server-side part:

> I added the compare-before-write guard in `useContactsSync`. This prevents the in-app stale snapshot from overwriting a newer local cache. It does not solve cross-device or server-write races; those still need the backend optimistic-locking ticket / single-writer follow-up noted in the review.

## Additional Implementation Note

While reviewing against `docs/contacts-sec-02.md`, I found one broader SEC-02 mismatch not raised inline: the front-end book-scope helper and the vault derivation path still depend on the HD index-0 account object being present. The PR also adds a vault-level removal guard that prevents deleting the index-0 account while sibling HD accounts remain, which bounds the issue for new state. Fully supporting already-broken vaults where index 0 was removed would require a larger auth/signing path change because `ensureAuthorized` still expects an account object/key for `bookAddr`.

No code change was made for that broader path in this review pass.

## Files Changed

- `src/lib/temple/contacts-crypto.ts`
- `src/mavryk/api/contacts.ts`
- `src/mavryk/api/contacts.test.ts`
- `src/lib/temple/back/vault/index.ts`
- `src/lib/temple/back/vault/index.test.ts`
- `src/lib/temple/front/address-book.ts`
- `src/lib/temple/front/use-contacts-sync.hook.ts`
- `src/lib/temple/front/contacts-settings.ts`
- `src/lib/temple/front/contacts-settings.test.ts`
- `src/lib/temple/types.ts`
- `src/lib/temple/back/vault/migrations.ts`
- `src/lib/temple/network-storage.ts`
- `docs/pr-42-review-validation.md`

## Fixes Applied

- Bumped current contacts encryption version to `AES-256-GCM-3`.
- Kept `AES-256-GCM-2` as read-only compatibility data, including PR-era derived-key/AAD rows that used the old HKDF info string.
- Canonicalized imported private keys before HKDF.
- Added pinned vault derivation tests for HD/imported determinism and HD group locality.
- Added a per-book current-version latch to block legacy downgrade acceptance after migration.
- Added a sync stale-cache guard before sync writes.
- Preserved the new latch through contacts settings helpers and existing storage migrations.

## Comments Rejected

None of the review comments were rejected.

Not implemented from the comments:

- Optional downgrade-confirmation UX: deferred because hard refusal is safer and smaller.
- Backend optimistic locking / full single-writer refactor: acknowledged as required follow-up, outside this PR's current scope.

## Verification

Passed:

- `yarn test --runInBand src/mavryk/api/contacts.test.ts src/lib/temple/front/contacts-settings.test.ts src/lib/temple/back/vault/index.test.ts`
- `yarn test --runInBand src/lib/temple/network-storage.test.ts`
- `./node_modules/.bin/eslint --quiet src/lib/temple/contacts-crypto.ts src/mavryk/api/contacts.ts src/mavryk/api/contacts.test.ts src/lib/temple/back/vault/index.ts src/lib/temple/back/vault/index.test.ts src/lib/temple/front/address-book.ts src/lib/temple/front/use-contacts-sync.hook.ts src/lib/temple/front/contacts-settings.ts src/lib/temple/front/contacts-settings.test.ts src/lib/temple/types.ts src/lib/temple/back/vault/migrations.ts src/lib/temple/network-storage.ts`

Failed due to existing project/dependency issues:

- `yarn ts`: fails in `node_modules` because installed declarations use newer TypeScript syntax than pinned TypeScript `4.5.5` can parse.
- `yarn lint`: fails on unrelated existing files:
  - `src/app/templates/SwapForm/SwapForm.tsx`
  - `src/lib/ledger/proxy/signer.test.ts`
  - `src/lib/ui/use-intersection-observer.tsx`

## Remaining Risks / Manual Verification

- Verify the staged rollout behavior manually with an old 2.0.6/2.0.7 build: old clients should fail to load `GCM-3` rather than overwrite the row.
- Verify contacts UI behavior for a latched book when the server returns a downgraded legacy blob: it should enter the explicit unavailable/decrypt-failed state.
- Cross-device concurrent edits remain unprotected without server-side optimistic locking.
- Already-corrupted vaults missing the HD index-0 account object may still need a separate recovery/auth design.
