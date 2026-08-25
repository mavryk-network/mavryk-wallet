# PR #45 Contacts Audit Report

Date: 2026-08-25

## Sources Reviewed

- PR #42: https://github.com/mavryk-network/mavryk-wallet/pull/42
- PR #45: https://github.com/mavryk-network/mavryk-wallet/pull/45
- PR #42 inline review threads:
  - https://github.com/mavryk-network/mavryk-wallet/pull/42#discussion_r3827437067
  - https://github.com/mavryk-network/mavryk-wallet/pull/42#discussion_r3827485710
  - https://github.com/mavryk-network/mavryk-wallet/pull/42#discussion_r3827562461
  - https://github.com/mavryk-network/mavryk-wallet/pull/42#discussion_r3827570285
  - https://github.com/mavryk-network/mavryk-wallet/pull/42#discussion_r3827861345
  - https://github.com/mavryk-network/mavryk-wallet/pull/42#discussion_r3827947420
- PR #45 inline review thread:
  - https://github.com/mavryk-network/mavryk-wallet/pull/45#discussion_r3829514182
- Local commits:
  - PR #42 head: `642ebbb0c8dd34a874a5d2bbca30ef3d5e35c979`
  - PR #45 head/current branch before this audit: `650fb7218bc5da7d3066f2efbc1867dc141488a1`
  - Released old-client reference: tag `v2.0.7` at `80379e3899a17a0361157a4098dc3c394da8dc96`

PR #42 and PR #45 had no top-level discussion comments. The actionable PR #42 review content was in six inline comments across five threads. The PR review body itself was empty.

## PR #42 Requirements

1. Bump current writes from `AES-256-GCM-2` to `AES-256-GCM-3`.
   - Reason: `v2.0.6` and `v2.0.7` already shipped `GCM-2` plus destructive recovery for unreadable current records. Reusing `GCM-2` for the new HKDF/AAD format could let old clients wipe migrated contacts.
   - Implemented in `src/lib/temple/contacts-crypto.ts` and `src/mavryk/api/contacts.ts`.

2. Keep `AES-256-GCM-2` readable as legacy data and migrate it to `GCM-3`.
   - Reason: existing users may already have server rows written by old released clients or by PR-era builds.
   - Implemented in `src/mavryk/api/contacts.ts`; successful `GCM-2` reads return `shouldReencrypt`.

3. Canonicalize imported private keys before HKDF.
   - Reason: the same imported ed25519 key can be represented in 54-character seed form or 98-character expanded form. Hashing the stored string spelling breaks cross-device recovery.
   - Implemented in `src/lib/temple/back/vault/index.ts`.

4. Add pinned key-derivation tests.
   - Reason: contacts key determinism is the core invariant; recomputing expected values inside tests would not detect accidental HKDF input drift.
   - Implemented in `src/lib/temple/back/vault/index.test.ts`.

5. Add a per-book `lastSeenVersion` latch.
   - Reason: after a client has seen the current version, it must stop silently accepting legacy server-derivable formats. Otherwise a compromised server can downgrade/forge a legacy blob and the client can re-encrypt that forged data as current.
   - PR #45 implemented the latch for `legacyAccountDataKey` and `legacyPublicKey`.
   - This audit tightened it so derived legacy compatibility keys are also withheld after `lastSeenVersion === CONTACTS_ENCRYPTION_VERSION`.

6. Add compare-before-write in sync.
   - Reason: a stale sync fetch can overwrite a newer local mutation; the next mutation can persist that loss to the server.
   - Implemented in `src/lib/temple/front/use-contacts-sync.hook.ts`.

## What Caused Contacts To Disappear

The likely broken intermediate state was:

1. A server row existed with `encryptedValue.version = AES-256-GCM-2`.
2. That row had been written by a PR-era build using the new deterministic HKDF-derived key and AES-GCM AAD, but still under the `GCM-2` label.
3. The review fix bumped current derivation/writes to `AES-256-GCM-3`.
4. Both HKDF `info` and contacts AAD include the encryption version.
5. A client deriving only the `GCM-3` key/AAD could not decrypt the existing `GCM-2` PR-era row.

That failure made contacts unavailable or appear empty depending on the UI path and local cache state. It was not caused by the `GCM-3` label itself; it was caused by missing compatibility for PR-era `GCM-2` rows that used version-bound HKDF/AAD inputs.

## Teammate Explanation

The explanation is technically correct, with one important distinction:

