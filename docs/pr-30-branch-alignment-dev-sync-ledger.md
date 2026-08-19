# PR #30 Branch Alignment And Dev Sync Ledger

Date: 2026-08-19

## Branch Rule

`MAV-3974/architecture` is the architecture integration branch.
`dev-architecture-update` is only a PR #30 reference branch.

Do not merge PR #30 wholesale. Do not edit `src/mavryk/api/**` as remediation work.

## Compared Refs

Refs were refreshed with:

```bash
git fetch origin dev MAV-3974/architecture dev-architecture-update pull/30/head:refs/remotes/origin/pr/30
```

Observed refs:

| Ref | Commit | Notes |
| --- | --- | --- |
| `origin/dev` | `80379e38` | Current production/dev target, tag `v2.0.7` |
| `origin/MAV-3974/architecture` | `46592293` | Architecture integration branch |
| `origin/pr/30` | `523a21a3` | PR #30 head, same as `origin/dev-architecture-update` |
| PR #30 base | `67cdf83f` | GitHub PR base SHA reported by `gh pr view 30` |

PR #30 status from GitHub:

| Field | Value |
| --- | --- |
| URL | `https://github.com/mavryk-network/mavryk-wallet/pull/30` |
| State | `OPEN` |
| Mergeable | `CONFLICTING` |
| Base | `dev` |
| Head | `dev-architecture-update` |
| Updated | `2026-08-18T07:07:28Z` |

Merge bases:

| Pair | Merge base | Result |
| --- | --- | --- |
| `origin/dev` vs. `origin/MAV-3974/architecture` | `80379e38` | `origin/dev` is already contained in the architecture branch |
| `origin/dev` vs. `origin/pr/30` | `67cdf83f` | PR #30 is behind current `dev` lineage |
| `origin/MAV-3974/architecture` vs. `origin/pr/30` | `67cdf83f` | PR #30 and the architecture branch diverge before the current auth/API/contacts line |

Ahead/behind counts:

| Comparison | Left-only | Right-only |
| --- | ---: | ---: |
| `origin/dev...origin/MAV-3974/architecture` | 0 | 7 |
| `origin/dev...origin/pr/30` | 22 | 144 |
| `origin/MAV-3974/architecture...origin/pr/30` | 29 | 144 |

## Sync Decision

No runtime code sync was performed for this task.

`origin/dev` is already an ancestor of `MAV-3974/architecture`, so there is no latest `dev` lineage to merge. A direct PR #30 merge is not safe: a read-only merge simulation against `origin/MAV-3974/architecture` reports conflicts in 29 files, including reserved `src/mavryk/api` files.

This task records the ledger and stops before code porting because the PR #30 port requires owner decisions listed below.

## PR #30 Merge Conflict Surface

Read-only simulation:

```bash
git merge-tree --write-tree --name-only --messages origin/MAV-3974/architecture origin/pr/30
```

Conflicted files:

```text
jest.config.ts
jest.setup.js
package.json
src/app/layouts/PageLayout/Header/SettingsPopup/SettingsPopup.tsx
src/app/pages/EditAccount/EditAccount.tsx
src/app/pages/EditAccount/popups/EditAccountNamePopup.tsx
src/app/pages/ProVersion/ProVersion.tsx
src/app/store/index.ts
src/app/templates/SendForm/AddContactModal.tsx
src/content-scripts/replace-ads/observing.ts
src/contentScript.ts
src/lib/apis/mvkt/api.ts
src/lib/apis/temple/metadata.ts
src/lib/intercom/server.ts
src/lib/temple/back/actions.ts
src/lib/temple/back/dapp.ts
src/lib/temple/back/main.ts
src/lib/temple/back/vault/session-store.ts
src/lib/temple/front/address-book.ts
src/lib/temple/front/client.ts
src/lib/temple/front/contacts-settings.ts
src/lib/temple/front/tzkt-connection.tsx
src/lib/temple/front/use-contacts-sync.hook.ts
src/lib/temple/front/use-filtered-contacts.hook.ts
src/lib/webmavryk-fast-rpc/index.ts
src/mavryk/api/client.ts
src/mavryk/api/storage.ts
src/replaceAds.ts
webpack/manifest.ts
```

## Porting Ledger

### Carry As-Is

