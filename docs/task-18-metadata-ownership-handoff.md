# Task 18: metadata ownership

## Refs and reused work

Started clean on `MAV-3974/architecture` at `c02dcd4597b8c8eb067a64bcc878839d1e06ea34`; no Task 18 branch existed. Created `task-18-redem` from that local HEAD. Reused the accepted Tasks 10–17 baseline, installed dependencies, background owner, migration/readiness gates, destination adapters, predefined metadata and the existing foreground Query client. No fetch, reinstall, reference-branch import or baseline test/build rerun was needed.

Implementation commits:

- `32fc8d1b`: backward-compatible scoped schema and owner application policy.
- `18b5b25b`: shared Query requests, acknowledged publication, consumer/imperative ports and legacy fetcher removal.
- `67fadceb`: transport, batching, owner ordering, persistence, refresh and consumer regression coverage.
- `657e8c84`: Babel-compatible batch assembly and exact owner-client import inventory.
- `aea0926d`: shared pagination reconciliation/cancellation and concurrent refresh completion coverage.

Final documentation and local merge refs are reported in the delivery message to avoid self-referential hashes. No push or merge into `dev` is performed. `dev` remains the production lineage; PR #30 is reference only.

## Ownership, transports and keys

| Path                       | Transport/orchestration                                                                                    | Durable/UI authority                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Independent token metadata | Existing validated `fetchWalletTokens({ walletAddress })` and wallet mapper, through shared Query batching | Background metadata owner                                              |
| Collectible/RWA metadata   | Existing metadata API selected by RPC-reported known chain; custom chains retain on-chain fallback         | Same owner; existing RWA-symbol filter retained                        |
| Asset-coupled metadata     | Reuses Task 17 payload and shared `normalizeMetadata`; no second metadata request/write                    | Same acknowledged asset owner operation                                |
| Whitelist seed metadata    | Existing fixed feed and whitelist mapper; no extra transport                                               | Mainnet provenance bucket in metadata owner, non-overwriting           |
| AddAsset preview           | Existing single-token lookup through this Query client; one-minute freshness                               | Provisional Query/form data only; no metadata save or asset enablement |
| AddAsset save              | Explicit awaited `saveMetadata`, followed by awaited existing asset-put command                            | Scoped metadata and existing asset/status owner                        |
| IndexedDB classification   | Existing bounded background migration transport                                                            | Task 14 lifecycle unchanged; never uses a foreground Query client      |

`DetailsQueryProvider` remains the sole stable in-memory client per foreground StoreProvider, beneath owner and Redux persistence readiness. No second provider, durable Query cache, foreground destination adapter or generic cache-mirroring framework exists.

Central factories in `src/lib/query-keys.ts`:

- Scope prefix: `['metadata', category, account, chainId, networkId, rpcUrl]`.
- Batch: scope prefix plus `[mode, 'batch', sortedUniqueSlugs]`.
- Per-slug receipt: scope prefix plus `[mode, 'receipt', slug]`; receipt is `found` or `missing`, never metadata for UI reads.
- Preview: category `preview`, scope prefix plus `[slug]`; this is explicitly provisional form data.
- Versioned refresh: token scope prefix plus `['versioned-refresh']`.

Category distinguishes tokens, collectibles and RWAs; mode distinguishes put, whitelist and media refresh. Account and normalized configured API network scope wallet-backed responses. RPC identity distinguishes custom sources reporting the same chain. Strict RPC requests also verify the reported chain against the captured chain before accepting a response. Existing Task 9/15/16/17 factories and endpoint dispositions remain unchanged.

Presence checks require owner readiness and nonempty account/chain/network/RPC inputs. They do **not** require a known chain or use a loading self-gate. Existing API authentication/storage selection and refresh behavior remain in the reserved API client. Versioned media refresh retains its mainnet gate.

## Batching, failures and cancellation

The per-client coordinator holds pending slugs, promises and consumer abort signals only. Sibling calls coalesce in a microtask; overlapping active slugs share the existing promise. Additions while a batch is active form the next batch after settlement, including after failure. Collectible/RWA batches preserve the 50-slug chunk limit; wallet tokens use one wallet payload for the coalesced set. Cross-foreground transport deduplication is not claimed: separate clients coordinate accepted publication through the owner.

Batch Query freshness is zero, with five-minute inactive retention and no automatic retries. Successful per-slug receipts suppress repeats for five minutes. A mounted unchanged miss does not run an automatic retry timer; remount/input change after expiry or scoped invalidation permits another attempt. There is no metadata polling, focus or reconnect refetch. Input changes and remounts retry failed requests without permanent `checkedRef` suppression. Scope-prefix invalidation wakes mounted presence registrations, never the entire client. Imperative pagination shares this exact request coordinator.

