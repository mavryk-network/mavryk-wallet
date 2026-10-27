# Bridge history UI reconciliation

Compared `bridge-history.md` with the current branch. Wallet and token history share the same adapter and components.

## Changes

- Validate movement breakdowns, mint/burn kinds and partial flags. Preserve token IDs as strings; token history requests include the selected ID and a limit of 20.
- Render complete API summaries once, with individual movements in the expanded stack. Missing totals use separate movements; partial responses are labeled “Incomplete breakdown”. Raw token legs represented by movements are removed once, while unmatched and native legs remain visible. Splitting or removing those legs preserves network fees exactly once, including when the parent has no fee total.
- Mint movement rows use the interaction-style “Called mint on {tokenAddress}” label in history previews, popup titles and expanded stacks; burn rows retain “Burned”. Parent interaction titles retain their actual entrypoint and called contract.
- Use movement direction for signs, neutral styling for self transfers, and the called contract for interaction addresses. Missing counterparties do not produce empty address labels.
- Keep missing amounts visible with a placeholder and token identity. Pass API USD values to the amount component, including known zero, and convert them through the selected fiat rate without token-price lookup.

## Preserved behavior

Purchase allocation accounting, exact decimal conversion for raw purchase/refund quantities, pending operations, existing filters, cursor routing and native-token endpoint selection remain in place. No balance/market-price binding or backend aggregation was added.

## Verification

Regression coverage is in `src/lib/temple/history/utils.test.ts`, `fetch.test.ts` and `src/app/templates/History/purchase-rendering.test.tsx`. It covers summary/breakdown separation, missing and partial totals, mint/burn labels, contract addresses, large/missing token IDs, native/token deduplication, unknown/zero USD and selected-fiat conversion alongside the existing purchase/refund cases.

Validation: the full test run passed 107 of 108 suites. Its history-rendering suite loaded an earlier implementation during the final changes; the final targeted rerun passed all 5 history suites (63 tests), including that suite. Type-check, lint on touched files and `git diff --check` passed. Installed-extension acceptance was not run.
