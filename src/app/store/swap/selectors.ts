import { getRoute3TokenBySlug } from 'lib/route3/utils/get-route3-token-by-slug';

import { useSelector } from '../index';
import { getSwapParamsData } from './selectors.utils';

export const useSwapParamsSelector = () => useSelector(state => getSwapParamsData(state.swap.swapParams));
export const useSwapTokensSelector = () => useSelector(state => state.swap.tokens);
export const useSwapTokenSelector = (slug: string) =>
  useSelector(state => getRoute3TokenBySlug(state.swap.tokens.data, slug));
export const useSwapDexesSelector = () => useSelector(state => state.swap.dexes);
export { getSwapParamsData };