No result yet is distinct from a validated null miss. The entire requested response is validated before publication: absent entries, short arrays, invalid metadata fields, transport/auth failures and owner errors reject. A valid RWA response that fails the existing RWA classifier is not stored. Name/symbol fallbacks and wallet decimal/media mapping remain existing contracts. Native-token metadata still uses its existing gas-token path and is excluded from presence requests.

The historical custom-chain helper can return null after catching failures internally. Strict foreground orchestration treats that ambiguous result as an error, not a confirmed miss. Known-chain API nulls remain confirmed misses. Background classification retains its existing helper/fallback contract. Neither failure nor omission erases cached, predefined or manually saved metadata.

Query retains transient errors and fetching state; selectors read owner metadata only. Fixed generic error messages avoid payload logging. Promise transports are not physically aborted. Removed consumers are excluded before publication; remaining consumers keep shared requests alive. Query cancellation and selection guards discard late results. Account/network/auth-map/custom-network-snapshot events invalidate a request even for A→B→A transitions. The owner independently checks selection revisions and rejects reservations lost on background restart. Failed/cancelled foreground attempts release their owner reservations; abrupt foreground termination leaves no valid post-restart reservation.

## Durable scopes, compatibility and precedence

The existing version-1 `zustand-metadata` envelope retains all three original slug-keyed maps. Optional new fields are `scoped`, `revision` and `lastReceipt`. Each scoped bucket contains the same three maps and per-category/slug accepted revisions. Older envelopes validate without these fields; no migration marker or completed migration replay is added.

New foreground scope keys serialize `[account, chainId, networkId, rpcUrl]`. The fixed whitelist bucket is `whitelist-madfish-mainnet`. UI precedence is:

1. Exact scoped fetched/user metadata.
2. Retained global metadata, including stored overrides of predefined records.
3. New mainnet whitelist seeds, only when selected on mainnet and no higher-priority record exists.

Predefined hydration is unchanged: stored global records override matching predefined records, and missing predefined records survive. Existing gas-token, missing-name/symbol and metadata-versus-detail presentation fallbacks remain unchanged. Detail records stay in Task 15 Query ownership.

Legacy slug-only records have **unknown provenance**. They are preserved as unscoped fallback, including historical whitelist-derived records. They may still alias across sources until an exact scoped record exists; this task does not claim to reconstruct durable network isolation for historical data. New writes do not overwrite another exact source bucket. Legacy metadata action/command APIs remain unscoped fallback writers; no live foreground metadata-action producer remains. New scoped records take precedence over those compatibility writes. Task 14 cannot infer API-network/RPC provenance from old IndexedDB rows and retains its existing global classification fallback and bounded transport.

The owner reserves increasing durable revisions before independent or asset transport. Accepted per-record revisions prevent older requests from replacing newer accepted records. Explicit saves obtain a newer owner revision. No foreground wall-clock timestamp determines precedence. A later fresh fetch may replace an earlier ordinary put, matching normal metadata update semantics; older in-flight fetches cannot replace a later explicit save. Whitelist mode never overwrites existing metadata. Media refresh changes only existing `artifactUri` and `displayUri`, retaining name/symbol/decimal/thumbnail behavior. Collectible and RWA puts retain their existing normalization/classification.

`syncMetadata` succeeds only after the serialized owner command flushes actual adapters and independently reads back the selected state. A stale/invalid reservation cannot return a matching acknowledgement receipt. Superseded independent publications cancel rather than claiming completion; coupled asset metadata may skip older records while the accepted asset/balance operation retains its own acknowledgement semantics. A failed write can leave partial durable state; existing owner readiness/retry closes the gate and drains retained writes before retry. Cold hydration retains scoped records. No source payload is deleted to compensate.

## Refresh completion and imperative ports

`METADATA_REFRESH` and `REFRESH_VERSION = 1` are preserved. Existing chain-keyed entries remain untouched, but cannot prove completion for a newly distinguishable account/API/RPC scope. New completion entries use the full scope key in the same object.

A cross-foreground Web Lock serializes refresh read/request/completion. The refresh captures current owner token records, excludes predefined slugs, requests media-only updates and awaits durable acknowledgement. It rechecks selection and rereads completion records before writing, preserving other entries. Storage parsing, writing and read-back failures reject. Web Locks unavailable is an explicit retryable failure, with no unlocked writer.

