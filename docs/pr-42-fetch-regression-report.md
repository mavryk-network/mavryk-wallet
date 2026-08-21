# PR #42 Contacts Fetch Regression Report

Date: 2026-08-21

## Issue

After the review-validation changes, some contacts records no longer returned contacts on fetch.

The affected records are `AES-256-GCM-2` rows written by the PR before the version bump. Those rows used the new SEC-02 derived contacts key and AES-GCM AAD, but still had the old `AES-256-GCM-2` label and the old `AES-256-GCM-2` HKDF `info` string.

## Root Cause

The review fix split encryption versions as follows:

- `AES-256-GCM-3`: current derived-key + AAD format.
- `AES-256-GCM-2`: old shipped compatibility format.

That split was correct for release safety, but it missed one compatibility case: PR-era `GCM-2` records already written with the derived key + AAD.

There were two version-bound inputs:

- contacts AAD includes the encryption version;
- contacts HKDF `info` includes the encryption version.

`buildContactsAad` always used the current version constant, so it built `GCM-3` AAD while affected records had been encrypted with `GCM-2` AAD. Separately, `Vault.deriveContactsKey` only returned the current `GCM-3` HKDF key, while affected records were encrypted with the `GCM-2` HKDF key.

Imported accounts had one additional compatibility risk: before private-key canonicalization, PR-era rows could be encrypted with HKDF over the stored private-key spelling instead of the canonical signer secret key.

## Fix

- `buildContactsAad(bookAddr, version)` now accepts the encrypted record version and defaults to the current version for new writes.
- Current decrypt uses `record.encryptedValue.version` when building AAD.
- `Vault.deriveContactsKey` now returns read-only compatibility keys derived from older SEC-02 inputs:
  - HD: old `GCM-2` HKDF `info`;
  - Imported: old `GCM-2` HKDF `info`, plus old stored private-key spelling where it differs from the canonical key.
- `AES-256-GCM-2` decrypt now tries:
  - derived contacts keys + version-bound AAD first;
  - old random/stored key without AAD;
  - old PBKDF2(publicKey) key without AAD.
- `AES-256-GCM-3` decrypt also accepts derived compatibility keys and marks those reads for re-encryption.
- Any successfully read `GCM-2` row still returns `shouldReencrypt = true`, so the next write migrates it to `AES-256-GCM-3`.
- Added a regression test for PR-era derived-key `GCM-2` records.

## Why the Review Changes Were Not Removed

The version bump remains necessary. Local release tags show `v2.0.6` and `v2.0.7` already understand and write `AES-256-GCM-2`; reusing that label for the new format lets old clients enter their destructive recovery path and overwrite a migrated book with an empty list.

The per-book `lastSeenVersion` latch remains necessary. Without it, a server-side downgrade can keep legacy public-key-derived candidates accepted forever after migration.

The correct fix is not to remove those changes. The correct fix is to support the transitional PR-era `GCM-2` derived-key/AAD records as read-only compatibility data and re-encrypt them to `GCM-3`.

## Verification

Passed:

- `yarn test --runInBand src/mavryk/api/contacts.test.ts src/lib/temple/front/contacts-settings.test.ts src/lib/temple/back/vault/index.test.ts src/lib/temple/network-storage.test.ts`
- `./node_modules/.bin/eslint --quiet src/lib/temple/contacts-crypto.ts src/mavryk/api/contacts.ts src/mavryk/api/contacts.test.ts src/lib/temple/back/vault/index.ts src/lib/temple/back/vault/index.test.ts src/lib/temple/front/address-book.ts src/lib/temple/front/use-contacts-sync.hook.ts src/lib/temple/front/contacts-settings.ts src/lib/temple/front/contacts-settings.test.ts src/lib/temple/types.ts src/lib/temple/back/vault/migrations.ts src/lib/temple/network-storage.ts`

Failed due to existing baseline issues:

- `yarn ts`: fails in `node_modules` declarations that require newer TypeScript syntax than the pinned TypeScript `4.5.5`.
- `yarn lint`: fails in unrelated existing files:
  - `src/app/templates/SwapForm/SwapForm.tsx`
  - `src/lib/ledger/proxy/signer.test.ts`
  - `src/lib/ui/use-intersection-observer.tsx`

## Remaining Risk

This compatibility path should be removed later with the rest of legacy contacts support, after rollout metrics show no `AES-256-GCM-2` or `AES-256-CBC-1` rows remain.
