# Wallet registration preference persistence

## Root cause

Compared architecture branch `f2f113d0` with local `dev` at `e735af46`.
Both creation and seed restoration submit through `registerNewWallet` and
`Vault.spawn`. Their cleanup called `clearAsyncStorages`, including
`browser.storage.local.clear()`.

In v3.0.0, `StoreProvider` initializes the background owner before onboarding.
Registration therefore deleted already-adopted UI, metadata, asset and balance
destinations plus the analytics identity. The live owner retained its readiness
flags and memory snapshots. Storage notifications or subsequent commands then
failed durable read-back and closed the preference gate. Retrying could not
reconstruct all deleted destinations from already-completed migrations.

`dev` uses Redux/PersistGate without these owner readiness and durable read-back
checks. The unchanged broad cleanup became incompatible with the new lifecycle.
See the existing Tasks 13 and 17–19 handoffs for destination ownership.

## Change

`Vault.spawn` now requests preservation of the four owner destinations and their
analytics identity when clearing obsolete wallet storage. Cleanup removes other
local keys directly; it never clears and restores snapshots, avoiding lost
concurrent owner writes and transient missing destinations. Session and repository
cleanup remain active. Explicit wallet reset, options reset and E2E reset retain
the default full-clear behavior. No migration, validation or durability gate is
bypassed, and no foreground persistence writer is introduced.

## Verification

The new `wallet-initialization.test.ts` exercises real vault encryption, creation
with a supplied seed (the common create/restore path), generated-seed creation,
HD keystore decryption/restoration, imports into an unlocked wallet, password
unlock, the real client/owner fallback protocol, storage notifications,
preference persistence, owner restart and explicit reset. Browser transport/storage,
account labels, KYC lookup and repository deletion are mocked; no live authentication or chain
transactions are involved. It also covers concurrent preference writes during
cleanup and propagation of cleanup read/removal failures.

With the old `Vault.spawn` cleanup restored temporarily, the original three registration
cases fail with the reported preference error. With the fix they pass.

Installed-extension create/restore acceptance remains a manual check because no
browser surface is connected to this session. Registration preserves the current
application-owned state; explicit reset remains the boundary for discarding that
state. Future owner destinations must be included in the registration preservation
set in `src/lib/temple/reset.ts`.

Full verification before the additional HD-file/account-import tests: `yarn ts`
passed; `yarn test --runInBand` passed 97 suites / 577 tests. Targeted lint,
Prettier and `git diff --check` also passed.

Final expanded regression suite: all seven tests passed, including real HD-keystore
decryption and restoration, plus HD-wallet and mnemonic-account imports into an
unlocked wallet. The suite uses Node's environment for compatible crypto buffers;
foreground fallback storage and browser events are simulated. The keystore fixture
contains only the public BIP39 test mnemonic and a test password.
