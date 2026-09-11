import { updateOwnedUI } from 'lib/store/zustand/ui-client';
import { TempleChainId } from 'lib/temple/types';

import * as actions from './assets/actions';
import { assetsPersistedReducer } from './assets/reducer';
import { putCollectiblesMetadataAction, resetCollectiblesMetadataLoadingAction } from './collectibles-metadata/actions';
import { ownedAssetsMiddleware } from './owned-assets.middleware';
import { hidePromotionAction, togglePartnersPromotionAction } from './partners-promotion/actions';

jest.mock('lib/store/zustand/ui-client', () => ({ updateOwnedUI: jest.fn(async () => undefined) }));

beforeEach(() => jest.clearAllMocks());

it.each([
  ['tokens', actions.putTokensAsIsAction, actions.setTokenStatusAction, actions.loadAccountTokensActions.success],
  [
    'collectibles',
    actions.putCollectiblesAsIsAction,
    actions.setCollectibleStatusAction,
    actions.loadAccountCollectiblesActions.success
  ],
  ['rwas', actions.putRwasAsIsAction, actions.setRwaStatusAction, actions.loadAccountRwasActions.success]
] as const)(
  'hands off all %s producer actions while retaining Redux loading/security ownership',
  (category, put, status, loaded) => {
    const next = jest.fn();
    const middleware = ownedAssetsMiddleware({ dispatch: jest.fn(), getState: jest.fn() })(next);
    const value = {
      account: 'a',
      chainId: TempleChainId.Mainnet,
      slug: 'custom',
      status: 'removed' as const,
      manual: false
    };
    middleware(put([value]));
    expect(updateOwnedUI).toHaveBeenLastCalledWith({ kind: 'assets-put', category, records: [value] });
    const { manual, ...statusValue } = value;
    expect(manual).toBe(false);
    middleware(status(statusValue));
    expect(updateOwnedUI).toHaveBeenLastCalledWith({ kind: 'assets-status', category, value: statusValue });
    expect(next).not.toHaveBeenCalled();
    const fetched = loaded({ account: 'a', chainId: value.chainId, slugs: ['fetched'] });
    middleware(fetched);
    expect(next).toHaveBeenCalledWith(fetched);
    const state = assetsPersistedReducer(undefined, fetched);
    expect(state[category].data).toEqual({});
    const security = actions.loadTokensScamlistActions.success({ scam: true });
    middleware(security);
    expect(next).toHaveBeenLastCalledWith(security);
    expect(assetsPersistedReducer(state, security).mainnetScamlist.data).toEqual({ scam: true });
  }
);

it('routes promotion mutations and built metadata with delayed loading completion', async () => {
  const next = jest.fn();
  const dispatch = jest.fn();
  const middleware = ownedAssetsMiddleware({ dispatch, getState: jest.fn() })(next);
  middleware(togglePartnersPromotionAction(false));
  expect(updateOwnedUI).toHaveBeenLastCalledWith({ kind: 'promotion-toggle', value: false });
  middleware(hidePromotionAction({ id: '/home', timestamp: 1 }));
  expect(updateOwnedUI).toHaveBeenLastCalledWith({ kind: 'promotion-hide', id: '/home', timestamp: 1 });
  middleware(
    putCollectiblesMetadataAction({
      records: { KT1test_0: { name: 'N', symbol: 'S', decimals: 0 } },
      resetLoading: true
    })
  );
  expect(updateOwnedUI).toHaveBeenLastCalledWith({
    kind: 'nested-metadata',
    category: 'collectiblesMetadata',
    records: { KT1test_0: { address: 'KT1test', id: '0', name: 'N', symbol: 'S', decimals: 0 } }
  });
  expect(next).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(dispatch).toHaveBeenCalledWith(resetCollectiblesMetadataLoadingAction());
});

it('preserves RWA classification and hands off adult flags while Redux keeps fetched details', async () => {
  const { putRwasMetadataAction } = require('./rwas-metadata/actions');
  const { loadRwasDetailsActions } = require('./rwas/actions');
  const { rwasPersistedReducer } = require('./rwas/reducer');
  const next = jest.fn();
  const middleware = ownedAssetsMiddleware({ dispatch: jest.fn(), getState: jest.fn() })(next);
  middleware(
    putRwasMetadataAction({
      records: {
        KT1rwa_0: { name: 'RWA', symbol: 'MARS1', decimals: 0 },
        KT1token_0: { name: 'Token', symbol: 'TOK', decimals: 0 }
      }
    })
  );
  expect(updateOwnedUI).toHaveBeenLastCalledWith({
    kind: 'nested-metadata',
    category: 'rwasMetadata',
    records: {
      KT1rwa_0: { address: 'KT1rwa', id: '0', name: 'RWA', symbol: 'MARS1', decimals: 0 }
    }
  });
  const action = loadRwasDetailsActions.success({
    details: { asset: { isAdultContent: true }, safe: {} },
    timestamp: 123000
  });
  middleware(action);
  expect(updateOwnedUI).toHaveBeenLastCalledWith({
    kind: 'adult-flags',
    category: 'rwas',
    timestamp: 123,
    flags: { asset: { val: true, ts: 123 }, safe: { val: false, ts: 123 } }
  });
  expect(next).toHaveBeenLastCalledWith(action);
  const state = rwasPersistedReducer(undefined, action);
  expect(state.details.data).toEqual(action.payload.details);
  expect(state.adultFlags).toEqual({});
});
