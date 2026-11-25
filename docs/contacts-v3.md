# Contacts v3 Architecture Report

Generated: 2026-08-26

## Summary

Mavryk Wallet `2.0.8` stores contacts in the Mavryk account-data backend under:

```text
dataType: contacts
dataKey: contacts
```

The current remote encryption format is:

```text
AES-256-GCM-3
```

Wallet can read and write this format because it derives the contacts key inside the extension vault from seed/private-key material. This key is not available through the public dApp connection.

## Main Source Files

- `src/lib/temple/contacts-crypto.ts`
- `src/mavryk/api/contacts.ts`
- `src/lib/temple/back/vault/index.ts`
- `src/lib/temple/front/client.ts`
- `src/lib/temple/front/contacts-settings.ts`
- `src/lib/temple/front/use-contacts-sync.hook.ts`
- `src/lib/temple/front/use-filtered-contacts.hook.ts`
- `src/lib/temple/front/address-book.ts`
- `src/lib/temple/front/contacts-availability.ts`
- `src/app/templates/Contacts/Contacts.tsx`
- `src/app/templates/Contacts/screens/AddContact.tsx`
- `src/app/templates/Contacts/screens/ImportContacts/ImportContacts.tsx`
- `src/app/templates/SendForm/AddContactModal.tsx`

## Data Model

Contacts use `TempleContact`:

```ts
{
  address: string;
  name: string;
  addedAt?: number;
  accountInWallet?: boolean;
  type?: TempleContactApiType;
}
```

Backend contact type is one of:

```text
user | validator | contract
```

The current backend payload is grouped by type:

```ts
{
  user: ContactPayloadItem[];
  validator: ContactPayloadItem[];
  contract: ContactPayloadItem[];
}
```

Older flat arrays are still accepted on read and normalized into the same internal shape.

## Contact Book Scope

Contact scope is determined in `getContactsBookScope`.

Current rules:

- HD accounts share the contact book of HD index `0` for the same wallet.
- Imported accounts use their own account address as the book address.
- Managed KT accounts resolve through their owner account.
- Ledger accounts are unavailable for contacts.
- Watch-only accounts are unavailable for contacts.
- Missing owner/account cases are unavailable.

The scoped local settings key is:

```text
[bookAddress][networkId]
```

Example:

```text
[mv1...][mainnet]
```

## Encryption Versions

Current constants live in `src/lib/temple/contacts-crypto.ts`.

Current write version:

```text
AES-256-GCM-3
```

Legacy read-only versions:

```text
AES-256-CBC-1
AES-256-GCM-2
```

The current contacts AAD is:

```text
bookAddr|contacts|contacts|AES-256-GCM-3
```

Legacy GCM AAD uses:

```text
bookAddr|contacts|contacts|AES-256-GCM-2
```

## Key Derivation

Contacts key derivation is implemented in the vault:

```ts
vault.deriveContactsKey(accountPublicKeyHash)
```

For HD accounts:

- Wallet locates the HD index `0` account in the same wallet.
- Wallet decrypts the wallet mnemonic.
- Wallet derives the seed from the mnemonic.
- Wallet derives the raw contacts key from the seed and book address.
- Wallet also derives legacy GCM keys for compatibility.

For imported accounts:

- Wallet decrypts the stored private key.
- Wallet canonicalizes it through the memory signer.
- Wallet derives the raw contacts key from the private-key material and account address.
- Wallet includes legacy key candidates when canonical and stored forms differ.

For managed KT accounts:

- Wallet resolves the owner account.
- Wallet derives the owner's contacts key.

For ledger/watch-only accounts:

- Wallet returns unavailable.

The result shape is:

```ts
{
  status: "available";
  key: string;
  legacyKeys?: string[];
  bookAddr: string;
  identityKind: "hd" | "imported";
}
```

or:

```ts
{
  status: "unavailable";
  bookAddr?: string;
  reason: "ledger" | "watch-only" | "missing-owner" | "missing-account";
}
```

## Internal Message Path

Wallet UI code calls `deriveContactsKey` through `useTempleClient`.

Internal flow:

1. Front-end calls `deriveContactsKey(accountPublicKeyHash)`.
2. `src/lib/temple/front/client.ts` sends `TempleMessageType.DeriveContactsKeyRequest`.
3. `src/lib/temple/back/main.ts` handles the internal request.
4. `src/lib/temple/back/actions.ts` calls `vault.deriveContactsKey`.
5. The vault returns either an available key or an unavailable reason.

This is an internal extension UI flow.

The public dApp page bridge does not currently expose `DeriveContactsKeyRequest`.

## Remote API Flow

Remote API functions live in `src/mavryk/api/contacts.ts`.

Read flow:

1. Fetch `/account/data/contacts/contacts`.
2. Parse the account-data record.
3. Select decrypt strategy by `encryptedValue.version`.
4. Try current key and legacy key candidates where applicable.
5. Normalize flat or grouped payloads.
6. Return contacts, record id, encryption version, type map, and optional `shouldReencrypt`.

Write flow:

