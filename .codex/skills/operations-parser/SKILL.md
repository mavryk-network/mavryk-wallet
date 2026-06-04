---
name: operations-parser
description: Use this when updating operation history parsing, pending operation simulation, fee mapping, operation grouping, pagination/filter behavior, and UI-facing operation models in the Mavryk Wallet extension.
---

# Purpose

Use this skill when:

- updating `/history` parsing
- migrating operation models to the new API structure
- fixing pending operation fake objects
- mapping fees, amount, timestamps, and statuses
- handling operation filters and pagination
- grouping operations by hash
- updating display data for delegation/staking/unstaking/interactions/etc.

# Project context

Operation history in the wallet is evolving from old custom frontend logic to new backend-provided operation data.

Known backend direction:

- backend returns grouped or groupable operation data
- `networkFees` should be used where available
- operation types may include:
  - sent
  - received
  - delegation
  - staking
  - origination
  - reveal
  - interaction
  - swap or other backend-defined types if added
- some pending operations are not returned by API and must be simulated on frontend

Important requirement:

- pending simulated operations should match the real operation model closely enough for UI consistency

# Rules

- Preserve the frontend operation model unless the task explicitly changes it.
- Prefer backend-provided values over old custom calculations when the new API supports them.
- Keep decimals/amount formatting correct.
- Do not reduce meaningful operation detail to generic labels when data exists.
- Pending/fake operations must still carry enough fields for correct UI rendering.
- Keep pagination/filter logic compatible with current UI behavior.
- Avoid introducing special cases in components if the parser/model layer can solve it cleanly.

# Workflow

1. Find the current history model path.

   - raw API response types
   - parsers/mappers
   - history utils
   - pending operation creation logic
   - UI components that consume normalized operations

2. Compare real API shape vs expected frontend shape.

   - identify missing fields
   - identify renamed fields
   - identify deprecated custom calculations

3. Update model normalization.

   - map amount
   - map status
   - map type
   - map timestamps
   - map operation ids/hash
   - map `networkFees`
   - preserve any UI-required derived fields

4. Update pending/fake operation builders.

   - match the normalized structure as closely as possible
   - include correctly formatted amount and fees
   - ensure delegation/stake/unstake are distinguishable and not collapsed into vague labels like `Staking` when richer info should exist

5. Validate filter and pagination behavior.

   - ensure selected filters are passed with cursor requests if required
   - ensure empty next page stops loading
   - avoid infinite loading loops

6. Validate grouping behavior.
   - operations sharing hash may need grouping under one item depending on current frontend pattern
   - keep grouping logic consistent with existing dev branch behavior if referenced

# Output expectations

For implementation tasks:

- update types and normalization logic
- explain model differences briefly
- mention any UI behavior preserved intentionally

For bug analysis:

- point to exact mismatch between backend payload and parser expectations
- describe whether the fix belongs in parser, pending builder, or pagination/filter logic

# Mavryk-specific guidance

- `networkFees.totalFee`, `gasFee`, `storageFee`, and `burnedFromFees` should replace old custom fee derivation where the new API provides them.
- Keep operation amount and fee decimal handling accurate.
- Pending operations are simulated because API does not return them, so their model must be intentionally aligned with the normalized real operation model.
- Group batched operations by hash if that is the existing intended wallet behavior.
- Filters like `reveal`, `interaction`, `origination`, etc. should not break pagination or trigger infinite requests.
- Empty result for next page should stop further loading and surface “no more results” behavior if the UI supports it.

# Things to double-check

- amount decimals
- fee decimals
- pending operation labels
- grouping by hash
- cursor + filter together
- infinite scroll stop condition
- unsupported/missing backend operation types
- status mapping
- operation role/source/destination consistency where relevant