| Change set | Disposition | Notes |
| --- | --- | --- |
| Current `origin/dev` lineage through `80379e38` | Carry as-is | Already contained in `MAV-3974/architecture`; no merge required. Includes the current auth/intercom/sign-payload line, basenet migration, e2e smoke updates, current contacts/auth behavior, and content-script/ad-removal lineage from `dev`. |
| Existing `MAV-3974/architecture` docs | Carry as-is | Keep `pr-30-remediation-plan.md`, `pr-30-remediation-implementation-plan.md`, and `docs/pr-30-architecture-investigation.md` as planning context, with this ledger superseding older branch-target assumptions. |
| Existing non-API contacts work on `MAV-3974/architecture` | Carry as-is for now | Current architecture diff vs. `origin/dev` includes contacts front-end and vault plumbing in `src/lib/temple/**` plus contact UI/locales. These are already on the integration branch and should be reviewed in their own contacts/auth context, not overwritten by PR #30. |
| `arch-adjust/` task files | Carry as local task input only | The repo ignores `arch-adjust/`; task 01 is implemented by this tracked ledger instead of trying to track ignored task files. |

### Port

| Change set | Disposition | Notes |
| --- | --- | --- |
| PR #30 `a22df162` empty-history guard | Port candidate | Small standalone crash guard in `src/app/templates/History/HistoryItem.tsx` and `src/app/templates/History/HistoryDetailsPopup.tsx`; no new state-stack dependency identified. |
| PR #30 `c0bce383`, `241ead8b`, `670c1861` auth/history readiness concepts | Port candidate, non-API only | Useful concepts include auth-ready history gating, MVKT fallback behavior, and client-surface exposure. Any `src/mavryk/api/**` hunks stay reserved and must not be copied as remediation work. |
| PR #30 `cb924864` CI/security/type-safety batch | Port candidate, split first | CI workflow and non-API security/type-safety changes may be useful, but package/tooling and API hunks need separate review. |
| PR #30 security hardening outside reserved API | Port feature-by-feature | Candidate areas include `src/lib/temple/back/dryrun.ts`, `src/lib/temple/back/actions.ts`, `src/lib/temple/back/dapp.ts`, `src/lib/intercom/server.ts`, confirmation-token behavior, and compatible content-script/manifest hardening. These conflict with current auth/intercom/sign-payload work and need targeted ports with tests. |
| Future `dev` changes after `80379e38` | Port or carry per surface | If a future `dev` merge touches old Redux/SWR/Effector/client-hook surfaces, port it to the chosen architecture shape. Pure UI/config/utils can carry as-is. |

### Reserved

| Change set | Disposition | Notes |
| --- | --- | --- |
| `src/mavryk/api/**` | Reserved | No remediation edits. `MAV-3974/architecture` already differs from `origin/dev` in `src/mavryk/api/contacts.ts` and `src/mavryk/api/contacts.test.ts`; preserve that branch state unless the API owner directs otherwise. |
| PR #30 API diffs | Reserved | PR #30 differs from `MAV-3974/architecture` in `src/mavryk/api/client.ts`, `src/mavryk/api/history.ts`, `src/mavryk/api/rwas.ts`, and `src/mavryk/api/storage.ts`; merge simulation also conflicts in `client.ts` and `storage.ts`. Do not port these as remediation work. |
| API-auth contracts and tests | Reserved | Current API/auth helpers and tests from the `dev` lineage are team-owned and must not be overwritten by broad PR #30 conflict resolution. |
| PR #30 core state architecture | Reserved for an explicit architecture decision | This includes `src/app/store/**` retirement, `src/lib/store/zustand/**`, `src/lib/query-keys.ts`, TanStack Query provider/client, `src/lib/swr/index.ts` removal, and `src/lib/temple/front/use-mavryk-client.ts`. It is the broad rewrite, not a branch-alignment sync. |
| PR #30 build/toolchain changes | Reserved for an explicit tooling decision | This includes `.github/workflows/ci.yml`, `package.json`, `yarn.lock`, Jest setup, TypeScript, Tailwind, React Hook Form, and runtime dependency pinning. Do not advance versions just because they are present on PR #30. |
| PR #30 MVKT/WebMavryk rename outside reserved API | Reserved for a network/client decision | Candidate areas include `src/lib/apis/tzkt` to `src/lib/apis/mvkt`, `src/lib/webmavryk-fast-rpc/**`, and `src/lib/temple/front/tzkt-connection.tsx` replacement. These conflict with current network storage and connection files. |

