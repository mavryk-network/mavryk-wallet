import { updateOwnedUI } from 'lib/store/zustand/ui-client';

import { ownedUIMiddleware } from './owned-ui.middleware';
import { setIsAnalyticsEnabledAction } from './settings/actions';
import { putTokensMetadataAction, resetTokensMetadataLoadingAction } from './tokens-metadata/actions';

jest.mock('lib/store/zustand/ui-client', () => ({ updateOwnedUI: jest.fn(async () => undefined) }));

it('routes preference writers away from Redux and preserves unrelated actions', () => {
  const next = jest.fn();
  const dispatch = jest.fn();
  const middleware = ownedUIMiddleware({ dispatch, getState: jest.fn() })(next);
  const preference = setIsAnalyticsEnabledAction(false);
  expect(middleware(preference)).toBe(preference);
  expect(updateOwnedUI).toHaveBeenCalledWith({ kind: 'preferences', values: { isAnalyticsEnabled: false } });
  expect(next).not.toHaveBeenCalled();
  middleware({ type: 'unrelated' });
  expect(next).toHaveBeenCalledWith({ type: 'unrelated' });
});

it('builds fetched metadata once and only resets Redux loading after the owner saves it', async () => {
  const next = jest.fn();
  const dispatch = jest.fn();
  const middleware = ownedUIMiddleware({ dispatch, getState: jest.fn() })(next);
  middleware(
    putTokensMetadataAction({
      records: { KT1test_0: { name: 'Test', symbol: 'TEST', decimals: 6 } },
      resetLoading: true
    })
  );
  expect(updateOwnedUI).toHaveBeenLastCalledWith({
    kind: 'metadata',
    mode: 'put',
    records: {
      KT1test_0: { name: 'Test', symbol: 'TEST', decimals: 6, address: 'KT1test', id: '0' }
    }
  });
  expect(next).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(dispatch).toHaveBeenCalledWith(resetTokensMetadataLoadingAction());
});
