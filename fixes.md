# Wallet Extension v3.0.0 — investigation and independent implementation plans

Investigated on 2026-10-21. The initial investigation did not modify application code. Issue #1 is now implemented; see its implementation and verification record below. Issue #2 was skipped.

| Issue | Status | Root Cause | Frontend/Backend |
|---|---|---|---|
| Password validation | Implemented; automated verification recorded below | Shared new-vault policy, corrected error coloring, explicit file-password reuse and replacement selection | Frontend |
| RWA loading | Already fixed — skipped | N/A | N/A |
| Token history | Confirmed with authenticated API responses | Backend whitelist rejects most contracts; frontend converts request failures into successful empty history | Backend + frontend |
| Asset classification | **Fixed / Verified** in code, automated tests and sampled API catalog | Catalog-based partition and owner reconciliation already replace incomplete symbol-based classification; Basenet wUSDT exception is implemented | No additional fix proposed |
| Primary purchase history | Implemented; automated verification below | Scoped purchase normalization retains mint credits with authoritative payment and separate fees | Frontend; broader backend normalization remains optional |
| Full-screen flickering | Reload/background gap confirmed in code; visual acceptance pending | Setting reloads the document; new/full-page document has no initial background, with background assigned after React mounts | Frontend |
| Mavryk Pro upgrade | Confirmed | Both production UI actions still invoke deliberately blocked frontend privileged signing; no replacement service integration; Mainnet contract mapping also empty | Backend + frontend + deployment configuration |

## Evidence, scope and working rules

- Inspected branch: `MAV-3974/architecture`, HEAD `e088f4726c4a2760894a0f5d21b30e3f5dd5bed0`.
- Local comparison branch: `dev`, `e735af469a85b56fc140999b345989d41afbeadc`. No remote fetch was performed. This local `dev` already uses the wallet-backend history pipeline; do not assume it still uses the old direct-indexer history fetcher.
- Existing staged RWA image changes and `docs/rwa-image-loading-fix.md` were left untouched.
- API evidence below was obtained with read-only requests. A fresh user-supplied credential replaced the expired original; neither credential is included here. Successful authenticated probes were against **Basenet**, not Mainnet. Do not generalize live Basenet results into verified Mainnet behavior.
- Initial Python HTTP probes encountered edge HTTP 403/code 1010; ordinary `curl` requests succeeded. Unauthenticated wallet requests returned HTTP 401. Neither result was treated as evidence of missing transaction data.
- Exact file paths and function names below are navigation anchors at the recorded HEAD. Preserve the existing domain boundaries, background owner, Query receipt model and history UI model. No new production dependencies are needed for the frontend fixes.
- Tests actually run: `yarn test --runInBand --watch=false src/app/store/assets/utils.test.ts src/lib/store/zustand/__tests__/rwa-classification.test.ts src/lib/assets/use-assets-query.test.tsx` — **3 suites, 8 tests passed**. These verify the already implemented classification behavior, not installed-extension visual acceptance. Runtime builds/full test suite were not run for this documentation-only change.

## 1. Password setup — enforce the displayed policy in every creation path

### Problem

A new vault password without punctuation is accepted despite the displayed special-character requirement. Invalid punctuation state remains neutral rather than red. Creation, seed restoration and keystore import must enforce the same new-password policy. Existing vault unlock and decryption of old imported files must continue accepting their original passwords.

### Confirmed root cause and flow (before implementation)

1. `src/app/defaults.ts:17`, `PASSWORD_PATTERN`, checks lowercase, uppercase, digit and length >= 8, but has no special-character lookahead. `Abcdefg1` therefore passes. The separate `specialCharacterRegx` checks punctuation only for the indicator.
2. `src/app/pages/NewWallet/setWalletPassword/SetWalletPassword.tsx`, password `register` rules, uses `PASSWORD_PATTERN`; repeat-password validation checks equality. `internalDisabledBtnStatus` depends on errors, text and agreements, so missing punctuation does not create a blocking error.
3. `src/app/pages/NewWallet/import/useCreareOrRestorePassword.tsx`, `handlePasswordChange`, computes four indicator flags separately. `isPasswordError` derives from the form error message. The UI and actual policy disagree.
4. `src/lib/ui/PasswordStrengthIndicator.tsx:52` passes unconditional `noColor` for special characters. `PasswordStrengthIndicatorItem.tsx` uses neutral styling for invalid values when `noColor` is true. Other requirements use `noColor={!isPasswordError}`.
5. File import has **additional independent bypasses**. `ImportFromKeystoreFileComponent` decrypts with a required-only original file password; this is correct for compatibility. Its reuse toggle calls `secondarySubmit` from `useCreareOrRestorePassword(true, seedPhrase, keystorePassword)`, without registering a new password. The hook watches `shouldUseKeystorePassword`, but the toggle is not that form field. Its guard `shouldUseKeystorePassword && isKeystorePasswordWeak` therefore does not reliably protect reuse.
6. The hook's final selection is `ownMnemonic ? (isImportFromKeystoreFile ? keystorePassword : data.password) : data.password`. In restore/import mode, a nonempty original keystore password wins even when the user has chosen to set a replacement. `ImportWallet.tsx` passes the original password to `SetWalletPassword` on that replacement route as well. Thus merely tightening the regex would leave an import bypass and could validate one password while saving another.
7. `registerWallet` eventually calls `registerNewWallet` in `src/lib/temple/back/actions.ts`, then `Vault.spawn`. The shared onboarding submit path must validate the actual chosen new vault password before this call and before analytics/preferences/onboarding writes.

Creation: `CreateWallet.tsx` → `SetWalletPassword` → shared hook. Seed restore: `ImportWallet.tsx` / `import/ImportSeedPhrase/ImportFromSeedPhrase.tsx` → same form/hook. File restore: `ImportWallet.tsx` / `import/ImportFromKeystoreFile/ImportFromKeystoreFile.tsx` → reuse submit or replacement form → same hook. The password pattern, indicator and shared hook are unchanged relative to local `dev`; this is not a new Query/Zustand regression.

### Affected files

- `src/app/defaults.ts` — existing policy constants.
- `src/app/pages/NewWallet/import/useCreareOrRestorePassword.tsx` — policy flags, final selection, submission guard, form types.
- `src/app/pages/NewWallet/setWalletPassword/SetWalletPassword.tsx` — field validation and disabled state.
- `src/app/pages/NewWallet/import/ImportFromKeystoreFile/ImportFromKeystoreFile.tsx` — reuse toggle and secondary submission.
- `src/app/pages/NewWallet/ImportWallet.tsx` — replacement-password route and stale file-password props.
- `src/lib/ui/PasswordStrengthIndicator.tsx`, `PasswordStrengthIndicatorItem.tsx` — indicator behavior.
- `src/app/pages/NewWallet/CreateWallet.tsx` — caller verification, not necessarily an edit.

### Implementation requirements (implemented)