An empty eligible set is a successful scoped no-op. A genuine miss retains existing media but leaves version completion unset; the receipt limits repeated attempts until expiry/invalidation. Partial/malformed/failed refreshes also leave completion unset. Overlapping attempts reuse the completion check under the lock. Restart after publication but before completion safely retries; restart after verified completion skips that scope. Versioned refresh has no polling/retry loop and retries on later mount or scoped invalidation after failure.

Both pagination hooks delegate to `useMetadataPagination`, use Query fetching state, and advance only after acknowledgement. Input changes during an active load cancel the old caller and enqueue the current page; they cannot be permanently skipped by a loading self-gate. AddAsset validates contract/standard/token ID as before, then uses Query for lookup. Preview data never adds/enables an asset or writes saved metadata. Late previews cannot fill a changed form. Submission awaits scoped metadata and existing enabled-asset commands before success navigation; it preserves existing classification/status timing and balance-cache invalidation. No transaction code is changed.

Removed all three metadata epic files/root registrations, presence loading self-gates/local miss tracking, direct pagination metadata fetching/publication and dispatch-based refresh completion. Old action/reducer shapes and middleware adapters remain compatibility bridges. Unrelated Redux, SWR, Effector and intercom-client remain live. Balances stay Redux-owned through Task 17's narrow scoped dispatch after owner acknowledgement.

## Verification

| Check                                    | Result                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Full Jest plus affected-suite reruns     | 82 passing suites / 515 passing tests; the same four baseline failing suites and one failing test  |
| `yarn ts`                                | Same 11 dependency declaration syntax diagnostics in Apollo, Babel traverse types and Lodash types |
| Whole-project semantic comparison        | 434 before/after; identical counts by file and diagnostic code, including after final source fixes |
| Chrome production build                  | Passed after the Babel correction and again for the pagination change; `chrome.zip` produced       |
| Firefox production build                 | Passed after the Babel correction and again for the pagination change; `firefox.xpi` produced      |
| Scoped ESLint                            | Zero errors; existing/assertion warnings remain                                                    |
| Source formatting and `git diff --check` | Passed; all new documentation links resolve                                                        |
| Installed-extension smoke                | Unavailable: no connected browser/app or usable profile                                            |

The single full Jest invocation returned **81 passing/five failing suites and 512 passing/two failing tests**. Task 18's additional failure was the exact ownership import inventory, which needed the concrete new owner-client paths and removed selector imports. Its focused rerun passed without weakening the adapter prohibition. Two additional pagination/concurrent-refresh tests also passed. The reconciled totals combine these targeted results; they are not one full invocation's totals. Unchanged baseline failures are `src/lib/temple/beacon.test.ts`, `src/lib/temple/back/store.test.ts`, `src/lib/utils/amounts/index.test.ts` and `basenet_kyc_onboard.spec.ts`.

The first Chrome build exposed a pinned Babel limitation for a spread argument containing `await`. The batch assembly was extracted into a typed helper with equivalent chunking, then affected tests and builds were rerun. Review also found the old pagination loading gate could drop changed inputs; the shared replacement and its regression test passed. No second full Jest or `yarn ts` invocation was needed. The semantic check uses the same installed dependencies and starting-source overlay, not a claim that `yarn ts` passes.

Logs are outside the repository: `/tmp/task18-final-{ts,jest,chrome,firefox,semantic}.log`, `/tmp/task18-chrome-rerun.log`, `/tmp/task18-{chrome,firefox}-pagination.log`, `/tmp/task18-fix-tests.log`, `/tmp/task18-pagination-{tests,last-tests}.log`, `/tmp/task18-metadata-final.log`, `/tmp/task18-owner-final.log`, `/tmp/task18-semantic-{before,after}.json`, `/tmp/task18-semantic.json` and `/tmp/task18-lint.log`. Later targeted lint logs cover the final fixes.

Focused checks passed before implementation commits, including real Query clients/providers, transport mocks, real destination adapters, cold reload and owner failure injection. Coverage includes deduplication/chunking/active-batch additions, readiness/custom RPCs, source keys, misses/errors/retry/invalidation, delayed acknowledgement, preview/save separation, scoped refresh completion, scope collisions, owner ordering, explicit saves, restart/late selection and coupled metadata policy. Existing predefined, migration, security and persistence suites remain required regression coverage.

The optional pre-existing `docs/agent-directory-map.local.md` link in AGENTS remains absent; all new handoff links resolve.

Browser inventory returned `apps: []`, `browsers: []`. No usable installed non-production extension profile was available. No browser smoke or wallet transaction was performed; automated evidence is not a manual pass.

## Preserved boundaries and Documentation Update