- For old released `v2.0.6`/`v2.0.7` clients, a `GCM-3` row hits `Unsupported contacts encryption version` and does not enter the old destructive recovery branch.
- For PR-era `GCM-2` rows written with deterministic HKDF and AAD, simply deriving the new `GCM-3` key cannot decrypt the old `GCM-2` ciphertext because the version changed both the HKDF `info` and AAD.

PR #45 fixes the second case by returning legacy deterministic `GCM-2` keys from the vault and by building decrypt AAD from `record.encryptedValue.version`.

## PR #45 Behavior

- New saves write only `AES-256-GCM-3`.
- `GCM-3` reads use the current derived key and current AAD.
- Unlatched clients can also try read-only derived compatibility keys to recover transitional records, then re-encrypt.
- `GCM-2` reads try:
  - deterministic compatibility keys with `GCM-2` AAD;
  - old locally stored random `accountDataKey`;
  - old PBKDF2(publicKey) shared key without AAD.
- Every successful `GCM-2` read sets `shouldReencrypt = true`.
- `CBC-1` remains readable through the public-key-derived AES-CBC legacy branch and is marked for re-encryption.
- Decryption failures no longer create an empty book or overwrite the server row.

## Changes Made During This Audit

This branch had two remaining client-side gaps:

1. The `lastSeenVersion` latch still allowed derived legacy compatibility keys after the book had already seen `GCM-3`.
   - Changed `src/lib/temple/front/address-book.ts`.
   - Changed `src/lib/temple/front/use-contacts-sync.hook.ts`.
   - Result: once the current-version latch is set, the client does not pass any legacy key family for normal sync/action reads.

2. Unsupported future encryption versions were fail-closed but only logged by sync, so a fresh UI could still look like an empty ready contacts list.
   - Changed `src/mavryk/api/contacts.ts` to throw `CurrentContactsRecordDecryptionError` for unsupported versions.
   - Added a regression test in `src/mavryk/api/contacts.test.ts`.
   - Result: sync can surface the existing `decrypt-failed` unavailable state instead of silently logging.

## Scenario Matrix

| Scenario | Current result |
| --- | --- |
| Existing old released `GCM-2` PBKDF2(publicKey) row | Readable on unlatched clients with `legacyPublicKey`; marked for `GCM-3` re-encryption. |
| Existing old random-key `GCM-2` row | Readable only on the same local profile if `accountDataKey` is still present; not recoverable on a fresh device. |
| Existing PR-era `GCM-2` HKDF/AAD row | Readable on unlatched clients via derived `GCM-2` compatibility key and version-bound AAD; marked for `GCM-3` re-encryption. |
| New `GCM-3` row | Written and read with the current deterministic key and `GCM-3` AAD. |
| `GCM-2` to `GCM-3` migration | Successful legacy read sets `shouldReencrypt`; sync/actions save the same contacts back as `GCM-3` and set `lastSeenVersion`. |
| Wrong key / corrupted current data | Throws `CurrentContactsRecordDecryptionError`; no empty recovery write. |
| Unsupported encryption version | Treated as explicit contacts decryption failure; no empty recovery write. |
| Old client reads `GCM-3` without cache | Fails on unsupported version and does not enter destructive recovery. |
| Old client with cached record writes after `GCM-3` migration | Still dangerous unless backend rejects downgrade `PUT`. |
| Fresh device/browser recovery | Works for HD and imported accounts because the key is deterministic from wallet secrets; Ledger/watch-only remain explicitly unavailable. |

## Backend Responsibility

Backend downgrade protection is required.

The new client cannot prevent an already-installed old client from sending:

```text
PUT /account/data/{recordId}
encryptedValue.version = AES-256-GCM-2
```

over a server row that already contains `AES-256-GCM-3`. A `v2.0.7` client can reach that path if it has cached contacts and a cached `recordId`; it can skip a fresh decrypt, mutate local cache, and save with the old `GCM-2` writer.

Minimum backend requirement:

- On `PUT /account/data/{id}`, compare existing `encryptedValue.version` against the incoming version for known contacts encryption versions.
- Reject downgrades, especially `GCM-3 -> GCM-2` and `GCM-3 -> CBC-1`.
- Return an explicit conflict-style error so old clients fail rather than overwriting.

Recommended backend follow-up:

- Add optimistic locking using the record's server-side `version` counter or an equivalent precondition. This is needed for cross-device concurrent edits and stale writers, not only encryption-version downgrade.