1. Make the current four requirements one shared pure policy, with one source for the punctuation expression. Preserve minimum length 8, lowercase/uppercase/digit checks and the currently advertised punctuation set. Do not silently broaden whitespace into a special character. Keep existing exports compatible or update all actual callers together.
2. Use that policy both to obtain the four indicator flags and to validate the password form. If retaining `PASSWORD_PATTERN`, construct its punctuation lookahead from `specialCharacterRegx.source`; do not duplicate a second character list. Add a helper for full-policy checking if needed by submission.
3. Change the special-character item to `noColor={!isPasswordError}`. Keep the initial untouched neutral state consistent with other requirements; after invalid input/submission it must be red, and green when satisfied.
4. Replace the implicit `Boolean(keystorePassword)` / unregistered `watch('shouldUseKeystorePassword')` selection with an explicit typed reuse choice supplied by the actual file-import toggle. The selected vault password must be exactly `reuse ? originalFilePassword : data.password`. In the replacement form, pass reuse=false (or omit the original file password entirely). In direct reuse submission, pass reuse=true. Update both hook callers; avoid an inaccessible required password field in reuse mode.
5. In the common submit handler, validate the selected password before `putToStorage`, preference dispatches, `setOnboardingCompleted` or `registerWallet`. Set a visible form/reuse error and return on failure; do not silently return. Reuse of a weak old file password must direct the user to choose a compliant new vault password.
6. Leave file **decryption** validation required-only: successfully decrypt a legacy file, then enforce the new policy on the resulting vault password. Keep unlock, reveal, imported account credentials and existing vault password verification unchanged.
7. Make disabled state follow the active mode: replacement requires valid password/repeat/agreement fields; reuse requires compliant original password and agreements. Add the explicit reuse field/options to the TypeScript contract, eliminating the currently untyped watched field. Clear/reset file-derived state when switching import modes so a previous file password cannot override seed restoration.

### Risks

Blocking old-file decryption or old-vault unlock would strand users. Tightening only the pattern leaves reuse unprotected. Choosing a replacement but storing the old password is particularly dangerous; test the password actually passed to `registerWallet`, not only button state. Preserve repeat-password revalidation and form submission via Enter.

### Verification requirements

- Creation and seed restore: reject `Abcdefg1`, accept `Abcdefg1!`; test each missing requirement, length 7/8, repeat mismatch, changing password after confirmation, Enter submission, pasted input and popup/full-page layouts.
- Assert invalid punctuation is red under the same timing as the other invalid requirements.
- Decrypt an existing file with a weak original password; reuse must fail visibly, replacement must succeed with the **new** password. Mock `registerWallet` to assert the exact argument and no submission side effects on failure.
- Strong old password reuse succeeds. Strong old password plus a different valid replacement must save the replacement. Switch file → seed import and ensure stale file state is unused.
- Existing weak-password vaults still unlock. Add focused policy and hook/form tests using the project's existing Jest/React DOM setup; run `yarn ts` and `yarn test --runInBand` after implementation.

### Implementation status — 2026-10-21

**Implemented.** The findings were verified against the current source before editing. Creation, seed restoration and file import now share the same four-requirement new-vault policy, including the existing punctuation set. The submit handler validates the actual selected password before preferences, storage, onboarding or registration side effects. The file-import toggle supplies an explicit typed reuse choice; replacement forms receive no original password. Weak reuse displays the existing localized `weakKeystorePassword` message and failed requirements, while replacement remains available. Changing import tabs remounts the form to clear seed/file-derived state. Legacy decryption and vault unlock production code are unchanged.

Changed implementation files:

- `src/app/defaults.ts` — shared policy flags/check and compatible pattern built from existing expressions.
- `src/app/pages/NewWallet/import/useCreareOrRestorePassword.tsx` — explicit reuse options, selected-password guard, reactive agreements and confirmation values.
- `src/app/pages/NewWallet/setWalletPassword/SetWalletPassword.tsx` — shared validation and password/confirmation/agreement disabled state.
- `src/app/pages/NewWallet/import/ImportFromKeystoreFile/ImportFromKeystoreFile.tsx` — toggle-driven reuse, visible weak-password feedback, mode-dependent disabled state and prevented native replacement submission.
- `src/app/pages/NewWallet/ImportWallet.tsx` — replacement props and tab-scoped form reset.
- `src/lib/ui/PasswordStrengthIndicator.tsx` — special-character error coloring matches other requirements.

Regression tests:

- `src/app/pages/NewWallet/password-setup.test.tsx` — policy boundaries, creation/seed forms in both layout modes, form submission, whole-value input, confirmation revalidation, indicator colors, weak/strong file reuse, replacement selection, tab reset and no writes on rejection. Successful flows assert the exact password and seed passed to `registerWallet`; React Hook Form and flow components run with presentation/service boundaries mocked.
- `src/lib/temple/front/kukai.test.ts` — real decryption of a synthetic legacy v3 file protected by a weak password, in the Node test environment.
- `src/lib/temple/back/vault/index.test.ts` — real unlock of an existing encrypted vault protected by a weak password.

Verification results:

- Focused password flow tests: **20 passed**; keystore compatibility: **1 passed**; vault suite including unlock compatibility: **4 passed**.
- `yarn ts`: **passed**.
- Full `yarn test --runInBand --watch=false`: **102 suites, 613 tests passed**.
- Targeted ESLint and Prettier checks: **passed**; `git diff --check`: **passed**.
- Installed-extension visual/manual acceptance was not performed. Both layout branches and native form-submit handling were exercised in DOM tests; actual browser paste/keyboard interaction was not separately automated.
- Existing staged RWA image changes remain untouched. No other issue was implemented; no commit or publication was performed.

### Backend dependencies

None. Do not change remote authentication or introduce a password policy on existing vault unlock.

## 2. RWA content loading — skipped

Already fixed per task instruction. No further investigation or changes proposed. Preserve the existing staged RWA image work.

## 3. Token history — backend whitelist rejection disguised as empty history

### Problem

Mavryk and one Tether contract have history, while many other owned contracts do not. A valid owned asset with indexer transfers should expose history, or explicitly report unsupported history; a request error must not look like an empty successful response.

### Confirmed root cause and actual API evidence

Base: `https://basenet.wallet.mavryk.network/api/v1`.
Wallet: `mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G`.
Request: authenticated `GET /wallets/{wallet}/tokens/{contract}/history`, **no query parameters**.

| Contract | Evidence/type | Actual response |
|---|---|---|
| `KT1VAymHKvx9oreDRqN22rf2huuYiV5ofe34` | USDt; also returned by `/wallets/{wallet}/tokens` | HTTP 200, nonempty operations; first observed hash `oovLJYuUNoyb5nJ1sa1S8oMozpqZqg1aoqBk2QhZqYjj4BAsqSa`, transfer/sent, amount 200 |
| `KT19bKTs9qsoBrspRNwsHn46YarEWuj3Vjc6` | Owned regular FA2 in indexer balances, not in sampled `/assets` catalog | HTTP 400 `unsupported_address` |
| `KT1PEbBMMPtinJhxaiBgcwNpYpRTwxsfz8KD` | Owned regular FA1.2 in indexer balances, not in sampled `/assets` catalog | HTTP 400 `unsupported_address` |
| `KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v` | wUSDT, fungible exception retained in Tokens | HTTP 400 `unsupported_address` |
| `KT1UqpQV34HZ2iGBxHtPKtdriwenu83Zy7mS` | MARS1, backend RWA catalog | HTTP 400 `unsupported_address` |
| `KT19PyrK3NKTiAfjxPJwhswgzkiMeQuawkFc` | KRKN, backend RWA catalog, observed purchase mint | HTTP 400 `unsupported_address` |

