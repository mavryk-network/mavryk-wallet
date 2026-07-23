# Mavryk Wallet

Mavryk Wallet manages user-controlled accounts, dApp permissions, and authenticated access to Mavryk API services.

## Language

**Auth Challenge**:
A backend-issued message that proves control of the wallet selected for API authentication. It is reserved for wallet authentication and is not a dApp signing message.
_Avoid_: Login message, dApp payload

Trusted first-party Nexus origins may request an auth challenge signature for Nexus authentication:
`https://basenet.nexus.mavryk.org` and `https://nexus.mavryk.org`. Other dApp origins must not sign auth challenges.

**Mavryk Signed Message**:
A user-intended off-chain message signed for a connected dApp. It is not an operation and must not be used for wallet authentication.
_Avoid_: Raw payload, auth challenge

**Operation Request**:
A dApp request to move funds or change chain state through wallet operation confirmation.
_Avoid_: Sign payload, message signing

## Current SEC-04 / SEC-05 Decisions

These notes record the investigation and decisions from the SEC-04 and SEC-05 wallet signing work.

### Backend Wallet Auth

- Wallet API auth and dApp message signing must remain separated.
- The deployed basenet wallet API currently verifies the legacy wallet-auth preimage. The extension must keep signing wallet auth challenges with that deployed-compatible shape until the backend verifier is changed in the same release.
- Current wallet-auth signing path:
  - build a legacy auth challenge payload with `buildLegacyAuthChallengePayloadHex(challenge)`;
  - sign `getMichelinePayloadBytes(payloadHex)`;
  - pass the explicit Micheline watermark `05` to `vault.sign`.
- Do not switch internal wallet auth to a new namespaced preimage by extension-only change. That caused `/auth/verify` to reject the signature, no JWT was stored, protected API requests became unauthorized, and repeated challenge attempts hit `429 Too Many Requests` on `https://basenet.wallet.mavryk.network/api/v1/auth/challenge`.
- Backend follow-up is still required outside this repo: bind `/auth/verify` to server-side session/origin context, not only nonce plus wallet address.

### dApp `sign_payload`

- dApps must not be able to sign operation-like bytes through `sign_payload`.
- Reject payloads whose first byte is `01`, `02`, or `03`.
- Reject non-hex payloads and unframed raw bytes.
- Allow only `05` Micheline-framed payloads that decode into a displayable preview.
- Sign dApp messages by stripping the leading `05` from the payload and passing `05` as the explicit watermark to `vault.sign`.
- Never call `vault.sign` without an explicit typed watermark from the dApp message-signing path.
- RAW Beacon sign requests are converted to a Micheline string framed with `Mavryk Signed Message: `.
- Reject legacy `Tezos Signed Message: ` framing.
- Reject Mavryk Wallet Authentication challenge content for untrusted dApp origins, including readable challenge text and hex-encoded challenge text.

### Nexus Auth Exception

- Nexus signs its auth challenge from the dApp with:
  - `requestSignPayload`;
  - `signingType: "micheline"`;
  - a Micheline string payload built from the challenge text.
- The SEC-04 guard originally rejected that payload for every dApp, which surfaced in Nexus as `ParametersInvalidMavletError` / `[PARAMETERS_INVALID_ERROR]`.
- Decision: allow Mavryk auth challenge signing only for trusted first-party Nexus origins:
  - `https://basenet.nexus.mavryk.org`
  - `https://nexus.mavryk.org`
- The allowlist is checked against `new URL(origin).origin`. Paths and trailing slashes do not matter; protocol, host, and subdomain must match exactly.
- Arbitrary dApps and localhost remain blocked unless a future decision explicitly adds them.

### Manual Test Checklist

- Wallet API auth on basenet:
  - load the rebuilt extension;
  - import or unlock a wallet on basenet;
  - confirm `/auth/challenge` followed by `/auth/verify` succeeds;
  - protected wallet API data loads;
  - repeated `/auth/challenge` calls do not continue until a `429` occurs.
- Nexus compatibility:
  - open `https://basenet.nexus.mavryk.org`;
  - connect the rebuilt wallet;
  - trigger Nexus auth signing;
  - approve the sign confirmation;
  - expect no `ParametersInvalidMavletError`;
  - expect Nexus to receive `<publicKey>:<signature>`.
- Prod Nexus compatibility:
  - repeat the same flow on `https://nexus.mavryk.org`.
- Negative auth-challenge test:
  - from any untrusted origin, request signing of the same Mavryk auth challenge Micheline payload;
  - expect wallet-side invalid params rejection.
- SEC-05 negative tests:
  - try dApp signing payloads starting with `01`, `02`, and `03`;
  - try unframed raw hex;
  - expect invalid params rejection.
- Normal message-signing regression checks:
  - RAW signing should be framed as `Mavryk Signed Message: ...`;
  - normal displayable `05` Micheline strings that are not auth challenges should still sign.

### Verification Notes

- Focused Jest command passed:
  `npm run test -- src/lib/temple/back/sign-payload.helpers.test.ts src/mavryk/api/auth-payload.helpers.test.ts src/mavryk/api/utils.test.ts src/lib/temple/back/actions.test.ts --runInBand`
- Focused ESLint passed for the touched auth/signing files.
- `git diff --check` passed.
- Known unrelated local verification limits:
  - full Jest has pre-existing failures in unrelated test files;
  - `npm run ts` fails on newer dependency types under TypeScript 4.5;
  - `npm run build` fails before app code because webpack cannot load `webpack/base.config` from `webpack.config.ts`.

### Relevant Files

- Wallet auth payload helpers: `src/mavryk/api/auth-payload.helpers.ts`
- Internal wallet auth signing: `src/mavryk/api/utils.ts`
- dApp signing guard: `src/lib/temple/back/sign-payload.helpers.ts`
- dApp sign request path: `src/lib/temple/back/dapp.ts`
- Beacon RAW message framing: `src/lib/temple/back/actions.ts`
- Focused tests:
  - `src/mavryk/api/auth-payload.helpers.test.ts`
  - `src/mavryk/api/utils.test.ts`
  - `src/lib/temple/back/sign-payload.helpers.test.ts`
