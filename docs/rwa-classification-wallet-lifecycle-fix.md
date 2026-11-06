# RWA classification and wallet initialization

## API findings and classification

The authenticated Basenet check on 2026-10-20 returned 11 positive-balance
`/wallets/{address}/assets` entries and two `/tokens` entries. Mainnet returned
no assets and one native-token entry for the same test account. Credentials and
account balances are not stored in this handoff.

The user confirmed that `/assets` defines RWA membership with one exception:
Basenet `KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v_0` (wUSDT) stays in Tokens.
The exception does not apply to another token ID, contract, or chain.

Previously, known-fungible indexer holdings bypassed RWA classification, unknown
holdings used a fixed symbol list, and token records accumulated without removing
reclassified entries. RWA metadata publication also discarded newer symbols such
as ANTH and VOO. Missing page metadata went through the legacy RPC/metadata path;
a failed request could leave the first page empty. The live API response itself
was populated and matched the existing response schema. The user's precise
existing-profile empty-tab state was not available for inspection.

Both indexer branches now exclude catalog RWA slugs before token publication.
The background owner moves matching stored entries to RWAs, preserves status and
manual choices (explicit destination choices win; a non-manual `idle` destination,
such as the RWA record 2.0.9 wrote while listing `/assets`, yields to an explicit
hidden/removed/manual token choice), and prevents later token
responses from recreating duplicates. It moves the wUSDT exception back to Tokens.
Predefined/whitelisted token presentation respects the owner's classification.
Balances retain their existing acknowledged publication and conversion paths;
history transport is unchanged and shared metadata lookup now includes RWAs.

RWA page metadata and detail requests use the same wallet catalog and exception.
Validated metadata is no longer rejected by symbol. Query retains request
lifecycle/receipts; the background owner retains durable records. Existing scope
cancellation, revisions and read-back checks remain active. Catalog/auth failures
reject classification rather than publishing unclassified holdings; cached owner
records remain available. The user explicitly chose this behavior: fresh-account
token discovery waits for the wallet catalog as well as the indexer.

## PR #47 lifecycle adaptation

Reviewed [PR #47](https://github.com/mavryk-network/mavryk-wallet/pull/47).
Applied only the `Vault.spawn` registration cleanup option, its implementation in
`clearAsyncStorages`, and the wallet initialization tests/public test-keystore
fixture. No RWA patch or image-loading patch from the PR was applied.

Registration removes obsolete storage keys individually while preserving the
live owner's `zustand-ui`, `zustand-assets`, `zustand-metadata`,
`zustand-balances` destinations and analytics identity. Clearing and restoring
those records would race concurrent writes and invalidate owner readiness.
Explicit wallet reset retains full clearing; session/repository cleanup remains
active. Creation and restoration share `Vault.spawn`; imports into an existing
wallet retain their existing path. Future owner destinations must be added to
the preservation set.

## Validation

Regression coverage includes both indexer branches, new symbols, same-symbol
ordinary tokens, exact wUSDT identity, account/chain isolation, catalog failure,
publication order, durable classification repair, metadata pagination, creation,
restoration, HD-keystore import, account import, owner restart and explicit reset.
Installed-extension acceptance remains separate from mocked transport tests.

`yarn ts` and the production Chrome `yarn build` passed. The build produced
`dist/chrome.zip`. Scoped ESLint reported no errors (assertion warnings remain).
The full `yarn test --runInBand` run passed all 99 suites / 588 tests.