All five 400 bodies were:

```json
{"error":"Unsupported 'token_address'. Must be one of addresses from token whitelist","code":"unsupported_address"}
```

Authenticated `/wallets/{wallet}/tokens` returned only MVRK and USDt in this sample. The UI discovers additional holdings from the indexer; the history endpoint supports a narrower set. **This is not an empty backend transaction list and is not explained solely by the earlier RWA misclassification.** Both regular FA1.2 and FA2 contracts are rejected before useful history is returned. A successful wrapped-USDt transaction is separate from the whitelisted USDt contract; do not conflate their addresses/symbols.

Public corroboration: `GET https://basenet.api.mavryk.network/v1/tokens/transfers?anyof.from.to={wallet}&sort.desc=id&limit=100` returned 100 transfers, including 62 wUSDT, 14 MARS1 and 6 KRKN records in that page. This establishes that rejected contracts do have on-chain activity; counts are page counts, not lifetime totals. `/tokens/balances?account={wallet}&balance.gt=0&limit=100` also confirms regular FA1.2/FA2 holdings.

### Frontend trace and affected files

1. `src/app/pages/Home/OtherComponents/Tokens/components/TokenDetailsPopup/TokenDetailsPopup.tsx:204` supplies `assetSlug` to `HistoryComponent`.
2. `src/app/templates/History/History.tsx` invokes `useHistory(20, assetSlug, historyFilterParams)`; no filters are selected initially.
3. `src/lib/temple/history/hook.ts`, `useHistory` / `loadUserHistory`, controls loading, pagination and scope resets.
4. `src/lib/temple/history/fetch.ts:65`, `getTokenAddressFromSlug`, strips `_tokenId`. `fetchUserHistory` and `fetchUserOperationByHash` choose the contract history endpoint; MVRK uses wallet history. There is **no standard-specific or RWA-specific request branch** here.
5. `src/mavryk/api/history.ts`, `fetchTokenHistory`, `fetchHistory`, `HistoryResponseSchema`: query supports only `cursor`, `search`, `filter`. Parsing errors and HTTP errors throw.
6. `src/mavryk/api/client.ts`, request interceptor, selects the API network/authentication from storage. `chainId` is not sent as a history query parameter. `hook.ts` resets on chain/account/slug, but does not explicitly key by API-network/RPC changes.
7. `fetchUserHistory` catches the 400 and returns `{items: [], cursor, hasMore: false}`; hash search catches and returns `[]`. The hook interprets this as successful end-of-history. This confirms the frontend reason for the misleading empty screen.
8. `src/lib/temple/history/filterParams.ts` maps selected types; default unfiltered requests are not locally filtering out these records. `utils.ts` groups by hash and normalizes returned records; it cannot normalize a rejected endpoint.

Comparison: local `dev` uses the same endpoint, slug truncation, error-to-empty behavior, parser and hook. The fetch diff is only an unused parameter rename and null-cursor normalization. The architecture change is not the cause of this whitelist restriction.

### Implementation instructions

**Backend work, required for full history coverage:**

1. In the backend route/validation for `GET /api/v1/wallets/{wallet}/tokens/{token_address}/history`, replace the price/catalog whitelist prerequisite with supported on-chain token identity validation. The backend source is not in this repository, so an exact server file/function name cannot be supplied. This request and error identify the route and validation branch to change.
2. Query token transfers/mints/burns for the requested wallet and contract on the selected backend network, including internal operations and FA1.2/FA2. Do not restrict acquisition history to external `transfer` entrypoints or nonzero native amounts. Unpriced assets must still have history; unavailable price must not invalidate an operation.
3. Preserve the existing envelope `{walletAddress, operations, cursor, hasMore}`, grouped hashes, operation status and normalized summary amounts/network fees. Return HTTP 200 with an empty array only when the supported wallet/asset genuinely has no history. Keep validation/auth failures distinct.
4. Specify token-ID scoping before expanding to multi-token FA2. The current frontend requests contract-only history. Add a backward-compatible optional `tokenId` parameter and document omission semantics; maintain all existing contract-only callers. Update the frontend request type/builder and slug parsing to pass the exact ID for asset-specific screens after the server supports it. Do not silently pretend `_0` and `_1` are isolated today.
5. Test the six contracts above, including wUSDT and KRKN mint receipts, and stable pagination with search and filter retained on every page.

**Frontend work, independent of backend rollout:**

1. Stop converting transport/schema failures to `[]`/`hasMore:false` in both fetch functions. Keep a typed error with enough safe metadata to identify `unsupported_address`; current error wrapping may require extending `extractMavrykApiErrorMessage` usage or preserving the code alongside the message. Do not log tokens or wallet payloads.
2. Add an explicit history error state in `hook.ts`; catch errors, retain already loaded items/cursor on load-more failure, stop the loading indicator, and expose retry. Update `History.tsx` and hash-search handling to show unsupported-history vs temporary failure vs genuinely empty history. Do not mark end-of-history on errors.
3. Preserve endpoint/network selection and all existing operation rendering. Reuse established scoped-request techniques where fixing network-switch behavior; do not create a new global Query ownership migration for this task. Add captured account/API-network identity and reject late results on switches, including API-network changes sharing a chain ID.
4. Address pagination correctness locally: the current hook stops on zero new unique items even if `hasMore` is true; advance through duplicate/locally filtered pages when the cursor progresses, stopping on `hasMore=false` or a non-progressing cursor. `fetch.ts` slices normalized pages to `pseudoLimit` while advancing the server cursor; do not discard overflow groups. Either keep all groups returned by a server page or retain overflow before fetching the next page. Do not add an unsupported backend `limit` parameter without a contract change.
5. Keep pending-operation behavior tested separately; current pending rows are not filtered by asset identity. If adding token-ID scoping, ensure unrelated pending rows cannot appear in another token's history.

### Expected response and backend acceptance

For a supported rejected contract with real transfer/mint records, expect HTTP 200 and nonempty `operations` for that wallet/contract, preserving `hash`, `status`, timestamps, asset identity and normalized amounts. Exact historical operation counts are not fixed. For KRKN, the supplied purchase hash must be discoverable in contract/token-ID history because it mints to this wallet. For unknown/no-activity supported contracts, expect a valid empty envelope; malformed addresses and auth errors remain errors.

### Risks and verification

