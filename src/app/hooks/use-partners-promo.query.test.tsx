import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { OptimalPromoVariantEnum } from 'lib/apis/optimal';
import { partnerPromotionKeys } from 'lib/query-keys';

import { usePartnersPromoQuery } from './use-partners-promo.query';

let mockAccount = 'account-a';
jest.mock('lib/temple/front', () => ({ useAccountPkh: () => mockAccount }));
jest.mock('app/env', () => ({ useAppEnv: () => ({ popup: true }) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('isolates account and placement without activating promotion requests', async () => {
  const fetcher = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { queryFn: fetcher } } });
  let result: ReturnType<typeof usePartnersPromoQuery> | undefined;
  function Consumer({ variant }: { variant: OptimalPromoVariantEnum }) {
    result = usePartnersPromoQuery(variant);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  const render = (variant: OptimalPromoVariantEnum) =>
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Consumer variant={variant} />
        </QueryClientProvider>
      )
    );
  client.setQueryData(partnerPromotionKeys.decision(mockAccount, OptimalPromoVariantEnum.Popup), { id: 'ad-a' });
  render(OptimalPromoVariantEnum.Popup);
  expect(result?.data?.id).toBe('ad-a');
  render(OptimalPromoVariantEnum.Token);
  expect(result?.data).toBeUndefined();
  mockAccount = 'account-b';
  render(OptimalPromoVariantEnum.Popup);
  expect(result?.data).toBeUndefined();
  await act(async () => {
    client.setQueryData(partnerPromotionKeys.decision('account-a', OptimalPromoVariantEnum.Popup), { id: 'late-a' });
    await client.invalidateQueries(['partner-promotion']);
  });
  expect(result?.data).toBeUndefined();
  expect(result?.isFetching).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
  act(() => root.unmount());
  client.clear();
});
