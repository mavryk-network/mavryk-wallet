# E2E Migration Handoff

Last updated: 2026-06-11

## Current Status

Estimated completion: 25%.

The E2E package now installs and typechecks after dependency and infrastructure repairs. A smoke scenario has been added and Cucumber dry-run succeeds. The extension full build has completed; the real browser smoke run is next.

## Framework And Versions

- Framework: Cucumber.js with Puppeteer.
- Runner package: `@cucumber/cucumber` pinned in `e2e/package.json` as `^9.6.0`.
- Browser automation: `puppeteer-core` pinned as `^24.43.1`.
- TypeScript: local E2E dependency `typescript@4.5.5`, matching the root project.
- Node types: `@types/node@16.11.7`, matching the root project.
- Assertion library: `chai@^4.5.0` with `@types/chai@^4.3.20`.
- Runtime transpilation: `ts-node@^10.9.2` and `tsconfig-paths@^4.2.0`.

Decision: Cucumber 11.3.0 was tested because it supports Node 22, but it pulls `type-fest` declarations that require newer TypeScript syntax and fail under TypeScript 4.5.5. Keep Cucumber 9.6.0 until the main repo can move to a newer TypeScript version.

## Dependency Updates

- Updated Cucumber from `^9.4.0` to `^9.6.0`.
- Replaced `puppeteer@^19.11.1` with `puppeteer-core@^24.43.1`.
- Removed `puppeteer-screen-recorder`; it was tied to old Puppeteer and only used in hooks.
- Updated `chai` and `@types/chai`.
- Updated `dotenv`.
- Updated `ts-node`.
- Added explicit `typescript`, `@types/node`, and `tsconfig-paths` dependencies to avoid relying on parent `node_modules`.
- Updated `e2e/yarn.lock`.

Important install note: `puppeteer` was replaced with `puppeteer-core` because Puppeteer postinstall attempted to download Chrome and failed on a corrupt cache outside the repo. The runner now detects system Chrome or uses `E2E_CHROME_EXECUTABLE_PATH`.

## Tests Removed

Removed obsolete or currently unreachable tests and their direct support code:

- `change-node.feature`
  - Reason: old header network dropdown selector is no longer rendered by current `PageLayout/Header`.
- `custom-network.feature`
  - Reason: old settings-based custom network flow and selector path no longer exist.
- `delegate.feature`
  - Reason: old delegation route/flow has been replaced by current stake/manage-stake flows.
- `notifications.feature`
  - Reason: `/notifications` routes are commented out in `src/app/PageRouter.tsx`.
- `swap.feature`
  - Reason: `/swap` route is commented out and Home swap button is disabled without a test id.

Deleted related step definitions and page objects for those removed features.

## Tests Updated

- `create-new-wallet.feature`
  - Removed duplicated skip-onboarding scenario.
  - Updated remaining onboarding scenario to click the required beta agreement checkbox.
  - Removed waits for on-ramp and newsletter overlays because both overlays are currently commented out in `PageLayout`.
- Shared imported-wallet setup:
  - Added required beta agreement click.
  - Removed obsolete newsletter modal wait.
  - Added explicit missing-env errors for imported-account data.
- `HomePage` page object:
  - Removed waits for buy, withdraw, and swap controls because buy/withdraw are commented and disabled swap does not expose its test id.
  - Added RWA tab wait to match current Home tabs.
- Browser setup:
  - Removed video recorder lifecycle.
  - Defaulted to headless Chrome.
  - Added system Chrome detection and `E2E_CHROME_EXECUTABLE_PATH` override.
- Env handling:
  - Removed import-time failure for every historical env var.
  - Added `requireE2eValue` for explicit scenario-time failures.
  - Added non-sensitive default password `E2ePassword123!` for generated-wallet smoke tests.

## Tests Added

- `smoke.feature`
  - `@smoke` scenario: create a new wallet, skip onboarding, accept required checkboxes, and reach Home.
  - Purpose: provides a minimal working foundation that does not require private seed data in `e2e/.env`.

## Verification Completed

- `yarn install` from `e2e/`: passed.
- `yarn ts` from `e2e/`: passed.
- `yarn start:smoke --dry-run` from `e2e/`: passed.
- Root `npm run build`: passed with one existing webpack warning from `@google/model-viewer/lib/three-components/TextureUtils.js`.

Current warning:

- Cucumber 9 emits a Node 22.11 warning: this Node version has not been tested with this Cucumber version. Cucumber 11 was attempted and rejected because it is incompatible with TypeScript 4.5.5.

## Remaining Broken Or Unverified Tests

The remaining legacy features compile but are not proven current:

- `address-book.feature`
- `collectibles.feature`
- `create-or-restore-an-account.feature`
- `home.feature`
- `import-account-by-mnemonic.feature`
- `import-account-by-private-key.feature`
- `import-account-by-public-key.feature`
- `import-existing-wallet.feature`
- `manage-tokens-nfts.feature`
- `remove-account.feature`
- `reveal-private-key.feature`
- `reveal-seed-phrase.feature`
- `send.feature`
- `switch-account.feature`
- `unlock-screen.feature`

Known likely breakages:

- Header/account dropdown flows are outdated. Current full-page UI uses account and settings popups, and several old action test IDs are not reachable the same way.
- Network switching/custom network coverage needs redesign against current `NetworkPopup` and `/add-network`.
- Live transaction flows such as send rely on external network state and funded accounts.
- Token/NFT fixtures still reference old Tezos-era symbols and slugs such as `kUSD`, `uUSD`, `WTZ`, `wUSDT`, `OBJKTCOM`, and old NFT names.
- Some tests still require many `.env` values and should be split into smoke/local-only vs live-network suites.

## Current Blockers

- Browser smoke test still needs to be run against freshly rebuilt `dist/chrome_unpacked`.
- A modern Cucumber upgrade is blocked by root TypeScript 4.5.5.

## Remaining Work

1. Rebuild the Chrome extension with the full root build.
2. Run `yarn test` from `e2e/` and fix the smoke scenario until it passes in a real browser.
3. Audit remaining feature files one by one against `src/app/PageRouter.tsx` and current selectors.
4. Split suites by dependency profile:
   - `@smoke`: local, deterministic, no private seed or live network required.
   - `@wallet-local`: local wallet state flows requiring test mnemonic/private keys.
   - `@live-network`: send/stake/token operations requiring funded accounts and RPC/API availability.
5. Replace old account dropdown navigation steps with current route or popup-specific steps.
6. Rebuild network, contacts, manage-assets, unlock, import-account, and send coverage on current UI.
7. Add stable test ids where current UI has actions without test ids, especially settings popup and network popup actions.

## Recommended Next Steps

Immediate next session:

1. Run full root build: `npm run build`.
2. Run E2E smoke: `cd e2e && yarn test`.
3. Fix runtime failures in `smoke.feature` and its page objects.
4. Add one more deterministic smoke scenario for importing a known public test mnemonic if the project accepts a checked-in public test mnemonic.
5. Continue pruning or updating remaining features in small groups.

Coverage target:

- Good current E2E coverage likely requires 3-5 focused sessions:
  - 1 session for smoke/local setup stabilization.
  - 1-2 sessions for onboarding/import/unlock/account management.
  - 1 session for assets/contacts/settings.
  - 1 session for live-network operations, assuming funded test accounts and stable RPC/API fixtures are available.
