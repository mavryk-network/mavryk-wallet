import { DerivationType } from '@mavrykdynamics/webmavryk-ledger-signer';

import { DEFAULT_LEDGER_DERIVATION_PATH } from 'app/defaults';
import { TempleChainKind } from 'lib/temple/types';

import { buildLedgerAccountPayload, resolveLedgerDerivationPath } from './connect-ledger.helpers';

describe('connect-ledger.helpers', () => {
  it('resolves the default Ledger derivation path', () => {
    expect(resolveLedgerDerivationPath('default', "m/44'/1729'/5'/0'")).toBe(DEFAULT_LEDGER_DERIVATION_PATH);
    expect(resolveLedgerDerivationPath(undefined, "m/44'/1729'/5'/0'")).toBe(DEFAULT_LEDGER_DERIVATION_PATH);
  });

  it('resolves a custom Ledger derivation path', () => {
    const customDerivationPath = "m/44'/1729'/5'/0'";

    expect(resolveLedgerDerivationPath('custom', customDerivationPath)).toBe(customDerivationPath);
  });

  it('builds the Ledger account payload from the form data and fetched public key', () => {
    const payload = buildLedgerAccountPayload({
      name: '   ',
      defaultName: 'Ledger 2',
      derivationPath: "m/44'/1729'/5'/0'",
      derivationType: DerivationType.ED25519,
      publicKey: 'edpkvBYQLaemWxY8k6R5nYmdWhUQmBNgMW81mo9kMovfeWpD71kTSL'
    });

    expect(payload).toEqual({
      name: 'Ledger 2',
      chain: TempleChainKind.Tezos,
      derivationPath: "m/44'/1729'/5'/0'",
      derivationType: DerivationType.ED25519,
      publicKey: 'edpkvBYQLaemWxY8k6R5nYmdWhUQmBNgMW81mo9kMovfeWpD71kTSL',
      publicKeyHash: 'mv1VBAULLAGMCbF7FRHNtoUqiFJv1csUwqmE',
      isKYC: undefined
    });
  });
});