### Dropped

| Change set | Disposition | Notes |
| --- | --- | --- |
| Wholesale PR #30 merge | Dropped | The PR remains open/conflicting and has 599 changed paths vs. current `dev`; direct merge into `MAV-3974/architecture` conflicts in 29 files. |
| `dev-architecture-update` as integration branch | Dropped | It is only a PR #30 reference branch under the current branch rule. |
| PR #30 changes to files deleted by current `dev`/architecture lineage | Dropped unless owner revives the feature | Examples from merge simulation include `src/replaceAds.ts` and `src/content-scripts/replace-ads/observing.ts`. Current `dev` deleted the ad-replacement surface; PR #30 modifications should not resurrect it accidentally. |
| PR #30 API conflict resolutions made by non-API remediation | Dropped | Any resolution that edits `src/mavryk/api/**` is outside this task. |
| Dependency upgrades without an explicit pin/version decision | Dropped for task 01 | Toolchain and runtime dependency changes need a separate baseline/pinning task. |
| PR #30 product/UI batches | Dropped for task 01 | Privacy mode, dev icons/version bumps, full address display, receive cleanup, amount formatting, lazy images, virtualized lists, and stake/send UI refactors are not needed for branch alignment. Handle as product-owned follow-up work if still wanted. |

## Decisions Needed Before Code Porting

1. Confirm whether the PR #30 state-stack migration should be ported onto `MAV-3974/architecture` as one atomic architecture task or split into smaller ordered phases.
2. Confirm that `src/mavryk/api/**` keeps the `MAV-3974/architecture` side verbatim during architecture remediation, and that any PR #30 API behavior must be handled only by the API owner.
3. Decide whether the current `dev` deletion of the ad-replacement files is final; otherwise PR #30 changes to `src/replaceAds.ts` and `src/content-scripts/replace-ads/**` need a feature-owner port.
4. Decide the toolchain baseline before accepting PR #30 changes to `package.json`, `yarn.lock`, Jest, TypeScript, Tailwind, or React Hook Form.
5. Decide how to reconcile PR #30 contact UI/hooks with the current contacts encryption/auth flow already on `MAV-3974/architecture`.
6. Decide whether MVKT/WebMavryk rename work outside `src/mavryk/api/**` is part of this architecture branch or a separate network/client migration task.

## Verification

Completed:

```bash
git fetch origin dev MAV-3974/architecture dev-architecture-update pull/30/head:refs/remotes/origin/pr/30
gh pr view 30 --json number,title,state,baseRefName,headRefName,headRefOid,baseRefOid,mergeable,isDraft,url,updatedAt
git merge-base --is-ancestor origin/dev HEAD
git merge-base origin/dev HEAD
git rev-list --left-right --count origin/dev...origin/MAV-3974/architecture
git rev-list --left-right --count origin/dev...origin/pr/30
git rev-list --left-right --count origin/MAV-3974/architecture...origin/pr/30
git diff --name-status origin/MAV-3974/architecture...HEAD -- src/mavryk/api
git merge-tree --write-tree --name-only --messages origin/MAV-3974/architecture origin/pr/30
```

`git diff --name-status origin/MAV-3974/architecture...HEAD -- src/mavryk/api` was empty when this ledger was created.

Attempted:

```bash
yarn ts
yarn test
```

Results:

- `yarn ts` failed before project-file checking on installed dependency declarations that require newer TypeScript syntax than this branch currently uses, including `node_modules/@apollo/client/masking/internal/types.d.ts`, `node_modules/@types/babel__traverse/index.d.ts`, and `node_modules/@types/lodash/common/*.d.ts`.
- `yarn test` failed with 4 failing suites and 25 passing suites. Failures were `src/lib/temple/beacon.test.ts`, `basenet_kyc_onboard.spec.ts`, `src/lib/temple/back/store.test.ts`, and `src/lib/utils/amounts/index.test.ts`.

Not applicable in this task:

- Ported-feature smoke tests: no runtime feature was ported.