- Do not mask 400/401/500/schema errors as empty history, bypass authentication, replace all history with direct RPC calls, or limit discovery to the two whitelisted tokens merely to hide the symptom.
- Test unfiltered history and sent/received/interaction filters, search by hash, empty success, schema failure, offline/retry, duplicate and empty intermediary pages, pending confirmation deduplication and account/network switches during requests.
- Test FA1.2, FA2 IDs 0 and nonzero, two IDs in one contract, mint-only acquisition, regular USDt, wrapped USDt, MVRK, and an asset with no transfers.
- Add request/hook tests and extend `src/lib/temple/history/utils.test.ts` only where normalization changes. Run `yarn ts`, relevant history tests and full `yarn test --runInBand` after implementation.

### Backend dependencies

Confirmed: whitelist restriction must be addressed for full coverage. Frontend error visibility can ship independently. Token-ID parameter support requires coordinated backend/client changes. No evidence supports blaming classification for the regular-token failures.

## 4. RWA/token classification — Fixed / Verified; preserve the existing fix

### Problem and expected behavior

RWA holdings belong in RWAs; ordinary fungible tokens belong in Tokens. Membership must survive persistence reload and account/network switches without duplicating assets or losing hidden/manual choices.

### Current implementation and evidence

- `src/app/store/assets/utils.ts`, `loadAccountTokens`, fetches the wallet `/assets` catalog alongside both fungible and unknown indexer holdings, builds contract/token-0 slugs, and excludes those RWAs from **both** token branches. `loadAccountRwas` uses the same catalog. The active path does not depend on the old short symbol list.
- `src/mavryk/api/rwas.ts`, `WalletRwaAssetSchema`, `fetchWalletRwaAssets`, `walletRwaAssetToSlug`, maps catalog addresses to ID 0. There is no dynamic `assetType` discriminator in this schema or the sampled response. Catalog membership is the current API signal. Do not claim the implementation reads an `asset_type` field.
- `src/lib/assets/rwa-classification.ts` explicitly retains Basenet `KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v_0` (wUSDT) as a regular token. This is chain/contract/token-specific, not symbol-wide.
- `src/lib/store/zustand/assets-command.ts`, `applyAssetsCommand` / `assets-loaded`, repairs earlier persisted misclassifications in the sole owner. It moves catalog RWAs out of tokens, moves the exception back to tokens, preserves destination/user choices, and prevents a slower token response from reintroducing an RWA.
- `src/lib/assets/use-assets-query.ts`, `load-account-assets.ts`, `scoped-wallet-request.ts` key requests by account/chain/API network, reject late selection transitions (including A→B→A), and publish through acknowledged owner operations. Records remain account/chain scoped; no competing Redux writer is needed.
- `src/lib/metadata/classification.ts` still contains the legacy symbol helper for migration/compatibility paths. Its existence is not evidence that the current live holdings partition is broken. Scoped RWA detail readers also exclude the wUSDT exception.

Authenticated Basenet `/wallets/mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G/assets` returned wUSDT plus MARS1, OCEAN, QUEEN, NTBM, ANTH, XAUG, VOO, O, USTB and KRKN. All except wUSDT enter RWAs via catalog membership; newly listed symbols such as KRKN/ANTH/VOO do not need allowlist additions. The sampled `/tokens` response contains native MVRK and ordinary USDt; other regular indexer holdings are retained unless present in the RWA catalog.

### Affected files / fix instructions

The files listed above implement the fix already. **No additional classification changes are proposed.** Do not replace the catalog logic with `isRwa(symbol)`, expand the symbol allowlist to address live classification, remove the chain-specific exception, or add foreground repair loops.

### Verification completed and remaining acceptance

Executed and passed: `src/app/store/assets/utils.test.ts`, `src/lib/store/zustand/__tests__/rwa-classification.test.ts`, `src/lib/assets/use-assets-query.test.tsx` — 8 tests total.

These cover both indexer branches, a regular token sharing an old RWA symbol, new catalog symbols, token ID 1 remaining distinct, Basenet-vs-Mainnet exception behavior, catalog failure, account isolation, both response publication orders, preserved manual/disabled choices, owner persistence reload, and late request scopes.

Installed-extension acceptance was not performed: verify the sample wallet's tabs, reload extension/background, switch accounts and Basenet/Mainnet with slow requests, and confirm no stale category leaks. The “Fixed / Verified” status denotes source/API/test verification, not a claimed live UI session.

### Potential risks and backend dependencies

No backend change is required for the verified current catalog contract. `/assets` includes wUSDT despite its fungible role, hence retain the existing exception. Future nonzero-ID RWAs or an explicit asset-type field would need an API contract change; they are not evidence of this reported defect remaining unresolved. A catalog outage must keep the previous valid owner state and surface loading/error, not publish RWAs as tokens. Do not remove the current guards.

## 5. Primary purchases — retain received assets as well as payment

### Problem

The main wallet history must represent a primary purchase as a contract interaction with both outgoing payment and incoming purchased asset, correct units/fees/status, and one grouped hash. The sample is not a native deposit and is not absent from backend history.

### Exact API and blockchain evidence

Wallet: `mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G`.
Hash: `oodorTRhJuY8Pb7pLsWuQE6meZGE5uRFXdCKUpiKerh2M5Yu7Ca`.
Network: Basenet. Level: 6873611. Timestamp: `2026-10-19T09:00:10Z`.

Authenticated request:

```text
GET https://basenet.wallet.mavryk.network/api/v1/wallets/mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G/history?search=oodorTRhJuY8Pb7pLsWuQE6meZGE5uRFXdCKUpiKerh2M5Yu7Ca
```

HTTP 200, one parent with four nested operations. Relevant actual parent data:

```json
{
  "type": "interaction",
  "status": "applied",
  "details": {
    "type": "interaction",
    "from": "mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G",
    "to": "mv19MAVgCDwzuNMWprbHrUZhznoH8n9NWGWt",
    "tokenAddress": "KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v",
    "entrypoint": "purchase",
    "contract": "KT1U6KXwy8vduoq86HBjGp9m2Czc8rZM85MN",
    "amount": 6,
    "currency": "WUSDT",
    "usdAmount": 0
  },
  "networkFees": {
    "totalFee": 0.010438,
    "gasFee": 0.006188,
    "storageFee": 0.00425,
    "burnedFromFees": 0.00425
  }
}
```

Response cursor was `65453114261504`, `hasMore:true`; this flag is not proof of more matching hashes until the next page is fetched.

Nested operations, independently confirmed by public `GET https://basenet.api.mavryk.network/v1/operations/{hash}`:

