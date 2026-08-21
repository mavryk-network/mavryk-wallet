## 1. What is wrong today

**The original finding.** The contacts encryption key is derived from the account's **public** key with a static salt:

```
// contacts.ts (before the changes)
PBKDF2(publicKey, salt = 'mavryk-wallet', 100_000) → AES-CBC-256
```

`publicKey` is not secret: it is on-chain and it is sent to the backend on every authentication inside the `${publicKey}:${prefixSig}` string. This means **the server (or anyone with a DB dump) can derive the key and read every user's address book**. On top of that, AES-CBC provides no integrity - the blob can be tampered with undetectably.

**What has already been done in `contacts-debug`.** Version `AES-256-GCM-2` was introduced: a random DEK stored locally in vault settings, AES-GCM instead of CBC, version-aware reads with the legacy branch preserved. This closes "the server cannot derive the key", but creates a new problem: **the key is stored locally only**, so after a reinstall or on another device the contacts become permanently undecryptable, and the recovery path silently wipes them and overwrites with an empty list.

---

## 2. Three invariants of a correct solution

| #   | Invariant                                                    | In `contacts-debug`      |
| --- | ------------------------------------------------------------ | ------------------------ |
| 1   | The server cannot derive the key                             | ✅                       |
| 2   | The key is reproducible from the wallet secret on any device | ❌                       |
| 3   | The key is unreachable via dApp signing                      | ⚠️ depends on the scheme |

Invariant #2 is not an "improvement" but part of the same task: without it, server-side contact storage is pointless and the user silently loses data.

---

## 3. How the discussion evolved, and the decisions made

**3.1. The key must be derived, not stored.** Deterministic derivation from the wallet secret closes #2: the key is reproduced on any device from the same mnemonic, and there is nothing to store or sync.

