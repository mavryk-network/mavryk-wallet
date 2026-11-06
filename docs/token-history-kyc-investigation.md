# Token history and KYC investigation

## Interaction token amounts

History summary diffs retain the API `currency` as the display symbol. The row and
interaction detail popup can render API display amounts without cached token
metadata; fiat rendering still requires metadata. `details.amount` takes precedence
(including zero and precise decimal strings). Only when it is absent does
`details.rawAmount` use token decimals from the existing scoped metadata resolver
and decimal conversion helper. Missing decimals leave raw quantities hidden.
Grouped summaries and single interaction records share this behavior; nested raw
operations are not counted again as summary amounts.

The supplied `refunnd.json` contains `4.26 OCEAN`; `4.5` is an illustrative amount,
not an override. Sanitized regression fixtures cover both values, raw fallback,
missing metadata, outgoing interactions, and list/detail rendering. Existing
purchase, pending, filtering and pagination coverage remains in the history suites.
Follow-up verification with a fresh temporary credential returned HTTP 200 from
Basenet wallet history. Its latest refund matches the supplied fixture:
`details.amount = 4.26`, `details.currency = OCEAN`, while nested operation amounts
are zero. The complete live page passed API validation and rendered `+4.26 OCEAN`
in both the compact row and detail header in the local regression harness. A
permanent API-to-render test uses an anonymized refund fixture and a string token
ID, matching the wire format. Records with `amount` do not require `rawAmount`.
The credential is not stored in project files.

The user still reported a missing amount in the running Chrome extension. This
runtime discrepancy was not reproduced from the fixture or live wallet response.
The generated Chrome bundle contains the symbol fallback; reload the extension
from `dist/chrome_unpacked` and reopen its pages after rebuilding. Expanded child
rows retain the existing grouped-summary suppression to avoid displaying raw
atomic quantities or double-counting the summary.

The follow-up production build initially failed on cached ESLint formatting errors
for source files that already passed Prettier. Running the existing
`yarn clear:lint` command removed that blocker. `yarn build` then passed Webpack,
chunk-size checks and Chrome ZIP packaging. TypeScript and all five history
rendering tests passed. No further production history logic changed in this
follow-up; installed-extension confirmation still requires reloading and reopening
the wallet.

## Native token history

The shared history selector previously mapped both an absent asset slug and the
native `mav` slug to wallet-wide history. Native-token requests now use
`/wallets/{walletAddress}/tokens/mv2ZZZZZZZZZZZZZZZZZZZZZZZZZZZDXMF2d/history`.
This applies to initial loads, cursor pagination, filters and operation-hash lookup.
An absent slug still selects wallet history. Other token slugs still use the
contract address before the underscore; token IDs do not change URL selection.

Regression coverage is in `src/lib/temple/history/fetch.test.ts`.

Follow-up: the address is exported as `MVRK_HISTORY_TOKEN_ADDRESS` from
`src/lib/temple/history/consts.tsx`. The token popup now normalizes an empty
selection to `MAV_TOKEN_SLUG` as well as using the native slug on open. Previously,
clearing the selection on close could pass an empty slug to history during the
modal's close animation and select the wallet-wide endpoint. Popup rendering
regressions cover native, empty and other-token slugs. The current open-token path
already forwards `mav`; observing only wallet-wide requests when opening MVRK
requires checking that the extension has loaded the rebuilt bundle.
Follow-up verification: all nine fetch/popup regression tests, TypeScript,
formatting, production build, chunk-size check and ZIP packaging passed.
The generated `dist/chrome_unpacked` bundle contains the native history address;
reload that unpacked extension (or install the rebuilt archive) before retesting.

The popup now also supplies `MVRK_HISTORY_TOKEN_ADDRESS` explicitly via the
`HistoryComponent.tokenAddress` prop. The history hook and hash search forward
that address to the fetch functions, where it takes precedence over slug-derived
routing. The display asset slug remains `mav`. Other-token and wallet-level
callers retain their existing routing. Ten popup/fetch regression tests and
TypeScript checking pass, including an explicit-address request without a slug.

## Basenet KYC production build fix

The source previously rejected `NODE_ENV=production` in
`src/app/pages/ProVersion/utils/tezosSigner.ts`. Independently,
`webpack/dotenv.ts` replaced `TESTNET_KYC_SIGNER_PRIVATE_KEY` with an empty string
in production bundles. Local signing was limited to Basenet and used the configured
registrar key to batch `setMember` and `setMemberKyc`, awaiting one confirmation.
These restrictions predate this investigation; see the Task 3 entry in
[the Task 20 handoff](task-20-finalization-handoff.md).

The user clarified that the release must support Basenet. Build mode no longer
controls this testnet feature: both development and production builds include the
explicitly configured test key, and the signer still rejects non-Basenet chains
and missing keys. The batch, membership lookup and confirmation behavior are unchanged.
`SUPER_ADMIN_PRIVATE_KEY` remains excluded from public build variables. Mainnet
signing remains disabled and its contract mapping remains empty.

For local release builds, configure `KYC_CONTRACT` and the optional
`TESTNET_KYC_SIGNER_PRIVATE_KEY` in a supported `.env` file and run `yarn build`.
The test signer must be an authorized, funded registrar on that Basenet contract.
For the deploy workflow, configure the corresponding GitHub secrets; the workflow
now passes the optional test signer setting into the build. No remote secrets were
changed during this task. The registrar key is public in the extension bundle:
use only a Basenet test key, never a Mainnet or production/admin key.

## Verification

- Six history tests pass, covering wallet, MVRK, other token IDs, cursor/filter
  preservation and hash search.
- Eleven KYC/build regression tests pass, exercising development and production batching,
  confirmation waiting, send/confirmation failures, network/key guards and build
  variable inclusion/exclusion using dummy keys.
- TypeScript checking and formatting of the changed TypeScript files pass.
- Production webpack compilation, chunk-size validation and ZIP packaging pass.
  Bundle inspection confirms the native history address, configured Basenet test
  signer and retained Basenet guard; the production signing block is absent.
- The full-suite run passed 105 suites and failed one KYC guard test after loading
  pre-edit signer code while the test file changed. All affected KYC suites passed
  in a fresh run after editing; unaffected passing suites were not repeated.
- Local configuration uses the same value for the test key and legacy admin key.
  Excluding the admin variable cannot exclude a value also supplied as the test key.
  Before distributing the generated build, verify that this credential is exclusively
  for Basenet testing or replace it with a dedicated Basenet test registrar key.
- Live Wallet API results and installed-extension KYC submission have not been
  verified. Mocked transport tests do not establish production acceptance.
