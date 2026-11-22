# PostHog product analytics

Opt-in, anonymous product analytics for the extension. Nothing is sent unless **all** of these hold:

1. The build has a `POSTHOG_KEY` (no key → analytics code is inert; unit tests never send).
2. The user opted in (onboarding checkbox, default **off**, or Settings → General → Analytics).
3. The background owner has adopted its durable consent and anonymous id (`getReadyAnalyticsIdentity`).
4. On Firefox, the browser-level `technicalAndInteraction` data consent is granted.
5. The event and its properties match the strict whitelist in `src/lib/analytics/analytics-events.schema.ts`.

## Architecture

- **Transport**: `src/lib/analytics/posthog.client.ts`, which `POST`s to `<POSTHOG_HOST>/i/v0/e/` from the background
  only. There is no `posthog-js` SDK: no remote code, autocapture, session replay, pageviews or person profiles
  (`$process_person_profile: false`).
- **Gate**: `trackBackgroundEvent` in `src/lib/temple/back/analytics.ts`. It never throws, so callers fire and forget.
- **Identity**: the existing random install id (`userId`, nanoid) kept by the UI owner in `browser.storage.local`.
  It is shared by the popup, full page and background. No wallet data is ever used as an identity.
- **Foreground events**: `trackAnalyticsEvent` (`src/lib/analytics/send-events.utils.ts`) sends the existing
  `SendTrackEventRequest`. The background accepts only `FOREGROUND_ANALYTICS_EVENTS` and re-validates them.
  Content scripts and dApp pages cannot send this request (`intercom-permissions.ts`).
- **Legacy Temple analytics** (`useAnalytics`, `testID` button/form tracking, page events) stays a no-op on purpose.
  Its payloads include form values and must not be connected to PostHog.

## Super properties

Every event gets `extension_version`, `browser` (build target), `environment` (`POSTHOG_ENVIRONMENT`, default
`NODE_ENV`) and `network` (`mainnet` / `basenet` / `custom`). Custom network ids and RPC URLs are never sent.

## Events

| Event                      | Properties                                             | Emitted from                                        |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `wallet_created`           | none                                                   | onboarding, after the wallet is registered          |
| `wallet_imported`          | `method`: `seed` \| `keystore`                         | onboarding, after the wallet is registered          |
| `wallet_unlocked`          | none                                                   | background `UnlockRequest` (not session restore)    |
| `account_added`            | `type`: `hd` \| `imported` \| `ledger` \| `watch_only` | background account/wallet creation handlers         |
| `contact_added`            | `method`: `manual` \| `import`                         | `useContactsActions` add / bulk import              |
| `tx_confirmed`             | `tx_type`, `asset_type`, `source`                      | wallet sends (`OperationsRequest`), dApp operations |
| `tx_rejected`              | `tx_type`, `source`                                    | user decline or confirmation timeout                |
| `tx_failed`                | `tx_type`, `source`, `error_code`                      | operation errors (sanitized protocol error id)      |
| `dapp_connected`           | none                                                   | dApp permission approved                            |
| `dapp_connection_rejected` | none                                                   | dApp permission declined or timed out               |
| `network_switched`         | `network`                                              | `network_id` storage change                         |
| `analytics_opt_in_changed` | `enabled: true`                                        | Settings toggle (nothing is sent after opt-out)     |

Value sets:

- `tx_type`: `send` \| `delegate` \| `stake` \| `contract_call` \| `origination` \| `batch` \| `other`
- `asset_type`: `mvrk` \| `token` \| `none` (NFTs count as `token`: no metadata lookup is done)
- `source`: `wallet` \| `dapp`

## Never sent

Addresses, public keys, seed phrases, private keys, passwords, operation hashes, amounts/balances, dApp URLs or names,
custom RPC URLs, raw error messages or stacks.

## Adding an event

1. Add a strict schema to `ANALYTICS_EVENT_SCHEMAS`, using enums or buckets only and no free text.
2. Emit it with `trackBackgroundEvent` (background) or `trackAnalyticsEvent` (extension page). For the latter, also add
   it to `FOREGROUND_ANALYTICS_EVENTS`.
3. Extend `analytics.helpers.test.ts` / `back/analytics.test.ts`.

## Configuration

`.env` / `.env.local` (see `.env.dist`): `POSTHOG_KEY`, optional `POSTHOG_HOST` (default `https://eu.i.posthog.com`)
and `POSTHOG_ENVIRONMENT`. Use a separate PostHog project key per environment. The deploy workflow reads the
`POSTHOG_KEY` / `POSTHOG_HOST` secrets and sets `POSTHOG_ENVIRONMENT=production`.