Backend downgrade protection does not replace the client latch. A malicious server can still choose what it serves on `GET`; only the client can refuse legacy reads after it has latched the current version.

## Remaining Risks

- Cross-device concurrent edits can still lose updates until backend optimistic locking exists.
- A malicious server can replay an older valid `GCM-3` ciphertext; current cryptography authenticates content but does not provide freshness.
- Fresh-device recovery cannot decrypt random-key `GCM-2` rows that never had a deterministic/server-derivable key. Same-profile recovery can still work while the local `accountDataKey` exists.
- Existing broken vaults where an HD group's index-0 account object/key was already removed may still be unable to authenticate/read that group's book. The current branch blocks new deletion of an index-0 HD account while sibling accounts remain, but it does not repair historical broken vaults.
- The broader SEC-02 document still lists follow-up phases that are not complete in this branch, including full per-account legacy row sweep, legacy row deletion, rollout metrics, and later legacy code cleanup.

## What To Test Before Merge

1. Existing PR-era `GCM-2` server row: new client loads contacts, shows them, and re-saves as `GCM-3`.
2. Existing `v2.0.7` PBKDF2(publicKey) `GCM-2` row: new client loads contacts and migrates to `GCM-3`.
3. Existing local random-key `GCM-2` row with `accountDataKey`: same profile loads and migrates; fresh profile fails explicitly.
4. Fresh browser/device restore from the same HD mnemonic sees the same contacts.
5. Imported account recovery works when device A imported a 54-character key and device B imports the 98-character revealed key.
6. Ledger and watch-only accounts show contacts unavailable and cannot mutate contacts.
7. ManagedKT uses the owner's book.
8. Mainnet and Basenet contacts remain isolated in local cache/server data.
9. A server row with unsupported version, for example `AES-256-GCM-4`, shows contacts unavailable and does not allow a write.
10. `v2.0.7` against a migrated `GCM-3` row:
    - fresh/no-cache old client fails to load and does not overwrite;
    - cached old client attempting to edit is rejected by backend downgrade protection.
11. Two windows open during a `GCM-2` migration do not let a stale sync snapshot overwrite a newer local mutation.

## Suggested Reply To Teammate

Your diagnosis is correct. The broken case was PR-era `GCM-2` data encrypted with deterministic HKDF/AAD before the `GCM-3` label existed. Because both HKDF `info` and AAD include the version, a client that only derives the `GCM-3` key cannot decrypt those rows. PR #45's compatibility keys and version-bound AAD fix that and correctly mark successful legacy reads for re-encryption.

I agree the backend downgrade guard is required. The `GCM-3` label prevents old clients from entering the old empty-book recovery path when they fetch first, but an old client with cached contacts/recordId can still `PUT` a `GCM-2` blob over a newer `GCM-3` row unless the server rejects downgrades.

## Verification

Passed:

```text
yarn test --runInBand src/mavryk/api/contacts.test.ts src/lib/temple/front/contacts-settings.test.ts src/lib/temple/back/vault/index.test.ts src/lib/temple/network-storage.test.ts
```

Result: 4 suites passed, 31 tests passed.

Passed:

```text
./node_modules/.bin/eslint --quiet src/lib/temple/contacts-crypto.ts src/mavryk/api/contacts.ts src/mavryk/api/contacts.test.ts src/lib/temple/back/vault/index.ts src/lib/temple/back/vault/index.test.ts src/lib/temple/front/address-book.ts src/lib/temple/front/use-contacts-sync.hook.ts src/lib/temple/front/contacts-settings.ts src/lib/temple/front/contacts-settings.test.ts src/lib/temple/types.ts src/lib/temple/back/vault/migrations.ts src/lib/temple/network-storage.ts src/lib/temple/front/use-filtered-contacts.hook.ts src/app/templates/Contacts/Contacts.tsx src/app/templates/Contacts/screens/ImportContacts/ImportContacts.tsx src/app/templates/Contacts/screens/AddContact.tsx src/app/templates/SendForm/AddContactModal.tsx
```

Failed due to baseline dependency declaration syntax, before checking project code:

```text
yarn ts
```

Representative errors are in `node_modules/@apollo/client/masking/internal/types.d.ts`, `node_modules/@types/babel__traverse/index.d.ts`, and `node_modules/@types/lodash/common/*.d.ts`; they use TypeScript syntax newer than the repo's pinned TypeScript `4.5.5` can parse.

