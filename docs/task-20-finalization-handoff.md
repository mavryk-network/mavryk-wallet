# Task 20: local finalization and acceptance evidence

## Delivery and status

Updated 2026-10-14. The user superseded the original remote-delivery instructions:
**finish locally; do not push or create/update a remote PR**. The future integration
source remains `MAV-3974/architecture`, with `dev` as the intended base. The user will
handle remote delivery. No merge through `dev-architecture-update`, history rewrite,
replayed task queue, release tag, or merge into `dev` was performed.

Tasks 1–19 were implemented on MAV-3974/architecture. The local candidate includes
those changes and Task 20 finalization. dev-architecture-update is historical reference
only; no merge through it is required. Task 21 retirement is deferred.

Installed-extension acceptance remains **unperformed**, so this is not production
release approval. When the user opens the cumulative PR, it should remain a draft
until the outstanding acceptance matrix below is completed. PR #30 is
[historical context](https://github.com/mavryk-network/mavryk-wallet/pull/30), not this
delivery vehicle; it was not changed.

## Exact refs and environment

| Item                             | Ref / evidence                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Starting integration             | `7c32286e438666b7f35a5de52a3a6beb57998add`                                                                                            |
| Fetched dev (2026-10-13)         | `e735af469a85b56fc140999b345989d41afbeadc`                                                                                            |
| Fetched remote integration       | `c02dcd4597b8c8eb067a64bcc878839d1e06ea34`                                                                                            |
| Preserved finalization documents | `0d29e08f`                                                                                                                            |
| Reviewed dev reconciliation      | `38144252`                                                                                                                            |
| Automated verification candidate | `973a742fc3a677455dee22b3ebff5b993b82a335`                                                                                            |
| Candidate Git tree               | `88bcc9bfd94bde81e1704d36a5002984d23e59a3`                                                                                            |
| Environment                      | macOS/Darwin arm64; Node 22.11.0; Yarn 1.22.22; TypeScript 4.9.5; Jest 27.4.5; ts-jest 27.1.1                                         |
| Build configuration              | Existing local build environment; no new credentials or production signing key added. Builds do not prove live endpoint availability. |

Root install/type-check ran at `8ab0ed2fab3eb9abe861ea238f1236a080b4d77c`.
The only executable-tree change to the final candidate is `webpack/env.ts` making
TARGET_BROWSER optional in its type declaration. Root `src/`, `tsconfig.json`,
manifest and lockfile inputs are identical; the affected manifest test and browser
builds are verified on the final candidate.

The final handoff commit is a documentation-only descendant of the tested candidate;
its exact hash is reported at delivery. Detailed logs are outside the repository at
`/private/tmp/mavryk-task20/`. Local temporary logs/artifacts are not permanent CI
artifacts. No remote head or CI run at the final local ref is claimed.

## Tasks 1–19 coverage

Each implementation/integration ref below was verified as an ancestor of the
candidate. Current code, task diffs and the linked handoffs were reviewed against
`origin/dev`, including owner imports, root epic registration, Query keys,
compatibility readers, intercom paths and dormant endpoint guards. This accounts for
implementation coverage; it does not turn historical checks into current acceptance.
Full SHAs can be resolved from the unique abbreviations in this repository.

| Task | Implementation → integration                                            | Current area and verification reference                                                                 | Outstanding acceptance                                                        |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1    | `2c9c1a78` → `356cdfdb`                                                 | [Branch/sync ledger](pr-30-branch-alignment-dev-sync-ledger.md); API/auth/contacts provenance           | Reconciled in Task 20                                                         |
| 2    | `aa676b30` → `4eec7e05`                                                 | `.github/workflows/ci.yml`; Task 20 adds dev PR target                                                  | Remote run is user-owned                                                      |
| 3    | `5c300b95` → `f5e6ce95`                                                 | Build key de-injection; `webpack/dotenv.ts`, ProVersion signer; new KYC guard tests                     | Installed Pro/KYC smoke; server-side signing remains separate                 |
| 4    | `0851c94e`, `aff81c2e`, `dba34c9c`, `40df4b1d` → `2fb03f95`             | Home/staking/history/confirmation fixes; current cumulative diff                                        | Installed affected UI smoke                                                   |
| 5    | `611f2f80` (direct integration)                                         | `dryrun.test.ts`, `dapp.test.ts`, page-message and manifest tests                                       | dApp operations/sign/confirmation and Firefox smoke                           |
| 6    | `642ebbb0` → `dab8138c`                                                 | Book-scoping/FileTransfer lineage; `src/app/compound/FileTransfer/index.test.tsx`                       | Contacts import/export smoke; incoming commit already on dev                  |
| 7    | `811ff277` → `29ae45ed`                                                 | Exact runtime pins and lockfile; Task 20 approves only TS 4.9.5 exception                               | None beyond final checks                                                      |
| 8    | `b63c0196` → `494b33f1`                                                 | Intercom client, timeout classification and cold GetState tests                                         | Timed confirmations and actual worker eviction                                |
| 9    | `64a83afb` → `296e9703`                                                 | Swap hook, selectors, query-key and submission-gate tests                                               | Two-block quote refresh in supported flow                                     |
| 10   | `8287461a` → `9789f42c`                                                 | [Zustand foundation](task-10-zustand-foundation.md); real adapters/hydration tests                      | Installed durable read-back                                                   |
| 11   | `8c4dc916` → `dc8f3f7f`                                                 | [UI/identity migration](task-11-legacy-ui-handoff.md)                                                   | Supported-profile upgrade, consent/ID and two reloads                         |
| 12   | `23264021`, `ed238dcb` → `36e24bf6`                                     | [Retirement ledger](task-12-legacy-retirement-ledger.md); deletion markers waived                       | External tracker destination still unavailable; ready-to-file ledger retained |
| 13   | `b439003b` → `77de9891`                                                 | [Nested assets/flags/promotion migration](task-13-legacy-assets-handoff.md)                             | Real profile upgrades and interruption recovery                               |
| 14   | `a95d61f8` → `d524bb82`                                                 | [IndexedDB safety](task-14-indexeddb-assets-handoff.md); Dexie/Web Lock tests                           | Supported pre-2.0.0 profile and interrupted cleanup                           |
| 15   | `a5a773f3` → `b816dceb`                                                 | [Reactive batch details](task-15-reactive-details-handoff.md)                                           | Grid/list/detail loading and scope switches                                   |
| 16   | `0b5959d1` through `784da496` → `f8ae4764`                              | [Query server domains](task-16-query-only-server-domains-handoff.md); full per-domain commit list there | Rates/card flows; dormant endpoints stay off                                  |
| 17   | `3117e1d2`, `8a13df88`, `8d4d5ff7`, `ed0340c5` → `c02dcd45`             | [Assets/security ownership](task-17-assets-security-ownership-handoff.md)                               | Offline scam labels and unknown/empty/error distinction                       |
| 18   | `32fc8d1b`, `18b5b25b`, `67fadceb`, `657e8c84`, `aea0926d` → `ae1aa410` | [Metadata ownership](task-18-metadata-ownership-handoff.md)                                             | Custom RPC, scoped save/refresh and delayed acknowledgement                   |
| 19   | `5e7fbd43`, `e626b271`, `c54cb3a6` → `7c32286e`                         | [Balance ownership](task-19-balances-ownership-handoff.md)                                              | Offline/other-account balances, reconnect/block updates                       |

The cumulative API diff is empty under `src/mavryk/api/**`; this is observed
provenance, not a blanket requirement that all future intentional API diffs be empty.
Current contacts/auth lineage is already on dev. Background durable owners,
foreground read-only snapshots/commands, scoped Query receipts and server-data
ownership remain as documented. Live unrelated Redux/SWR/Effector domains and
`src/intercom-client.ts` remain. This is not wholesale adoption of PR #30's product
features or removal of those stacks.

## Task 20 fixes and approvals

- Merged the reviewed incoming dev KYC ledger correction directly, preserving 3.0.0,
  signing guards and Task 19 balance parsing. See the appended sync ledger.
- Added `dev` to PR CI targets, retaining both existing targets. Install, type-check
  and tests remain blocking. Tests now execute after a successful install even when
  type-check fails; lint retains its existing advisory status.
- User explicitly approved **TypeScript 4.5.5 → 4.9.5 only**. Existing ts-jest accepts
  `>=3.8 <5.0`; no Jest, React, Query, Zustand, WebMavryk or other dependency changed.
  A manifest/lockfile comparison proved only this dependency and its single lock
  entry changed. Historical handoff pins remain historical, not current instructions.
- Moved Axios augmentation out of the global asset declaration file, restoring
  SVG/CSS/image declarations and `ImportedSVGComponent`. Explicit ambient types
  enumerate the globals actually used, avoiding automatic inclusion of the installed
  empty `@types/minimatch` stub. Imported package declarations are still checked by
  normal resolution; strictness, unused checks and existing skipLibCheck policy are
  unchanged. No diagnostics suppression or test exclusion was added. The optional build
  TARGET_BROWSER declaration now matches its existing Chrome default.
- Corrected existing typings for Apollo variables, request wallet ID, network/literal
  narrowing, contacts cache/null handling, history filters/cursors and presentation
  previews. RWA's old Objkt mapper now declares its actual collectible-shaped return;
  optional legacy listing typing preserves the existing absence fallback. No endpoint
  activation, persistence-key change or new owner was introduced.
- Passed the RPC-reported chain ID when importing fundraiser accounts; removed an
  ignored fourth managed-account argument. Contact history's display-only watch
  account now has its required chain and stable address-derived ID; it is not saved
  as a wallet account. Reconnect guards retain the existing socket lifecycle.
- Replaced the stale Taquito batch-operation type import with the installed WebMavryk
  type. Restored the missing `hash` success renderer for swaps using existing hash,
  translation and explorer components; navigation now uses typed success data and
  `opHash`, without suppression comments. Added rendering regression coverage.
- Removed only compiler-reported unused bindings/imports and an uncalled staking
  interpolation helper. This is type-check cleanup, not Task 21 bridge/storage/domain
  retirement.

### Restored failing test coverage

`basenet_kyc_onboard.spec.ts` entered the repository in `d0884067` as an incomplete
Mocha-style deployment fragment: missing `Utils`, `before`, `load`, `save`, `KYC_ADDR`
and `BUYER`, no imports, no assertions, and live admin-key transaction intent. No
owning helper implementation exists in the tracked repository or introducing commit.
After the user's instruction to restore it, it became executable Jest coverage of
the wallet's real `signKYCAction`, with mocked chain transport. It verifies:

- Basenet toolkit/signer setup and `Starter` membership for the buyer;
- exact NIL country/region/investor KYC fields and the two-operation batch;
- one confirmation, no premature completion, and propagated send/confirmation
  failures without automatic resubmission.

It no longer depends on deployment secrets or nonexistent harness globals. This is
**not restoration of a live deployment harness**: admin provisioning, persistent
on-chain checkpoint/replay and actual Basenet execution remain unverified. New
colocated signer tests also verify address-keyed membership lookup, required KYC,
RPC errors and the production/non-Basenet/missing-key guards.

The other three recorded Jest failures were repaired without excluding suites:
valid account fixture fields, removal of unused amount-helper imports, and exact
Beacon seed-byte assertions across Node/jsdom realms with a typed mock.

## Automated verification

The final candidate passes the checks recorded below. Earlier diagnostic
runs are not acceptance: the initial full Jest run overlapped a temporary merge
conflict and was discarded. The first full candidate Jest run passed 94 suites / 563 tests and failed only
`webpack/manifest.test.ts` on the required TARGET_BROWSER declaration; its targeted
rerun passed both tests after the correction. The 434→54 supplemental semantic count is diagnostic
history only; it is not substituted for the final `yarn ts` exit status.

| Check                                                          | Result                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Focused regression before full verification                    | 13 suites / 76 tests passed                                      |
| Frozen install (`8ab0ed2f`, identical final dependency inputs) | Passed, exit 0; `final-install.log`                              |
| `yarn ts` (`8ab0ed2f`, identical final root compiler inputs)   | Passed, exit 0; `final-ts.log`                                   |
| Final `CI=true yarn test --maxWorkers=2` (`973a742f`)          | Passed, 95 suites / 565 tests; `final-test-fixed.log`            |
| Chrome `yarn build` (`973a742f`)                               | Passed, exit 0; `final-chrome-fixed.log`                         |
| Firefox `yarn build:firefox` (`973a742f`)                      | Passed, exit 0; `final-firefox.log`                              |
| Changed-source ESLint / formatting / diff check                | Passed; `final-lint.log`, `final-format.log`, `git diff --check` |
| Remote checks                                                  | Not run for local candidate; remote work explicitly left to user |

### Built artifacts

Both production archives report version 3.0.0. Chrome uses manifest v3 and Firefox
uses manifest v2, matching the existing target configuration. Static inspection
found no `SUPER_ADMIN_PRIVATE_KEY` reference or edsk-shaped private-key literal in
the bundled JavaScript. This limited scan is not live security or installed-browser
acceptance. Production key de-injection and signing guards are also covered by tests.

| Local artifact     | SHA-256                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `dist/chrome.zip`  | `e2ce68adcca1fdc4358b76771dc8b8dca251d41a80ef739b19ccc997fa4cb37e` |
| `dist/firefox.xpi` | `3c93ffd374d0d678aae7cfdc4b74509cdf165e59854f0452a04a096f3baefe69` |

Builds retain existing stale Browserslist data, webpack-extension-target deprecation,
and model-viewer dynamic-dependency warnings. No dependency was upgraded to suppress
them; installed 3D collectible rendering is part of the outstanding UI smoke. Archives are local ignored output, not committed release artifacts.

On 2026-10-13 the GitHub branch-protection endpoint returned `404: Branch not
protected` for dev. That is not proof about repository rulesets; no settings were
changed. The workflow now covers dev PRs, but remote execution/enforcement must be
verified by the user during delivery. No green remote CI claim is made.

## Installed-extension acceptance and remaining release gate

Browser inventory was rechecked on 2026-10-14 and returned `apps: []`, `browsers: []`. No connected installed
extension, disposable profile, supported production-profile fixture, or browser
build/version evidence was available. No manual check or wallet transaction passed
by inference. Automated mock/React DOM/Dexie tests support, but do not replace:

| Required check                                                                                                                                    | Actual result / what is needed                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Supported production upgrade; custom assets/statuses, adult flags, UI/analytics/promotion, metadata/balances; durable read-back and two reloads   | Not run. Provide disposable production and candidate profiles and sanitized fixture inventory.                                    |
| Pre-2.0.0 IndexedDB and interrupted migrations                                                                                                    | Not run. Use supported legacy fixture and interruption points from Tasks 11/13/14; inspect destination durability before cleanup. |
| Near-timeout/auto-decline confirmations; dApp connect/permission/operation/sign; MV3 eviction                                                     | Not run. Connected Chrome MV3 and disposable test wallet/dApp required. Record actual timing and recovery.                        |
| Two-block quote refresh and submit disabled during refetch                                                                                        | Not run. Use an existing supported swap flow; do not enable dormant list endpoints.                                               |
| Offline cold balances/metadata/scam labels; unknown vs empty/error                                                                                | Not run. Persist fixtures, block transport, restart, inspect rendering and storage.                                               |
| Account/chain/API-network/custom-RPC isolation; other-account totals; manual assets/save/refresh; delayed/failed acknowledgement; reconnect/block | Not run. Exercise the scoped scenarios from Tasks 17–19 in a disposable profile.                                                  |
| API/auth/contacts, KYC/key safeguards, details, rates/card and changed UI                                                                         | Not run. Smoke actual shipped surfaces on both built browser targets, with non-production data.                                   |

Task 12's external retirement ticket still needs the established tracker destination
and access. Its ready-to-file ledger remains canonical. No issue URL was invented.

## Rollback and recovery

Retain all legacy sources, active `persist:temple-root-task11`, destination envelopes,
analytics identity/consent, migration history and Web Locks. Retained old snapshots
become stale after owner writes; reverting code alone is not a safe data downgrade.
Preserve a local profile backup before acceptance and validate any recovery procedure
against both legacy and new destinations without exporting credentials in logs.

Owner commands are acknowledged only after flush/read-back, but cross-store writes
are not transactional. On interruption, use existing retry/readiness gates to drain
retained writes and re-verify; do not clear completion flags, rename keys, replay old
snapshots over newer choices or add competing foreground adapters. Task 14 may have
already deleted verified IndexedDB rows; a code revert cannot resurrect them. Old
and new versions running concurrently do not share the same coordination protocol.
Historical metadata/balance provenance cannot be reconstructed; unscoped fallback
may alias until replaced by an exact scoped record.

Use the task handoffs' supported upgrade/recovery policies and require an approved
downgrade policy before a release rollback. Keep Tasks 1–19 commits for traceability;
Task 21 retirement remains a separate, evidence-gated future release.

## Documentation Update

Updated AGENTS for the approved compiler and CI/test workflow; appended fresh sync
evidence to the existing ledger; updated `finalize.md` and both root plans with the
user's local-only delivery instruction. This handoff adds current coverage, tested
refs, results, limitations and recovery considerations without rewriting historical
handoff evidence.