Reserved `src/mavryk/api/**`, package version **3.0.0**, manifest/lockfile/toolchain, one durable owner, Tasks 11/13 migration/identity/consent/readiness, retained storage sources/prefixes, `assets-migrations@3.0.0`, historical entries, Web Locks, Task 14 verified cleanup, Task 9 quote/transaction behavior, Task 15 details and Task 16 dormant endpoints remain preserved. Task 17 asset/security adoption, cached scam labels, user-status protection and balance bridge remain. Ignored `arch-adjust/` descriptions are untouched.

Updated AGENTS, Task 10's deferred Task 18 entry, Task 12's concrete retirement inventory, and narrowly appended changed contracts to Tasks 13–17. No broader Phase 8 completion is claimed. Task 19 must replace the retained balance owner/bridge with equivalent offline and acknowledgement semantics. Task 20/final architecture integration still requires its separate acceptance work, baseline-failure accounting and production-lineage review; this task does not merge into `dev`. Before release, perform the requested installed-profile offline/cold-start, missing-metadata, scope-switch, manual-save, refresh and cached-scam-label smoke checks.

## Exact changed-file inventory

The inventory below compares the completed Task 18 tree with starting integration `c02dcd4597b8c8eb067a64bcc878839d1e06ea34`, including documentation. `D` denotes removed epics.

```text
M	AGENTS.md
M	docs/task-10-zustand-foundation.md
M	docs/task-12-legacy-retirement-ledger.md
M	docs/task-13-legacy-assets-handoff.md
M	docs/task-14-indexeddb-assets-handoff.md
M	docs/task-15-reactive-details-handoff.md
M	docs/task-16-query-only-server-domains-handoff.md
M	docs/task-17-assets-security-ownership-handoff.md
A	docs/task-18-metadata-ownership-handoff.md
M	src/app/hooks/use-collectibles-pagination-logic.ts
M	src/app/hooks/use-metadata-loading.ts
A	src/app/hooks/use-metadata-pagination.ts
M	src/app/hooks/use-metadata-refresh.ts
M	src/app/hooks/use-rwas-pagination-logic.ts
M	src/app/pages/AddAsset/AddAsset.tsx
D	src/app/store/collectibles-metadata/epics.ts
M	src/app/store/collectibles-metadata/selectors.ts
M	src/app/store/root-state.epics.ts
D	src/app/store/rwas-metadata/epics.ts
M	src/app/store/rwas-metadata/selectors.ts
D	src/app/store/tokens-metadata/epics.ts
M	src/app/store/tokens-metadata/selectors.ts
M	src/lib/assets/load-account-assets.ts
M	src/lib/assets/scoped-wallet-request.ts
M	src/lib/assets/use-assets-query.test.tsx
M	src/lib/assets/use-assets-query.ts
A	src/lib/metadata/fetch.test.ts
M	src/lib/metadata/fetch.ts
M	src/lib/metadata/index.ts
A	src/lib/metadata/metadata-query.test.ts
A	src/lib/metadata/metadata-query.ts
A	src/lib/metadata/metadata-scope.ts
M	src/lib/metadata/on-chain/fetch.ts
A	src/lib/metadata/preview-metadata.ts
A	src/lib/metadata/refresh-metadata.ts
A	src/lib/metadata/sync-metadata.ts
A	src/lib/metadata/task18-ownership.test.ts
A	src/lib/metadata/use-metadata-query.test.tsx
A	src/lib/metadata/use-metadata-query.ts
A	src/lib/metadata/use-metadata-scope.ts
A	src/lib/metadata/use-owned-metadata.test.tsx
A	src/lib/metadata/use-owned-metadata.ts
M	src/lib/query-keys.ts
A	src/lib/store/zustand/__tests__/metadata-command.test.ts
M	src/lib/store/zustand/__tests__/safe-initialization.test.ts
M	src/lib/store/zustand/__tests__/ui-owner.test.ts
M	src/lib/store/zustand/assets-sync-command.ts
A	src/lib/store/zustand/metadata-command.ts
M	src/lib/store/zustand/metadata-state.schema.ts
M	src/lib/store/zustand/ui-owner.contract.ts
M	src/lib/store/zustand/ui-owner.ts
```

## Task 19 balance ownership handoff

Task 19 resolves the retained Redux balance bridge. `loadAccountAssets`/`syncAccountAssets` now require RPC provenance and publish normalized balances alongside assets/metadata in the existing command. All production callers already supply that scope. Metadata reservations, explicit-save precedence, refresh completion and normalization stay unchanged; balance revisions are separate. Coupled success covers four durable destinations, with retained-write retry after partial persistence rather than cross-store atomicity. See [Task 19](task-19-balances-ownership-handoff.md) for the current contract and verification.