**3.2. Derive from the seed, not from a signature.** The "sign a fixed message and derive the key from the signature" option is dangerous while SEC-05 is open: `requestSign` signs arbitrary bytes without gating, so a malicious dApp can elicit exactly that signature and obtain the key. Derivation straight from the vault secret is **structurally unreachable** through the dApp path (invariant #3 holds by construction). Additionally: HKDF is deterministic by design, whereas ECDSA determinism is a property of the library implementation.

**3.3. The version label is reused.** `AES-256-GCM-2` with a random DEK never appeared anywhere outside the dev environment → we redefine the meaning of the label instead of introducing a `-3` version. Test records are removed with a SQL query; ask Eugene to clean the DB on the Basenet instance if the current `contacts-debug` implementation was only tested there.

**3.4. A scope conflict surfaced.** A backend row is scoped by `(account_id, data_type, data_key)`, where `account_id` comes from the JWT. For ManagedKT the `authAddress` is the owner, while the local cache is keyed by the KT address → **the KT account and its owner write to the same DB row**. Today this is silent clobbering (both derive the same key from the owner's publicKey), but after SEC-02 it would become a hard decryption failure.

**3.5. The root cause runs deeper: the book is scoped per account.** `contactsStorageKey = [storageAddress][networkId]` - so an HD wallet with 5 accounts has 5 different address books. In the legacy scheme the book was global. The per-account scope appears not to have been a product decision, but a leak from the backend storage model.

**3.6. Decision: one book per HD group.** Each key-holding identity owns its own book, and its key is derived from its own secret. Fully deterministic, independent of which other groups are present on the device, and the probe mechanism disappears entirely. HD sub-accounts of one group still share a single book - the main win over the current behaviour. Semantically: **a separate seed phrase is a separate wallet, hence a separate address book.**

**3.7. Ledger becomes an explicit, bounded exclusion.** Ledger holds no exportable secret, so it cannot participate in seed derivation. Rather than distorting the whole scheme for it, Ledger is handled on its own track (D5 / Phase L): excluded in the first release with clear UI, then optionally given a signature-derived key once SEC-05's namespace blocking lands.

**3.8. Wrapped DEK is not needed.** With a single key source per book, direct derivation is sufficient. Wrapped DEK remains an option for the future (multi-device, changing the KEK derivation without re-encrypting) and can be introduced later without changing the contacts format - the derived key simply becomes the KEK.

---

## 4. Final architecture

**Every book belongs to a key-holding identity.** The identity owns both the encryption key and the backend row.

```
HD group W (the common case)
  IKM       = Bip39.mnemonicToSeedSync(mnemonic of W)               // 64 RAW BYTES, not the mnemonic string
  bookAddr  = mnemonicToTezosAccountCreds(mnemonic of W, 0).address // computed FROM THE SEED, not from allAccounts
  key       = HKDF-SHA256(IKM, salt = bookAddr, info, 32 bytes)

Imported account P (not part of any group)
  IKM       = P's private key
  bookAddr  = P's own address
  key       = HKDF-SHA256(IKM, salt = bookAddr, info, 32 bytes)

Ledger    → see D5 / Phase L (separate track)
WatchOnly → excluded (already is)

info      = ['mavryk-wallet', CONTACTS_DATA_TYPE, CONTACTS_DATA_KEY, CONTACTS_ENCRYPTION_VERSION].join('|')
            // derived mechanically from existing constants so it cannot drift from the version label
            // networkId is NOT part of the derivation

blob      = AES-GCM-256(contacts, key), random 12-byte nonce
            AAD = bookAddr|dataType|dataKey|version
            version = "AES-256-GCM-2"

storage   = one row per (account_id of bookAddr, 'contacts', 'contacts')
            - one per network, since networks have separate DBs
```

**Account → book resolution:**

| Account type        | Book it uses                                 | Auth address             |
| ------------------- | -------------------------------------------- | ------------------------ |
| HD (`walletId` = W) | group W's book                               | W's index-0 address      |
| ManagedKT           | resolve `owner`, then apply the owner's rule | the owner's book address |
| Imported            | its own book                                 | its own address          |
| Ledger              | see D5 / Phase L                             | -                        |
| WatchOnly           | none (excluded)                              | -                        |

- **No canonical-across-vault concept, no probe, no cross-group ordering** - every rule is local to the identity that owns the book.
- **`bookAddr` is computed from the seed**, so it stays stable even if the index-0 account object was removed from the list.
- **The key is derived, not stored**, and is identical across networks.
- **Legacy `AES-256-CBC-1`** stays readable, migration happens on first write.
- **The backend does not change.**

---

## 5. Decisions

### ~~D1. Book scope - one per HD group~~

**~~Rule:** the book belongs to the HD group (or to the imported account); its address is the group's **index-0 address computed from the seed**, and the key is `HKDF(that group's seed)`.~~

- ~~Deterministic and reproducible on any device from the seed alone.~~
- **~~Independent of which other groups exist** on the device - this is what fixes invariant #2.~~
- ~~The probe fallback is **removed** - it only existed to paper over the cross-group canonical rule.~~
- ~~HD sub-accounts of one group share one book (the main UX win).~~

**~~What must not be done** (all verified against the code):~~

- **~~Do not compute the address from `allAccounts`.** `removeAccount` (`vault/index.ts:299-328`) can delete a group's index-0 account; `canRemoveAccounts` (`misc.ts:105-110`) only requires ≥1 HD account **vault-wide**; `findFreeHDAccountIndex` (`:449`) never recreates index 0. Compute it from the seed via `mnemonicToTezosAccountCreds(mnemonic, 0)` (`misc.ts:80-88`).~~
- **~~Do not reuse `getAuthWalletAddress` as-is.** It maps a sub-account to the _account object_ at index-0 of its own group - a related but different concept (and it carries a fallback for the "no index-0 account" case). Under D1 the address must come from the seed.~~
- **~~Do not sort with `localeCompare`/`Intl.Collator`** should any ordering ever appear: `'mv1B…' < 'mv1a…'` is `true` by UTF-16 code units while `localeCompare` returns the opposite. (Under D1 no cross-group ordering is needed at all.)~~

**~~Residual risk to close:** if a group's index-0 **account** is deleted, its keys are wiped (`removeAccountsKeys`, `:283-297`) and that address can no longer authenticate, even though the address itself is still computable. HD deletion is currently gated in the UI (`EditAccount.tsx:86`, `RemoveAccount.tsx:77`), but the API path is open → see task 3.5.~~

### ~~D2. Networks - separate books, one key~~

~~Basenet and mainnet are served by **different backends with different DBs**, hence separate books.~~

- **~~Local cache:** `networkId` stays in the key.~~
- **~~Derivation: WITHOUT `networkId`** in `info`/`salt` - one key per identity. The separation is already enforced physically; one key = fewer moving parts. Bonus: a possible future "copy contacts to another network" becomes a simple blob transfer.~~
- **~~UI:** state explicitly that contacts are network-scoped, otherwise switching networks looks like data loss.~~
- **~~AAD:** build it from `bookAddr`, **not** from the server-side `accountId` - the latter is assigned by the server, differs between per-network DBs, and is unknown to the client before the first write.~~

### ~~D3. Direct derivation~~

~~No wrapped DEK. Moving to one later is possible without changing the contacts format (the derived key becomes the KEK).~~

### D4. Books of accounts absent from the local cache - two-level merge

Legacy books are encrypted with v1, where the key is derived from the account's `publicKey`, and `revealPublicKey` works for HD/imported accounts **without user interaction**. So they can be read programmatically; the only cost is non-interactive authentication per account.

1. **Local merge (primary).** `settings.contactsApi.accounts[*].contacts` holds the **decrypted** contacts of accounts the user actually used on this device → merge them without network calls or authentication.
2. **Sweep for the rest.** For the remaining accounts: non-interactive authentication → `GET` the legacy record → decrypt with the v1 key → merge → delete the legacy record.

### D5. Ledger - separate track

Ledger accounts hold no exportable secret, so `HKDF(seed)` is impossible for them. The only secret a Ledger can produce is a **signature**.

**Release 1 - explicit exclusion.** Encrypted contacts are disabled for Ledger accounts, with a clear UI state. Bounded, no data-loss risk, does not block the main task.

**Release 2 - signature-derived key** (optional, see Phase L). Mechanics:

```
payload  = a FIXED, reserved, domain-separated app message
           (e.g. "mavryk-wallet:contacts-kek:v1"), never sent to the server
sig      = vault.sign(ledgerPkh, payload)     // the user confirms on the device
IKM      = sig
bookAddr = the Ledger account's own address
key      = HKDF-SHA256(IKM, salt = bookAddr, info, 32 bytes)
```

Three hard prerequisites - **all must hold before release**:

1. **SEC-05 namespace blocking first.** While `requestSign` signs arbitrary bytes without gating (`dapp.ts:238-313`), a malicious dApp can request exactly this payload, obtain the signature and derive the key. The leak is silent and irreversible (a deterministic signature stolen once is valid forever), so releasing in the reverse order would later force a full key rotation. Only a narrow piece of SEC-05 is required: `requestSign` must **reject** any payload whose decoded content falls in the reserved namespace (~10 lines, reusing the preview decoder at `dapp.ts:273-291`).
2. **Verify signature determinism on real hardware.** ed25519 is deterministic per RFC 8032; secp256k1/P-256 only under RFC 6979. Test: sign the same payload twice on the device and compare the bytes. If it is not deterministic - **the option is invalid**, the key would change and the data would be lost.
3. **The payload must differ from the auth challenge.** The auth signature is sent to the server inside `${publicKey}:${prefixSig}` (`mavryk/api/utils.ts:29`); if the KEK were derived from the same payload, the server could derive the key and invariant #1 would break again.

**UX:** unwrapping requires a device confirmation. Cache the derived key in background memory for the session → one confirmation per unlock. With the device disconnected, contacts are unavailable (an explicit UI state, not an empty list).

---

## 6. Task list

### Phase 0. Preparation

- [x] **0.1.** On **every** environment, check whether records of the new version exist
- [x] **0.2.** Delete the dev records: ask Eugene to clean the Basenet instance DB if `contacts-debug` was only tested there.
- [x] **0.3.** Align with the team: everyone moves off the old `contacts-debug` build (otherwise it keeps writing blobs with a random DEK under the same label).
- [x] **0.4.** Decisions D1–D5 are closed (see section 5) - verify the implementation against them.

### Phase 1. Vault: book identity and key derivation (background)

- [x] **1.1.** `resolveBookIdentity(account, allAccounts)` → `{ kind: 'hd' | 'imported' | 'ledger' | 'none', walletId?, bookAddr }`. Mapping: HD → the account's own `walletId`; ManagedKT → resolve `owner`, then apply the owner's rule; Imported → its own address; Ledger → `kind: 'ledger'` (Phase L); WatchOnly → `kind: 'none'`. **No cross-group comparisons and no sorting** - every rule is local to the identity.
- [x] **1.2.** Compute `bookAddr` for an HD group **from the seed**: decrypt `walletMnemonicStrgKey(walletId)` with `this.passKey`, then `mnemonicToTezosAccountCreds(mnemonic, 0).address` (`misc.ts:80-88`). Never take it from `allAccounts` - the index-0 account object may have been deleted (D1).
- [x] **1.3.** Add an **instance** method `deriveContactsKey(account)` - an instance method rather than a static one, so it can use `this.passKey` and avoid prompting for a password. Returns `{ key, bookAddr }` so the front consumes the values instead of recomputing them.
- [x] **1.4.** IKM: for HD → `Bip39.mnemonicToSeedSync(mnemonic)` = **64 raw bytes** (the mnemonic string is never hashed: two different strings can yield the same addresses but different bytes). For Imported → the private key via `accPrivKeyStrgKey(pkh)`. Use the **instance** decryption path, not the static, password-prompting `revealMnemonic` (`vault/index.ts:243`).
- [x] **1.5.** Pin the exact WebCrypto call - the obvious spelling throws. See the snippet below. Result: base64 of the 32 bytes, compatible with `importAccountDataKey` (`contacts.ts:96-104`). **`networkId` is not part of the derivation** (D2).
- [x] **1.6.** Expose **only** the derived key: never return or log the seed / mnemonic / private key.

Snippet for task 1.5:

```
const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']); // extractable MUST be false
const bits = await crypto.subtle.deriveBits(
  { name: 'HKDF', hash: 'SHA-256',
    salt: new TextEncoder().encode(bookAddr),   // BufferSource, not a string
    info: new TextEncoder().encode(INFO) },     // info is REQUIRED
  base, 256);
```

**Acceptance:** two consecutive calls, and a call after lock/unlock, produce an identical key; every account of the same HD group resolves to the same `bookAddr` and key; the result does not depend on which other groups exist in the vault.

### Phase 2. Intercom: delivering the key to the UI

- [x] **2.1.** Message type `DeriveContactsKeyRequest/Response` (modelled on `RevealPublicKeyRequest`) + handler in `back/main.ts` and action in `back/actions.ts`.
- [x] **2.2.** Client method in `front/client.ts`, next to `revealPublicKey`.
- [x] **2.3.** Cache `{ key, bookAddr }` in UI memory per identity for the session - **not** in settings, **not** in redux-persist. Invalidate on `accountsUpdated` / wallet create-import.
- [x] **2.4.** _(Optional, better for security)_ move encrypt/decrypt entirely into the background so the key never leaves the SW.

### Phase 3. Per-group book: auth and scoping

- [x] **3.1.** `getContactsAccountScope` returns the **book identity** from task 1.1 instead of the selected account's address (`contacts-settings.ts:55-73`). Take `bookAddr` from `deriveContactsKey`; do not recompute it in the front.
- [x] **3.2.** `buildContactsStorageKey` is built from `bookAddr` + `networkId` (`networkId` stays in the local cache, D2) (`contacts-settings.ts:75-77`).
- [x] **3.3.** Remove the storage/auth address distinction - under D1 the book address _is_ the auth address; this also closes the ManagedKT collision.
- [x] **3.4.** **Remove the probe fallback** - it is not needed under D1 (it existed only for the cross-group canonical rule). Remove it from the design, the tasks and the tests.
- [x] **3.5.** **Close the removal path.** If a group's index-0 account is deleted, its keys are wiped (`removeAccountsKeys`, `vault/index.ts:283-297`) and the book address can no longer authenticate. Block removal of a group's index-0 HD account at the **vault API level** (not only in the UI, where it is already gated at `EditAccount.tsx:86` / `RemoveAccount.tsx:77`), or implement a re-key path. Also: `removeHdWallet` (`:330-355`) never deletes `walletMnemonicStrgKey(id)` - an orphaned seed, worth fixing in the same task.
- [x] **3.6.** Verify that ManagedKT and watch-only behave per the D1 table (KT reads the owner's book; watch-only has none).

### Phase 4. `contacts.ts`

- [x] **4.1.** The key source is the derived key from Phase 2. Remove `generateAccountDataKey` (`contacts.ts:89-94`) and stop accepting `accountDataKey` from the outside.
- [x] **4.2.** **Remove the destructive recovery path entirely:** `buildUnreadableCurrentContactsRecovery` (`:274-288`), `isValidAccountDataKey` (`:290-297`), the `shouldGenerateAccountDataKey` field (`:64-73`, `:238-243`), the `recoverUnreadableCurrentRecord` parameter (`:339`). An undecryptable blob → an **explicit error**, never an overwrite.
- [x] **4.3.** **Keep** the `deriveLegacyAccountDataKey` branch (`:106-121`) - it is required to read v1.
- [x] **4.4.** Add AAD to encrypt/decrypt (`:190-212`): `bookAddr|dataType|dataKey|version`. Thread it through the **save round-trip** too - `saveContactsRecord` decrypts the server's echo (`:411-413`), and without the AAD there every write would fail.
- [x] **4.5.** Errors: do not apply `extractMavrykApiErrorMessage` to crypto errors (`:242`); do not lose error types in the catch-all (`:379-388`).
- [x] **4.6.** A comment table "version → (cipher, key source, info string)" next to the constants (`:14-15`) - the `GCM-2` label now means something different, and `info` must not drift from it.
- [x] **4.7.** Add `deleteContactsRecord` (`DELETE /account/data/{id}`) - **it does not exist in the client today**, and Phase 5 requires it.

### Phase 5. Data migration (client)

- [ ] **5.1.** **Merging per-account books.** Local settings already contain **decrypted** contacts per account (`settings.contactsApi.accounts[*].contacts`) - merge the entries belonging to the same book identity and write once under `bookAddr`. ⚠️ **Filter by network:** parse each cache key `[address][networkId]` and merge only entries of the network being migrated; an unfiltered merge pulls mainnet contacts into the basenet row (contradicting D2) and is irreversible once written.
- [ ] **5.2.** Include the legacy global list `settings.contacts` in the merge. ⚠️ Verify its current semantics first: `buildContactsSettingsPatch` overwrites it with the **last-written scope** (`contacts-settings.ts:194-197`), so it is a mirror rather than a true legacy global list.
- [ ] **5.3.** Deduplicate by address when merging (`normalizeContacts` already does this).
- [ ] **5.4.** Migrate-on-write for v1: read with the legacy key → re-encrypt with the derived key → write.
- [ ] **5.5.** **Sweep the remaining accounts** (D4): for those absent from the local cache - non-interactive authentication → `GET` the legacy record → decrypt with the v1 key → merge → delete the legacy record. Sequentially, in a single pass. Spec corrections: iterate over legacy **auth** addresses (`getContactsAccountScope(...).authAddress`), with the v1 key = `revealPublicKey(authAddress)` - **not** the account's own publicKey, which is wrong for ManagedKT (its row belongs to the owner); enumerate the covered types explicitly (HD + Imported); for **Ledger**, `ensureAuthorizedForAccount` can return _silently_ without a token (`actions.ts:171-173`), so the sweep cannot tell a no-op from success - skip Ledger here and handle it in Phase L; never delete a record that was not successfully decrypted and merged; track per-account progress so an interrupted pass resumes.
- [ ] **5.6.** Completion flag **per network** (`settings.contactsMigration: Record<networkId, true>`), **not** a single global one: otherwise migrating on mainnet sets the flag and basenet never migrates while its sources are already gone.
- [ ] **5.7.** **Delete legacy v1 rows for locally merged accounts too.** Without this SEC-02 stays open: 5.5 only deletes rows for swept accounts, so the v1 blobs of every locally merged account survive on the server and remain server-decryptable. After the merged book is confirmed written, delete every legacy record whose `account_id` does not match the book's address.
- [ ] **5.8.** **Handle the create conflict.** The first write under the book address may `POST` into an existing legacy row and get **409**, which `saveContactsRecord` rethrows; together with 4.2's no-overwrite rule and the one-shot flag the failure becomes permanent. Add the mirror of the existing `PUT → 404 → POST` recovery: on 409, re-`GET` the record, take its `id` and `PUT`.
- [ ] **5.9.** **One writer, one patch.** Write the merged book, the source removal and the flag in a **single** `updateSettings` patch built from freshly fetched settings (or move the merge into the background under the existing unlock queue), and set the flag only after a confirmed successful write. Block/skip `useContactsSync` until the flag is set.

### Phase 6. Storage cleanup

- [ ] **6.1.** Remove `accountDataKey` from `types.ts:180`, `contacts-settings.ts` (`getStoredContactsAccountDataKey` + builder parameters), `network-storage.ts:154-157`, `back/vault/migrations.ts:430-456`.
- [ ] **6.2.** ⚠️ **Do not clear data-carrying per-account state in a vault migration.** Vault migrations run inside `Vault.setup` **on unlock - before the popup UI mounts**, i.e. strictly before the Phase 5 merge, and would delete its source; moreover `runMigrations` (`vault/index.ts:231-237`) commits the migration level in a `finally` even when it throws, making the loss permanent. Restrict 6.2 to removing the inert `accountDataKey` field while **preserving** `contacts`, `recordId` and `typesByAddress`; source removal belongs to task 5.9, the only writer allowed to do it.
- [ ] **6.3.** Verify the key does not reach redux-persist or logs.

### Phase 7. Callers and UI

- [ ] **7.1.** `address-book.ts`: remove the `accountDataKey` plumbing (lines 129, 141, 153-156, 163, 170, 179, 183, 193, 209-210) and `recoverUnreadableCurrentRecord` (`:133`).
- [ ] **7.2.** `use-contacts-sync.hook.ts`: same (lines 88, 104, 109, 116).
- [ ] **7.3.** Unify both paths into one explicit error state: today sync silently logs (`:137-141`) while address-book wipes data.
- [ ] **7.4.** UI state "contacts unavailable" instead of an empty list.
- [ ] **7.5.** Verify that switching accounts **within one HD group** no longer changes the contacts list, while switching to another group intentionally shows a different book.
- [ ] **7.6.** **`use-filtered-contacts.hook.ts`** - missing from the original plan although it is the only read path and it is the one returning `[]` where the "unavailable" state from 7.4 must hook in. Tasks: consume the book scope, return an `unavailable` state instead of `[]`, stop persisting the pruned list, and state explicitly which writer owns the cache entry (it currently rewrites `contactsApi` wholesale from a stale snapshot and can clobber the merged book).
- [ ] **7.7.** Ledger accounts: show the "contacts unavailable for Ledger" state (D5, release 1).

### Phase 8. Tests

- [ ] **8.1.** **Determinism:** one mnemonic → one key, with pinned literal test vectors (simulating another device) - the task's primary invariant.
- [ ] **8.2.** **Group locality:** the key and `bookAddr` do not change when another HD group is added to or removed from the vault (the defect that caused D1 to be revised).
- [ ] **8.3.** **Partial restore:** device A has groups W1 and W2; device B restores only W1 → W1's book is readable and unchanged.
- [ ] **8.4.** **Shared within a group:** all HD sub-accounts of one group resolve to the same book; two different groups resolve to different books.
- [ ] **8.5.** Recovery: a blob exists on the server, no local state → contacts are readable.
- [ ] **8.6.** Round-trip v1 → read → save → `GCM-2` → read again.
- [ ] **8.7.** Undecryptable blob → error, **not** an empty list and **not** an overwrite. Rewrite `contacts.test.ts:251-267` - it currently enshrines data loss as expected behaviour.
- [ ] **8.8.** AAD: tampering with `bookAddr`/`dataKey` → decryption fails; the save round-trip still succeeds (4.4).
- [ ] **8.9.** Merge: several per-account books → one deduplicated list under `bookAddr`.
- [ ] **8.10.** **Removal paths:** deleting a group's index-0 account is blocked (or the book remains readable via the re-key path) (3.5).
- [ ] **8.11.** **Network isolation:** a contact added only on mainnet never appears in the basenet book; after migrating on mainnet, switching to basenet still merges basenet correctly.
- [ ] **8.12.** **Legacy rows removed:** after migration no `AES-256-CBC-1` row remains for any account of that identity, not just the swept ones (5.7).
- [ ] **8.13.** The key is identical on mainnet and basenet (`networkId` does not affect derivation).
- [ ] **8.14.** ManagedKT resolves to the owner's book; watch-only has none.

### Phase 9. Rollout

- [ ] **9.1.** Metric/query over `encrypted_value->>'version'`. Make reaching **zero** the explicit exit criterion - it is unreachable if task 5.7 does not delete the legacy rows of locally merged accounts.
- [ ] **9.2.** Later, once v1 reaches zero - remove `deriveLegacyAccountDataKey` and the legacy branch.

### Phase L. Ledger (separate track, D5)

**L-1 - release 1: explicit exclusion** (ships with the main task)

- [ ] **L1.1.** Exclude Ledger from encrypted contacts (next to WatchOnly in `canAccountUseContacts`, `contacts-settings.ts:51-53`).
- [ ] **L1.2.** UI state "contacts are unavailable for Ledger accounts" - an explicit message, not an empty list (ties into 7.4/7.6).
- [ ] **L1.3.** The Phase 5 sweep skips Ledger and does **not** delete its legacy rows (5.5).
- [ ] **L1.4.** Existing Ledger contacts stay on the server untouched; document that in release 1 they are neither migrated nor deleted.

**L-2 - release 2: signature-derived key** (optional, only after SEC-05)

- [ ] **L2.1.** ⚠️ **Prerequisite: SEC-05 namespace blocking.** `requestSign` must reject any payload whose decoded content falls in the wallet's reserved namespace (`dapp.ts:238-313`, reusing the preview decoder at `:273-291`). Without it a dApp can elicit exactly the signature the key is derived from - a silent, irreversible leak that would later force a full key rotation.
- [ ] **L2.2.** ⚠️ **Prerequisite: verify signature determinism on real hardware** - sign the same payload twice and compare the bytes. ed25519 is deterministic per RFC 8032; secp256k1/P-256 only under RFC 6979. If it is not deterministic - **the option is cancelled**: the key would change and the data would be lost.
- [ ] **L2.3.** Define the reserved payload (e.g. `"mavryk-wallet:contacts-kek:v1"`), fixed and never sent to the server, **different from the auth challenge** (which goes to the server inside `${publicKey}:${prefixSig}`, `mavryk/api/utils.ts:29`).
- [ ] **L2.4.** `IKM = vault.sign(ledgerPkh, payload)`, `bookAddr` = the Ledger account's own address, key = `HKDF-SHA256(IKM, salt = bookAddr, info, 32)` - the same shape as the HD path, only the IKM source differs.
- [ ] **L2.5.** Cache the derived key in background memory for the session → one device confirmation per unlock. With the device disconnected - an explicit "unavailable" state, no empty list and no write.
- [ ] **L2.6.** Migrate the legacy Ledger v1 rows left behind by L1.4 (read with the v1 key → re-encrypt → write → delete the old row).
- [ ] **L2.7.** Tests: determinism on hardware; a dApp request with the reserved payload is rejected; device disconnected → "unavailable" rather than data loss.

Fallback: if determinism (L2.2) is not confirmed, use a **wrapped DEK for Ledger only** - a random DEK for the Ledger book, wrapped under the signature-derived KEK and stored on the server under a separate `data_key`. That adds a record and bootstrap logic and still requires L2.1.

---

## 7. Backend

**No mandatory changes.** Everything required is already in place:

- `account_data` is correctly authorized by `account_id` (`AND account_id = $3`) - unlike `/wallets/*` (SEC-11);
- `UNIQUE (account_id, data_type, data_key)` provides the required binding;
- the blob's `version` is not interpreted by the server (only non-emptiness is checked), so redefining the label's meaning is transparent to it;
- `data_key` is a free-form `VARCHAR(255)`.

**Optional, as small separate tickets:**

- [ ] Validate `data_key` at the API layer (length ≤ 255, restricted character set). There is no validation today, so an over-long key fails with a Postgres error (500 instead of 400).
- [ ] Query/metric over the version distribution (see 9.1).

**A separate task outside SEC-02:** ManagedKT - today its contacts and the owner's contacts are written to the same row and clobber each other. D1 closes this incidentally (by design KT resolves to the owner's book), but the issue is worth tracking explicitly in case that decision is reverted.

---

## 8. Relations to other tickets

- **SEC-05** does not block the main SEC-02 track (D1 uses seed derivation, unreachable from the dApp path). It **does block** Phase L-2 (the Ledger signature-derived key) - see L2.1. SEC-05 remains a priority in its own right (theft of funds).
- **SEC-04** - the same domain-separation theme for signatures; after SEC-02 the main contacts path no longer depends on it.
- **ARCH-11** - if atomic multi-record writes are ever needed, there is an unused `POST /account/data/batch` (single transaction).
