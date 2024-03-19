import { useSelector } from '../index';
import type { NFTDetails } from './state';

export const useNFTDetailsSelector = (slug: string): NFTDetails | nullish =>
  useSelector(({ nfts }) => nfts.details.data[slug]);

export const useAllNFTDetailsSelector = (): Record<string, NFTDetails | nullish> =>
  useSelector(({ nfts }) => nfts.details.data);

export const useAllNFTsDetailsLoadingSelector = () => useSelector(({ nfts }) => nfts.details.isLoading);

export const useNFTIsAdultSelector = (slug: string): boolean | undefined =>
  useSelector(({ nfts }) => nfts.adultFlags[slug]?.val);
