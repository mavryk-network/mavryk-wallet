import { createEntity } from 'lib/store';

import { getSwapParamsData } from './selectors.utils';

describe('getSwapParamsData', () => {
  it('exposes background quote refetching separately from initial loading', () => {
    const swapParams = getSwapParamsData(createEntity({ input: '1', output: '2', chains: [] }, true));

    expect(swapParams.isFetching).toBe(true);
    expect(swapParams.isLoading).toBe(false);
  });

  it('keeps initial quote loading true before any quote data resolves', () => {
    const swapParams = getSwapParamsData(createEntity({ input: undefined, output: undefined, chains: [] }, true));

    expect(swapParams.isFetching).toBe(true);
    expect(swapParams.isLoading).toBe(true);
  });
});
