import { useSelector } from '../root-state.selector';

import type { RwaDetails } from './state';

export const useRwaDetailsSelector = (slug: string): RwaDetails | nullish =>
  useSelector(({ rwas }) => rwas.details.data[slug]);

export const useAllRwaDetailsSelector = (): Record<string, RwaDetails | nullish> =>
  useSelector(({ rwas }) => rwas.details.data);

export const useAllRwasDetailsLoadingSelector = () => useSelector(({ rwas }) => rwas.details.isLoading);

export const useRwaIsAdultSelector = (slug: string): boolean | undefined =>
  useSelector(({ rwas }) => rwas.adultFlags[slug]?.val);
