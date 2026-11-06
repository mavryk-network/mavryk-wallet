import { WhitelistResponseToken } from 'lib/apis/temple/whitelist-tokens';
import { buildTokenMetadataFromWhitelist } from 'lib/metadata/utils';

import { syncSecurity } from './sync-security';

const mockRequestOwnedUISnapshot = jest.fn();

jest.mock('lib/store/zustand/ui-client', () => ({
  requestOwnedUISnapshot: (...args: unknown[]) => mockRequestOwnedUISnapshot(...args),
  updateOwnedUI: jest.fn()
}));

const VALID_KT1 = 'KT1SLHVU9YHqtNyyVfqK8cULCYbr3aAYebR6';
const OTHER_VALID_KT1 = 'KT18fp5rcTW7mbWDmzFwjLDUhs5MeJmagDSZ';
const request = { requestKey: 'security', requestId: 'one' };

const token = (contractAddress: string, network: string, fa2TokenId?: number): WhitelistResponseToken => ({
  contractAddress,
  fa2TokenId,
  network,
  type: 'FA2',
  metadata: { decimals: 6, name: 'Tether USD', symbol: 'USDT' }
});

const sentCommand = () => mockRequestOwnedUISnapshot.mock.calls[0][0];

beforeEach(() => {
  mockRequestOwnedUISnapshot.mockReset();
  mockRequestOwnedUISnapshot.mockResolvedValue({
    assets: { syncRequests: { [request.requestKey]: request.requestId } }
  });
});

it('forwards only mainnet KT1 whitelist entries and their metadata', async () => {
  const valid = token(VALID_KT1, 'mainnet', 3);
  const data = [
    token(OTHER_VALID_KT1, 'ghostnet'),
    token('mv1MmzUmDpKRTe5rbuqvsD3bBWrewNX58AGX', 'mainnet'),
    token('tez', 'mainnet'),
    token('not-an-address', 'mainnet'),
    token('KT1AttackerLookalikeContract00000000000', 'mainnet'),
    valid
  ];
  const snapshot = JSON.stringify(data);

  await syncSecurity(request, { kind: 'whitelist', data });

  expect(sentCommand()).toEqual({
    kind: 'whitelist-sync',
    ...request,
    data: [`${VALID_KT1}_3`],
    metadata: { [`${VALID_KT1}_3`]: buildTokenMetadataFromWhitelist(valid) }
  });
  expect(JSON.stringify(data)).toBe(snapshot);
});

it('keeps the native mainnet entry as metadata only', async () => {
  const native = token('mav', 'mainnet');
  const foreign = { ...token('mav', 'ghostnet'), metadata: { decimals: 0, name: 'Fake', symbol: 'FAKE' } };

  await syncSecurity(request, { kind: 'whitelist', data: [native, foreign] });

  expect(sentCommand()).toEqual({
    kind: 'whitelist-sync',
    ...request,
    data: [],
    metadata: { mav_0: buildTokenMetadataFromWhitelist(native) }
  });
});

it('drops scamlist slugs whose contract is not a KT1 address', async () => {
  const data = {
    [`${VALID_KT1}_0`]: true,
    [`${OTHER_VALID_KT1}_5`]: false,
    mv1MmzUmDpKRTe5rbuqvsD3bBWrewNX58AGX_0: true,
    'not-an-address_0': true,
    mav: true
  };
  const snapshot = JSON.stringify(data);

  await syncSecurity(request, { kind: 'scamlist', data });

  expect(sentCommand()).toEqual({
    kind: 'scamlist-sync',
    ...request,
    data: { [`${VALID_KT1}_0`]: true, [`${OTHER_VALID_KT1}_5`]: false }
  });
  expect(JSON.stringify(data)).toBe(snapshot);
});