| Operation ID | Entrypoint / target | Actual payload / effect |
|---|---|---|
| 65453111115776 | `purchase` → `KT1U6KXwy8vduoq86HBjGp9m2Czc8rZM85MN` | Native amount 0; parameter `{amount:"200000", payment:"USDT", launchName:"KRKN-issuance-v1", saleOption:"Starter", maxTotalPayment:"6000000"}` |
| 65453112164352 | `mint` → `KT19PyrK3NKTiAfjxPJwhswgzkiMeQuawkFc` | `[{owner:"mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G", amount:"200000", token_id:"0"}]` |
| 65453113212928 | `transfer` → `KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v` | FA2 `from_` is wallet; payment recipient `mv19MAVgCDwzuNMWprbHrUZhznoH8n9NWGWt`; atomic amount `5940000`, ID `0` |
| 65453114261504 | `transfer` → same wUSDT | Same sender/recipient; atomic amount `60000`, ID `0` |

Public `/v1/tokens/transfers?transactionId.in=65453112164352,65453113212928,65453114261504` returns all three asset movements. The mint has a recipient and no `from`. Backend `/assets` identifies KRKN and wUSDT with **6 decimals**. Expected economic movements: **+0.2 KRKN and -6 wUSDT** (5.94 + 0.06), with **0.010438 MVRK network fees separately**. The native transaction amount is zero; never infer “no value moved” from it. `maxTotalPayment` is a limit, not the actual debit source.

### Confirmed frontend root cause and affected files

- `src/mavryk/api/history.ts`: response parsing keeps parent details and raw nested operations. Nested records are `z.unknown()` cast into operation types, not recursively validated. The current contract supplies one normalized summary asset, but raw atomic values in children.
- `src/lib/temple/history/fetch.ts`: wallet history goes through `normalizeBackendHistoryItems` → `groupMavrykHistoryOperations` → `mavrykHistoryGroupToHistoryItem`. Default filters do not remove this purchase.
- `src/lib/temple/history/utils.ts:109`, grouping preserves the parent as `summaryOperation` and flattens the four children. `deriveBackendItemType` sees `purchase` and chooses Interaction.
- `buildBackendSummaryDisplayMoneyDiffs` uses only parent `details.amount/tokenAddress` → `[{assetSlug: wUSDT_0, diff: "-6"}]`. `mavrykHistoryGroupToHistoryItem` sets `hideOperationMoneyDiffs=true` whenever that summary exists.
- `reduceOneBackendOperation` has transfer/FA2/FA1.2 branches but no mint-shape handling. `isTzktOperParam_Fa2` in `src/lib/apis/tzkt/utils.ts:84` requires `from_`/`txs`; the mint's `{owner,amount,token_id}` array fails that guard. With no asset context in main wallet history, the mint falls through as zero native-value interaction, losing KRKN asset identity and amount.
- Raw FA2 payment amounts are extracted in atomic units; simply disabling `hideOperationMoneyDiffs` would expose a mixed-units path and double-count the parent payment. This is not a one-line rendering fix.
- `src/lib/temple/history/helpers.ts`, `buildHistoryMoneyDiffs`, prefers summary diffs exclusively.
- `src/app/templates/History/HistoryItem.tsx` and `HistoryDetailsPopup.tsx` hide operation-level amounts when the flag is set. `src/app/templates/History/utils.ts`, `getAssetsFromOperations`, also prefers summary slugs, so only payment metadata/icon is selected.

The same backend history parser/schema/rendering logic exists on local `dev`. The older branch does not contain a purchase-specific solution to restore.

### Implementation instructions — frontend-only path supported by existing data

1. Add a regression fixture containing the **actual parent and all four children** above in `src/lib/temple/history/utils.test.ts` (include the normal envelope in a request test). Assert the current loss before changing behavior. Keep this issue separate from token-history endpoint coverage.
2. Add a narrow, pure purchase movement normalizer near the backend history helpers in `utils.ts` (extract a colocated helper module if it keeps responsibilities clearer). Trigger it on the grouped parent `details.entrypoint === 'purchase'`; preserve generic summary behavior for unrelated interactions/swaps. Do not identify purchases by symbol or a hardcoded operation hash.
3. Validate nested mint parameters structurally: entrypoint `mint`, array items with owner/address, unsigned atomic amount and token ID; use the child target as token contract. Only include allocations to the viewed wallet. Handle every allocation, not just `[0]`; avoid counting transfers to another purchaser.
4. Obtain decimals for each received asset through existing scoped metadata/cached RWA data at the fetch/enrichment boundary. The pure parser must receive that data explicitly; never call hooks or fetch inside it. Reuse `walletRwaAssetToMetadata`/existing metadata resolution rather than adding another metadata owner. If decimals are unavailable, do not default to 0 or display 200000 tokens: show an unavailable amount and retain the interaction/error state until enrichment succeeds.
5. Normalize atomic mint amounts using BigNumber and token decimals exactly once. Keep parent payment amount 6 in display units. For this payload, construct display diffs `wUSDT_0: -6` and `KRKN_0: +0.2`. Continue using the parent's authoritative payment total rather than adding its two payment children again. If no trustworthy parent payment summary exists, normalize actual transfer movements with their decimals and group by contract+ID; never use `maxTotalPayment` as payment made.
6. Fill the mint child's normalized asset identity/recipient/amount so expanded details are meaningful, not a zero-MVRK interaction. Keep immutable parsing, grouped hash, timestamps and contract interaction label. Update `displayMoneyDiffs` to include all purchase assets; existing multi-asset rendering can consume it. Do not broadly turn off summary handling for every transaction.
7. Preserve parent `networkFees` without summing the parent and children; network fees are not token-payment diffs. Respect failed/backtracked/skipped status: do not claim settled purchased assets from a failed operation's intended parameters.
8. If generalizing beyond this observed purchase schema, validate the new shapes explicitly or use the backend extension below. Do not assume all contracts' `mint` entrypoints share this encoding. Fallback must preserve the original interaction and identify unavailable details rather than fabricating received balances.

### Recommended backend improvement (not strictly required for this observed payload)

The existing response contains enough raw data for the targeted frontend fix. For durable multi-asset normalization, add an **optional, backward-compatible** normalized movement list to the parent history contract, e.g. `details.assetChanges: [{tokenAddress, tokenId, amount, decimals}]` with documented signed display-unit `amount` strings. This name is a proposal, not an existing endpoint field.

For this hash the list should include `{tokenAddress:"KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v",tokenId:0,amount:"-6",decimals:6}` and `{tokenAddress:"KT19PyrK3NKTiAfjxPJwhswgzkiMeQuawkFc",tokenId:0,amount:"0.2",decimals:6}`. Derive from actual applied transfer/mint ledger effects, aggregate by exact asset identity, and retain the existing `details`/raw operations/fee fields for old clients. Do not recategorize this as a deposit or replace all operation types with a new required `purchase` type.

If that extension is chosen, validate it in `src/mavryk/api/history.ts`, map it to the existing `HistoryDisplayMoneyDiff[]` in `utils.ts`, and prefer it over the single-asset parent fallback. Coordinate contract tests for wallet and token-history endpoints. No backend field should be silently consumed without validation.

### Risks and verification