1. Normalize contacts and type map.
2. Build grouped payload.
3. Encrypt with `AES-256-GCM-3`.
4. Create or update `/account/data`.
5. Parse the response by decrypting it again with the current contacts key.
6. Return saved contacts, record id, encryption version, and type map.

Conflict/not-found handling:

- Create conflict fetches the existing record and updates it.
- Update not found falls back to create/update existing.
- Missing remote record returns empty contacts with `recordId: null`.

## Local Settings

Contacts cache lives in settings:

```ts
settings.contactsApi.accounts[contactsStorageKey]
```

Per-account state:

```ts
{
  accountDataKey?: string;
  contacts: TempleContact[];
  lastSeenVersion?: string;
  recordId?: string;
  syncError?: "decrypt-failed" | "auth-unavailable";
  typesByAddress?: Record<string, TempleContactApiType>;
}
```

Important notes:

- `accountDataKey` is deprecated and kept only as a read-only compatibility source for old local GCM2 records.
- `lastSeenVersion` prevents repeatedly reading legacy records after the current version is known.
- `syncError` makes contacts unavailable without deleting the cached state.
- `settings.contacts` is still updated for compatibility with older UI/settings paths.

## Background Sync

`useContactsSync` syncs contacts when account, network, or contact scope changes.

Sync flow:

1. Resolve contact book scope.
2. Derive contacts key internally.
3. Ensure account-data authorization for the book address/network.
4. Check auth token availability.
5. Reveal public key only when legacy records may still need to be read.
6. Fetch remote contacts.
7. Re-save legacy records to v3 when `shouldReencrypt` is set.
8. Update settings if cached state did not change during the async request.

If auth is unavailable:

```text
syncError: auth-unavailable
```

If current record decryption fails:

```text
syncError: decrypt-failed
```

The sync path intentionally does not wipe contacts on these errors.

## Contact Actions

User-triggered contact mutations are handled by `useContactsActions` in `address-book.ts`.

Main responsibilities:

- Resolve contact access.
- Load current cached/remote contacts.
- Merge cached and remote contacts when needed.
- Validate names and addresses.
- Detect contact type:
  - KT address -> `contract`
  - known validator address -> `validator`
  - otherwise -> `user`
- Add one contact.
- Import many contacts.
- Delete contacts.
- Persist changes through `saveContactsRecord`.

Mutations require an available encrypted contacts scope and a derived contacts key.

## UI Availability

`useFilteredContacts` builds the UI-facing contacts state.

Rules:

- If contact book scope is unavailable, contacts are unavailable.
- If cached state has `syncError`, contacts are unavailable.
- Only `availability.status === "ready"` allows mutation.
- Wallet-owned accounts are still included in `allContacts`.
- Outside-wallet contacts are hidden when contacts are unavailable.

Unavailable reasons are rendered through `getContactsUnavailableMessage`.

Current reasons:

- `ledger`
- `watch-only`
- `missing-owner`
- `missing-account`
- `auth-unavailable`
- `decrypt-failed`

## Legacy Migration

Wallet migrations normalize older contacts settings into scoped `contactsApi.accounts`.

Migration behavior:

- Old flat `settings.contacts` is preserved and normalized.
- Unscoped contacts records are moved into `[bookAddress][networkId]` where possible.
- Selected-account contacts are preserved for the selected contact scope.
- Existing scoped account states are merged and normalized.

## Compatibility With Nexus

Wallet can read/write v3 contacts because it has internal vault access.

Nexus currently cannot read Wallet v3 contacts through the public Mavlet/dApp connection because the public client does not expose `deriveContactsKey`.

Current public dApp support includes permission, operation, sign, and broadcast requests. It does not include contacts-key derivation.

Therefore, any external app that needs to read/write Wallet v3 contacts must get one of these from Wallet/SDK:

1. A permissioned contacts-key capability.
2. A Wallet-side contacts operation API that keeps the key inside Wallet.

The second option is safer because raw contacts keys never leave the extension.

## Release Risks

Main compatibility risk:

- Wallet writes `AES-256-GCM-3` contacts.
- Nexus or another app only has public-key/legacy access.
- The external app cannot decrypt the v3 record.

Safe behavior for external apps:

- Treat missing current contacts key as unavailable.
- Disable contact mutations.
- Do not overwrite v3 account-data records with legacy/public-key encrypted payloads.

## Recommended Next Steps

1. Decide whether external apps should receive raw contacts keys or only call Wallet-side contact operations.
2. Add the chosen contacts capability to the public Mavlet protocol and SDK.
3. Add Wallet public bridge handling for that capability.
4. Add explicit user approval/origin gating for contacts access.
5. Update Nexus to consume the official typed API instead of an optional local cast.
6. Keep legacy read paths until all deployed Wallet/Nexus users have migrated to v3.

## Test Coverage To Keep

Keep tests around:

- HD child account resolving to HD index `0` book address.
- Imported account deriving a self-scoped contacts key.
- Managed KT resolving through owner.
- Ledger/watch-only unavailable states.
- Legacy CBC and GCM2 decrypt/read paths.
- Re-encryption from legacy to `AES-256-GCM-3`.
- Grouped payload type preservation.
- `syncError` preserving cached contacts while disabling mutation.
