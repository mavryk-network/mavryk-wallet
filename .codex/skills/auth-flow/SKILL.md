---
name: auth-flow
description: Use this when working on wallet authentication, JWT storage, refresh behavior, network-based auth, unlock/lock flows, and protected API access in the Mavryk Wallet extension.
---

# Purpose

Use this skill when:

- fixing JWT refresh issues
- implementing auth on wallet import/unlock/network switch
- storing tokens by wallet/network
- updating axios interceptors
- handling logout/lock/auth failure flows
- preventing repeated unnecessary auth or refresh calls

# Project context

This wallet uses challenge/verify/refresh auth flow.

Known auth contract:

- `POST /auth/challenge`
- `POST /auth/verify`
- `POST /auth/refresh`
- `POST /auth/logout`

Known desired behavior:

- auth should happen when main wallet is first created/imported
- auth should happen when needed for the selected wallet/network
- do not refresh on every page reload
- do not spam refresh calls
- refresh should happen on unlock, near expiry, or after relevant protected request failure if that flow exists
- tokens should be stored per main wallet and selected network
- when network changes, auth should correspond to that network
- when auth cannot be recovered safely, lock/logout flow should be used

# Rules

- Do not change auth behavior broadly unless required by the task.
- Prefer deterministic flows over hidden background magic.
- Avoid repeated refresh on app startup if token is still valid.
- Keep storage keys explicit and stable.
- Skip refresh logic for auth endpoints themselves.
- Prevent interceptor loops and duplicate refresh races.
- Handle missing tokens, expired tokens, and wrong-network tokens clearly.
- Reuse existing storage helpers and auth actions if present.
- If lock/logout behavior already exists in `actions.ts`, use it instead of duplicating logout logic elsewhere.

# Workflow

1. Identify current auth entry points.

   - wallet import/create
   - account import from seed phrase if it creates/imports main wallet
   - unlock
   - network switch
   - protected API request path
   - lock/logout

2. Identify current token storage shape.

   - verify whether tokens are keyed by main wallet + network
   - update storage helpers if needed
   - keep migration/backward compatibility in mind

3. Inspect axios/client interceptor flow.

   - ensure auth endpoints are excluded from refresh retry logic
   - prevent infinite loops
   - prevent refresh on every reload

4. Implement token validity logic.

   - check whether access token exists
   - check whether it is expired or expiring soon
   - refresh only when needed
   - if refresh fails or token is no longer safe to use, call the existing lock/logout path

5. Align network-based auth behavior.

   - selected network must choose the correct API/auth context
   - switching network must re-evaluate auth state for that wallet/network pair

6. Validate downstream behavior.
   - contacts or other protected data should fetch only after valid auth is available
   - app should not fetch protected resources too early

# Output expectations

For implementation tasks:

- make the smallest safe fix
- describe trigger points changed
- explain how repeated refresh was prevented

For analysis tasks:

- show the current broken trigger pattern
- propose exact fix locations
- call out race conditions or loops

# Mavryk-specific guidance

- Token storage should be per main wallet address and selected network / chain context.
- Refresh should not happen just because the page reloaded.
- Unlock is a valid place to verify/refresh auth state.
- Network switch is a valid place to verify auth for that specific API/network.
- If auth is required before contacts or account data fetch, wait until auth is ready.
- Prefer centralizing auth checks instead of scattering them through UI code.
- If there is already logic in `src/lib/temple/back/actions.ts`, extend that path instead of creating a parallel auth flow.

# Things to double-check

- repeated refresh on reload
- refresh loop in interceptors
- auth endpoints excluded from retry logic
- stale token after network switch
- stale token after wallet switch
- storage key correctness
- lock/logout on unrecoverable auth state
- concurrent request behavior during refresh
