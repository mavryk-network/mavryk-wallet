import { getRoute3TokenBySlug } from 'lib/route3/utils/get-route3-token-by-slug';
import { useSwapTokensQuery, useSwapDexesQuery } from 'lib/swap/use-swap.query';

import { useSelector } from '../index';

import { getSwapParamsData } from './selectors.utils';

export const useSwapParamsSelector = () => useSelector(state => getSwapParamsData(state.swap.swapParams));
export const useSwapTokensSelector = useSwapTokensQuery;
export const useSwapTokenSelector = (slug: string) => getRoute3TokenBySlug(useSwapTokensQuery().data, slug);
export const useSwapDexesSelector = useSwapDexesQuery;
export { getSwapParamsData };