- Test this exact hash: one interaction, +0.2 KRKN, -6 wUSDT, correct network fee, and mint/transfer details. Both compact row and details popup must retain both assets.
- Test split payments, multiple mint recipients/IDs, duplicate child operations, differing decimals, large atomic strings, no metadata, failed operations, refunds and accounts other than the buyer. Do not infer that every positive parameter amount is a credit to the viewed account.
- Preserve existing swap/sell/buy-order summaries, standalone transfers, delegation/staking, pagination, pending confirmation deduplication and summary fee tests.
- Re-run `utils.test.ts`, History rendering/helper tests and `yarn ts`; then full `yarn test --runInBand`. Use installed extension acceptance for the sample hash.

### Implementation status — 2026-10-21

**Implemented for the observed frontend purchase/mint contract.** The original implementation was checked against the sample regression and failed specifically because `KRKN_0: 0.2` was absent. The repaired main history and hash-search paths normalize the parent plus all four children into one contract interaction with **+0.2 KRKN**, **-6 wUSDT**, and **0.010438 MVRK** network fees separately. The details popup uses the parent's authoritative fee totals instead of summing its children.

New decisions and amount contract:

- Only grouped parents with `details.entrypoint === 'purchase'` activate this path. Mint allocation arrays (`owner`, unsigned `amount`, unsigned `token_id`) and FA2 transfer arrays are structurally validated. No example hash, token symbol, or proposed `assetChanges` field participates in recognition.
- Raw atomic quantities and token IDs stay as strings. Validated decimals (integer 0–255) are supplied explicitly to pure normalization. BigNumber shifts atomic quantities once; parent payment amounts remain display units. API validation now preserves numeric strings in `details.amount`, including values exceeding JavaScript's safe integer precision, rather than coercing them to numbers. Numeric backend values retain their existing meaning; precision already lost by the server cannot be recovered.
- Metadata enrichment reads the exact account/chain/API-network/RPC owner scope, requests missing RWA metadata through the existing Query batch/owner publication path, and falls back to the existing on-chain metadata batch for catalog misses. It introduces no metadata owner or persistent cache. Legacy unscoped metadata is not used to infer purchase amounts.
- The buyer's authoritative outgoing payment replaces its matching outgoing children. Incoming refunds and wallet-owned mints are added; without a trustworthy summary, actual FA2 movements are aggregated by contract and token ID. Other recipients are excluded. Duplicate operation IDs do not duplicate movements. Failed, backtracked, skipped and pending groups have no settled display diffs.
- Per the user's fallback decision, unavailable amounts are **hidden**, with the mint contract visible and token ID/recipient retained in the normalized data; no estimated amount or unavailable-amount notice is shown. `atomicAmount` and `isAmountUnavailable` distinguish raw evidence from display amounts in child details. The required numeric-string compatibility placeholder is never rendered as a zero-token receipt.
- Main purchase details point to the purchase contract; mint data retains token identity and recipient. Per the design correction, the history UI omits the `#0 → address` line. Summary suppression remains active, including for unrelated history. Existing token-history endpoint selection/restriction (#3), password fix (#1), pagination and pending-operation logic are unchanged.

Changed implementation files:

- `src/lib/temple/history/purchase.ts` — pure validated movement decoding, exact decimal conversion and aggregation.
- `src/lib/temple/history/purchase-metadata.ts`, `use-purchase-metadata.ts` — scoped owner reads and existing Query metadata orchestration.
- `src/lib/temple/history/utils.ts`, `types.ts`, `helpers.ts` — purchase child normalization, explicit raw/unavailable fields, group status and empty-summary handling.
- `src/lib/temple/history/fetch.ts`, `hook.ts` — enrichment for fetched history, scope-sensitive reloads, and explicit decimals passed into normalization.
- `src/mavryk/api/history.ts` — preserve validated display-unit amount strings.
- `src/app/templates/History/History.tsx` — enrich hash searches and discard obsolete search results after scope changes.
- `src/app/templates/History/HistoryDetailsPopup.tsx`, `OperStackItem.tsx`, `utils.ts` — purchase multi-asset display, authoritative fees, meaningful mint details and asset identity retention.

Regression coverage:

- `src/lib/temple/history/purchase.fixture.ts` — documented parent and four children, with observed IDs, payloads, timestamp, level and fee fields; unspecified transport fields are omitted.
- `src/lib/temple/history/utils.test.ts` — sample purchase, immutable parsing, varying decimals, large atomic strings, recipients/IDs, duplicate children, split payments, refunds, missing metadata, unsupported mint shapes, statuses and symbol/hash independence, alongside retained generic-history tests.
- `src/lib/temple/history/fetch.test.ts` — normal API envelope, pagination/hash-search enrichment, unchanged wallet endpoint and exact display-unit strings through response parsing.
- `src/lib/temple/history/purchase-metadata.test.ts` — exact scope isolation, owner publication, catalog miss/on-chain fallback, failures and cancellation.
- `src/lib/store/zustand/__tests__/safe-initialization.test.ts` — add the scoped read-only purchase metadata consumer to the explicit architecture allowlist; destination-adapter prohibition remains enforced.
- `src/app/templates/History/purchase-rendering.test.tsx` — real compact-row/details rendering with presentation/service boundaries mocked; both assets, separate fee, and hidden unknown amounts with retained mint details.

Verification:

- Original-source sample regression: **failed as expected**, specifically on missing `+0.2 KRKN`.
- Targeted history/request/metadata/rendering tests: **5 suites, 31 tests passed**.
- `yarn ts`: **passed**.
- Full `yarn test --runInBand`: **104 suites / 636 tests passed; 1 architecture-allowlist test failed** because the new scoped owner reader was not yet listed. The allowlist was updated without relaxing the destination-adapter prohibition. A focused rerun of `src/lib/store/zustand/__tests__/safe-initialization.test.ts`: **1 suite, 2 tests passed**. All tests are verified across these runs; the already-passing 104 suites were not repeated for that test-only allowlist correction.
- Targeted ESLint (`--quiet`), Prettier, and `git diff --check`: **passed**. Existing advisory lint warnings remain.
- Design follow-up: removed the mint token-ID/recipient line. Focused rendering tests: **1 suite, 2 tests passed**; Prettier and `git diff --check`: **passed**.
- No runtime build or installed-extension acceptance was performed.

Remaining limitations:

- Installed-extension/live Basenet visual acceptance was not performed. Evidence and fixtures use the previously recorded Basenet response; no live transaction was submitted.
- Unsupported mint encodings remain generic interaction details without inferred received amounts. Fallback transfer decoding is limited to the confirmed FA2 encoding; this is not a general contract-effect interpreter.
- A metadata miss/failure hides the affected amount. Enrichment is retried when history is fetched again, subject to existing metadata receipt expiry/invalidation; already displayed history is not automatically re-normalized on unrelated metadata writes.
- The separate token-history whitelist restriction in issue #3 remains. No backend changes, commits, publication or deployment were performed.

### Backend dependencies

No missing purchase operation: the backend returns it and all four children. Frontend-only repair is feasible for the confirmed schema with scoped decimals. A normalized multi-asset response is recommended for broader reliability. The separate whitelist restriction in token-specific history remains issue #3 and is not required to repair this main Wallet History display.

## 6. Full-screen mode — prevent a white document during transition

### Problem

Changing the Full-screen setting briefly exposes white before the dark wallet view appears. Preserve current mode persistence and navigation behavior; do not add a loading screen.

### Confirmed code path / unverified visual boundary

- `src/app/templates/SettingsGeneral/Components/PopupSettings.tsx`, `handlePopupModeChange`, writes `setPopupMode(!checked)` and immediately calls `window.location.reload()`. This recreates the document and React tree, not just a layout component.
- `src/lib/popup-mode/index.ts` persists `popup_mode` in localStorage.
- `src/popup.tsx` imports CSS, creates a React root and renders App **before** checking `!isPopupWindow() || !isPopupModeEnabled()`. It then calls `openInFullPage()` and closes the popup.
- `src/app/env.ts`, `openInFullPage`, creates a browser tab for `fullpage.html`, preserving search/hash. It is not the DOM Fullscreen API or a video player's fullscreen handler.
- `src/fullpage.tsx` mounts a separate App with `WindowType.FullPage`.
- `public/fullpage.html` has no explicit HTML/body background. `public/popup.html` supplies a body utility class but no pre-CSS background color. `src/app/a11y/DocBg.tsx` applies background classes to the document root inside a React layout effect, and removes/restores them on cleanup. Background assignment therefore depends on CSS/application readiness.
- `tailwind.config.js` maps `primary-bg` to `#010101`; `PageWithImageBg` styles also use that base color. The mode handler and bootstrap behavior are unchanged relative to local `dev`.

This establishes an exposed default-background interval. No installed-extension filmstrip was captured, so the proportion of flicker caused by Chrome's native new-tab surface versus extension document painting is **not verified**. Do not promise CSS controls browser chrome outside the extension document.

### Affected files

`public/fullpage.html`, `public/popup.html`; optionally the common HTML template configuration in `webpack/base.config.ts` if needed to avoid duplicating a critical background token. `src/popup.tsx`, `src/app/a11y/DocBg.tsx`, `src/app/templates/SettingsGeneral/Components/PopupSettings.tsx`, `src/app/env.ts` are the transition/cleanup review points. Leave unrelated video fullscreen components alone.

### Implementation instructions

1. Apply the existing `#010101` fallback at document parse time in both popup/fullpage templates, before deferred JavaScript. Prefer a small shared template value or critical style for `html, body`; ensure the generated HTML contains it without waiting for React or the main CSS bundle. Keep the HTML canvas covered when the body/root is initially empty. Do not make an inline background override route/theme styles permanently: use a normal low-specificity critical CSS rule that loaded theme classes can override.
2. Preserve existing popup dimensions, fullpage min-width, root layout, images and route-specific backgrounds. Do not add viewport-height styles that change popup scroll sizing. Keep the same base fallback when `DocBg` cleans up.
3. Move the popup redirect decision before `createRoot(...).render(...)`: when fullpage redirect is required, open it and close the popup; otherwise mount App. Preserve `openInFullPage` search/hash behavior and exactly one tab creation. This avoids mounting an application destined to be immediately discarded.
4. Keep current preference persistence/reload behavior for the first focused fix. Do not replace it with an unrelated React-only fullscreen implementation or auto-close the fullpage tab when disabling the preference; the current fullpage page remains a fullpage document after reload, and the preference affects subsequent popup opening.
5. Inspect generated production HTML/CSS for immediate fallback styling. If a Chrome-native blank surface remains, capture the frame sequence and isolate it before changing tab/window lifecycle; do not introduce arbitrary timers or loading overlays.

### Risks and verification

Verify popup → fullpage, fullpage setting off, next toolbar popup, reload while locked/unlocked, cold start with slow JavaScript and CSS, repeated toggles, preserved route/query, no duplicate tabs, and Firefox. Record before/after filmstrips using the built extension, distinguishing native browser chrome from extension pixels. The extension canvas should remain dark before React mounts and during route cleanup. Confirm later theme/route backgrounds still override the fallback. Run `yarn ts` if changing bootstrap TypeScript and build Chrome/Firefox outputs to inspect templates; a snapshot-only unit test cannot establish absence of flicker.

### Backend dependencies

None.

## 7. Mavryk Pro upgrade — restore a production-safe privileged signing path

### Problem

Clicking Get Pro fails with `KYC signing is not available in frontend production builds. Server-side signing is required.` Address verification uses the same blocked path. Production must perform authorized KYC contract writes without shipping a registrar/admin secret to the extension.

### Confirmed root cause, complete flow and dev comparison

1. `src/app/pages/ProVersion/ProVersion.tsx`, `GetProVersionScreen.handleBtnClick`, calls `signKYCAction(rpcUrl, publicKeyHash, chainId)` unconditionally. On success it reads on-chain status, calls `updateAccountKYCStatus`, then navigates to success. Watch-only accounts are redirected away.
2. `src/app/pages/ProVersion/VerificationForm/VerificationForm.tsx`, `onSubmit`, resolves/validates a contract address and also calls `signKYCAction(rpcUrl, to, chainId)`. This second privileged path must be migrated too.
3. `src/app/pages/ProVersion/utils/tezosSigner.ts`, `signerTezos` → `getTestnetKYCSignerPrivateKey`, throws immediately for `NODE_ENV === 'production'`, before contract loading/submission. Development signing is allowed only on Basenet with a configured test signer.
4. `webpack/dotenv.ts` explicitly blanks `TESTNET_KYC_SIGNER_PRIVATE_KEY` in production. `package.json` sets production mode for `yarn build`. The guard is deliberate, not an erroneous environment check to remove.
5. The intended contract batch is `setMember([{updateType:'update',memberAddress:address,membershipTier:'Starter'}])`, then `setMemberKyc('addMemberKyc',[{memberAddress:address,country:'NIL',region:'NIL',investorType:'NIL'}])`, followed by one confirmation. `loadContract` and `parseTransferParamsToParamsWithKind` prepare the writes; an InMemorySigner signs them.
6. `getKYCStatusFromContract` uses a read-only toolkit, bypasses the contract cache via `loadContract(..., false)`, and requires both `memberRegistrarLedger.get(address)` and `memberKycLedger.get(address)`. Preserve this corrected lookup; `memberLedger` uses a different key shape.
7. Local `dev` used `EnvVars.SUPER_ADMIN_PRIVATE_KEY` with `InMemorySigner` and the same write batch. Commit `5c300b95` removed frontend super-admin key exposure; current guard tests intentionally preserve that remediation. Restoring the old signer is unsafe and not a solution.
8. No KYC service method exists in `src/mavryk/api/**`. This proves missing client integration, not absence of an independently deployed backend service (backend source/configuration was not available).
9. `src/lib/route3/constants.ts`, `KYC_CONTRACTS`, maps Mainnet to an empty string and Basenet to `process.env.KYC_CONTRACT`. Even with server signing, Mainnet read/status support requires a real reviewed contract mapping or an explicit unsupported-network UI.

### Affected files

- `src/app/pages/ProVersion/ProVersion.tsx` — upgrade orchestration and status update.
- `src/app/pages/ProVersion/VerificationForm/VerificationForm.tsx` — contract-address verification orchestration.
- `src/app/pages/ProVersion/utils/tezosSigner.ts`, `tezosSigner.test.ts` — preserve read-only status and signing guards; move production writes out.
- `src/lib/route3/constants.ts` — chain-to-contract configuration.
- `src/mavryk/api/client.ts`, `storage.ts`, existing auth infrastructure — reuse for authenticated scoped requests.
- Proposed new `src/mavryk/api/kyc.ts` plus schema/types as appropriate — typed service contract, not an existing endpoint.
- `webpack/dotenv.ts` — preserve production secret exclusion; do not expose new signing variables.
- `basenet_kyc_onboard.spec.ts` — existing mocked-chain contract acceptance; not a live deployment test.

### Backend implementation requirements

1. Confirm the deployed contract's registrar/admin authorization and the authorized server signer for each supported chain. Hold signer credentials in server-side secret management, never in extension build variables, storage, logs or response bodies. Supply server-controlled RPC/contract allowlists; do not accept arbitrary RPC URLs, contract calls, forged bytes or entrypoints from clients.
2. Implement/reuse an authenticated KYC service. Suggested **new contract**, subject to backend agreement: `POST /api/v1/kyc/registrations` with a target address and operation kind (`self-membership` or `contract-verification`), and `GET /api/v1/kyc/registrations/{requestId}` for status. Return validated `{requestId,status,operationHash?,errorCode?}`, with pending/confirmed/failed states. These URLs are proposals, not confirmed deployed APIs.
3. For self-membership, derive/verify wallet identity from authenticated claims and approved account ownership; a valid JWT alone must not authorize arbitrary third-party KYC. For contract verification, require the product's intended ownership/delegation/registrar permission. The current frontend only validates address syntax and is not an authorization policy. Finalize this policy with the backend/contract owner before enabling service writes.
4. Server prepares the same ordered `setMember` + `setMemberKyc` batch and signs/submits with a registrar authorized by the contract. Retain Starter/NIL behavior only where approved by the actual production onboarding policy; those placeholders do not prove real-world KYC. An ordinary user-wallet signature cannot replace registrar authorization unless the contract explicitly supports that mechanism; none is demonstrated here.
5. Use idempotency keyed by authenticated principal, network, target and requested action. Serialize/manage signer counters and funding, enforce request limits, persist operation hash/status, and handle retries after timeout without duplicate registrations. Never report success on injection alone; await the required confirmation and verify both membership/KYC ledgers. Already registered targets should return a consistent idempotent success after verification.
6. Return actionable, non-sensitive errors for unauthorized target, unsupported chain, rejected contract write, insufficient signer funds, RPC failure and confirmation timeout. Protect status access by the initiating principal/approved authorization scope. Keep audit records server-side without exposing secrets to client logs.
7. Deploy/review the missing Mainnet contract/configuration before advertising Mainnet support. If there is no approved deployment, return unsupported-network and explain it in the frontend; do not silently sign on Basenet instead.

### Frontend implementation instructions

1. Add the agreed KYC endpoint wrapper/schema under `src/mavryk/api`, using existing `mavrykApi` auth refresh and explicit captured auth/network context. Validate responses. Do not add privileged keys or raw signer APIs to the frontend.
2. Replace **both** production `signKYCAction` call sites with the service orchestration. Capture account, target, chain/API network and RPC at submission; suppress stale UI/account-status writes if selection changes. Reuse the request ID for retries and poll with bounded backoff/cancellation if the service returns pending.
3. Keep buttons disabled while submitting/pending and display server failures with retry. On timeout show pending/unknown status, not a successful KYC flag or a blind resubmission. Dispose timers/subscriptions on unmount/network switch, with the required effect comments.
4. After confirmed service completion, call existing read-only `getKYCStatusFromContract` for the captured target/chain. Only update the correct account's KYC status and navigate to success when both ledgers confirm. The contract verification flow must also verify its target, rather than declaring success simply because a POST returned 200.
5. Preserve production and non-Basenet test-signer guards and the secret exclusion in `webpack/dotenv.ts`. Production UI must not fall back to the development signer if the service fails. Keep any development-only utility explicitly isolated and tested.
6. Add explicit support checks for absent KYC contract/service configuration. Preserve watch-only restrictions and address-domain resolution; do not change registrar rights or the on-chain entrypoint payload to avoid an authorization failure.

### Risks and verification

- Privilege escalation through arbitrary target registration, duplicate writes, signer counter contention, Mainnet/Basenet mixups, stale account updates and falsely setting `isKYC=true` are the principal risks.
- Mock the service/chain boundaries: successful confirmed registration, pending/retry, unauthorized target, expired auth/refresh, unsupported chain, rejection, missing one ledger record, RPC failure, duplicate clicks and account/network switches.
- Retain `tezosSigner.test.ts` production guard tests and the two-ledger lookup test. Update `basenet_kyc_onboard.spec.ts` only as needed for the service boundary, keeping its mocked status explicit.
- Run `yarn ts`, full `yarn test --runInBand`, and production build secret checks. Separately perform authorized installed-extension/Basenet acceptance using the deployed signer service; no live transaction was sent in this investigation. Mainnet acceptance requires the approved contract deployment and signer configuration.

### Backend dependencies

**Required**: an authorized server signing/submission service or a proven contract-supported equivalent, plus ownership/eligibility authorization policy and deployment configuration. This cannot safely be fixed by removing the production guard or restoring a frontend admin key.

## Recommended implementation order

1. **Password validation (#1):** small, independent frontend correction; include file-import selection/bypass tests in the same fix.
2. **Token history (#3):** ship visible frontend error handling, and start backend whitelist/coverage work immediately. This has direct API proof and affects broad asset coverage.
3. **Pro upgrade (#7):** start backend/service authorization work in parallel with #3 because it has deployment dependencies; only wire production UI after the service contract is agreed.
4. **Primary purchases (#5):** implement the narrow frontend purchase/mint normalization using the captured response, or coordinate the normalized asset-change extension. It can proceed independently of token history coverage.
5. **Full-screen flicker (#6):** apply early background/redirect bootstrap correction and verify with installed-extension filmstrips.
6. **Classification (#4):** regression acceptance only; no new implementation. **RWA loading (#2):** skip.

## Documentation Update

This root `fixes.md` is the investigation deliverable. Each numbered issue contains its own evidence, paths, implementation steps, risks, verification and backend boundary. When implementing an issue, update its status here with the commit/reference and actual verification results. For #3 document the agreed token-ID/history contract; for #5 document atomic versus display-unit movement semantics; for #7 document approved endpoint/status/authorization/network contracts. Do not edit unrelated task handoffs or `docs/rwa-image-loading-fix.md` for these plans. Update AGENTS only if a subsequent implementation actually changes scripts, versions, conventions or testing workflow.
