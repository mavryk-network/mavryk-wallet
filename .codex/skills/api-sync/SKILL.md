---
name: api-sync
description: Use this when integrating or updating wallet API endpoints, schemas, parsers, reducers, and UI-facing mapped data for the Mavryk Wallet extension.
---

# Purpose

Use this skill when:

- adding a new backend endpoint
- migrating old frontend logic to the new wallet API
- updating response schemas or types
- mapping API responses into existing frontend data structures
- keeping UI/reducers stable while changing fetch/parsing logic

# Project context

This project is a React + TypeScript wallet extension with blockchain integrations.

Important backend direction:

- frontend is migrating to the new wallet backend
- responses should be converted into UI-ready structures
- avoid unnecessary UI rewrites when backend payloads change
- prefer updating fetch/parsing/schema layers instead of changing many UI components

Common endpoint patterns already used:

- `/wallets/{wallet_address}/portfolio`
- `/wallets/{wallet_address}/tokens`
- `/wallets/{wallet_address}/assets`
- `/wallets/{wallet_address}/history`

# Rules

- Be concise and factual.
- Follow existing project structure and naming.
- Reuse existing helpers before creating new ones.
- Prefer minimal safe changes over broad refactors.
- Do not break reducer/UI output shape unless explicitly required.
- Keep TypeScript strict and explicit.
- Handle missing/invalid API fields safely.
- Do not silently swallow parsing or mapping errors.
- Prefer colocating endpoint-specific parsing helpers near existing API helpers.
- If zod or schema validation is already used nearby, extend that pattern instead of inventing a new one.

# Workflow

When working on an API task:

1. Find the existing API layer for the domain.

   - Search for current client usage, endpoint helpers, schemas, mappers, reducers, and selectors.
   - Identify where the UI-facing shape is defined.

2. Inspect the current expected frontend shape.

   - Check reducers, selectors, hooks, and components that consume the data.
   - Preserve that shape unless the task explicitly asks to change it.

3. Add or update response typing.

   - Create or update TypeScript types for raw API response data.
   - Add schema validation if the nearby code already uses it.

4. Add mapping/parsing logic.

   - Transform raw API response into the existing frontend structure.
   - Convert numeric/string values carefully.
   - Respect token decimals and backend-provided fee/value fields.

5. Update fetch logic only where needed.

   - Keep the change local.
   - Do not rewrite unrelated flows.

6. Verify impact.

   - Check reducers/selectors/components using the mapped data.
   - Remove obsolete fields only if they are truly unused or explicitly deprecated.

7. Update docs/comments only if the change introduces new behavior or important assumptions.

# Output expectations

For implementation tasks:

- make the code change
- explain briefly what was changed
- call out any assumptions or risky areas

For analysis tasks:

- identify exact files to change
- explain old shape vs new shape
- propose smallest safe implementation plan

# Mavryk-specific guidance

- Wallet UI shape stability matters.
- New backend should be the source of truth for balances, prices, fees, and operation metadata when available.
- Prefer backend `networkFees` over old custom fee calculations where the feature has been migrated.
- Do not duplicate mapping logic across tokens, portfolio, RWA, and history if an existing helper pattern already exists.
- If a reducer currently expects a legacy shape, adapt the parser/helper rather than forcing broad UI changes.
- Preserve pagination/filter contract behavior where relevant.

# Things to double-check

- decimals handling
- currency value correctness
- grouping logic
- null/empty states
- backward compatibility with existing selectors/hooks
- endpoint URL construction
- atlasnet vs mainnet compatibility if API base depends on selected network
