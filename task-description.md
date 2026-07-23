## SEC-04 · Domain separation for signing: dApp `sign_payload` steals the auth signature → JWT hijack

**Priority:** P0 · **Severity:** HIGH · **Area:** dapp-beacon / auth

**Problem**
Backend login and dApp message signing use a single primitive without domain separation. Auth signs the challenge as `05 01 <len> <hex>` via `vault.sign` without a watermark; `requestSign` calls the same `vault.sign`, also without a watermark. `/auth/challenge` and `/auth/verify` are public.

**Files**`src/mavryk/api/utils.ts:13-30` · `src/lib/temple/back/dapp.ts:238,313` · `src/lib/temple/back/actions.ts:141` · `mavryk-wallet-backend/internal/core/domain/auth/signature.go:57-85` · `mavryk-wallet-backend/internal/core/application/auth/verify_signature/action.go:45`

**Attack scenario**

1. A connected dApp (which holds the victim's pkh+publicKey) calls `POST /auth/challenge {walletAddress: victim}` → `{challenge, nonce}`
2. The dApp asks to sign the Micheline payload of the challenge; the window shows an opaque hex, not "Mavryk Wallet Authentication"
3. The attacker sends `${publicKey}:${prefixSig}` to `POST /auth/verify` → obtains the victim's access+refresh JWT → full account takeover (KYC, RWA, history, contacts)

**What to do**

- [ ] Prefix the backend challenge with a magic string/namespace that the wallet enforces and forbids inside dApp payloads
- [ ] The wallet rejects any dApp sign-payload whose decoded content matches the auth-challenge template
- [ ] Preferably: a separate signature derivation that is unreachable via the dApp path
- [ ] And/or bind the challenge to an origin-nonce that the dApp cannot reproduce
- [ ] Backend: tie verify to origin/session context, not just nonce+walletAddress

---

## SEC-05 · Blind signing of operations: `sign_payload` without watermark

**Priority:** P0 · **Severity:** HIGH · **Area:** dapp-beacon / signing

**Problem**`requestSign` performs no magic-byte/watermark gating: it accepts any hex and calls `vault.sign(pkh, payload)` with `watermark=undefined` - signing raw bytes. A valid Mavryk operation signature is exactly `sign(0x03 || op_bytes)`.

**Files**`src/lib/temple/back/dapp.ts:246,274,292,313,331` · `src/lib/temple/back/actions.ts:843` · `src/lib/temple/back/vault/index.ts:816` · `src/app/templates/OperationView.tsx:39`

**Attack scenario**
A connected dApp sends `payload = 03<forged branch+contents>` (source = victim's pkh) and receives a valid operation signature. The window displays this as a harmless "sign message" (the preview falls back on `0x03` → raw bytes only, with no fee/dry-run/warnings). The dApp assembles `<forged_op><sig>` and injects it via `requestBroadcast` or directly into the RPC → theft of funds, bypassing operation confirmation.

**What to do**

- [ ] In `requestSign`, reject payloads whose first byte is `0x03` (operation), `0x01`/`0x02` (block/endorsement)
- [ ] For RAW, require the Mavryk Signed Message framing
- [ ] Allow only `0x05` Micheline payloads that decode into a human-readable preview; refuse if the preview could not be built
- [ ] Never call `vault.sign` without an explicit typed watermark on the message-signing path
- [ ] Route every intent to move funds through the operation-confirmation UI
