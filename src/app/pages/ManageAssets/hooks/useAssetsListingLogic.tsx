import { useCollectiblesListingLogic } from 'app/hooks/use-collectibles-listing-logic';
import { useRWAListingLogic } from 'app/hooks/use-rwa-listing-logic';
import { useTokensListingLogic } from 'app/hooks/use-tokens-listing-logic';
import { AssetsType } from 'app/store/assets/selectors';

export const useAssetsListingLogic = (type: AssetsType, managebleSlugs: string[]) => {
  const tokensData = useTokensListingLogic(managebleSlugs, false);
  const collectiblesData = useCollectiblesListingLogic(managebleSlugs);
  const rwasData = useRWAListingLogic(managebleSlugs);

  switch (type) {
    case 'collectibles':
      return {
        displayedSlugs: collectiblesData.displayedSlugs,
        searchValue: collectiblesData.searchValue,
        setSearchValue: collectiblesData.setSearchValue
      };
    case 'rwas':
      return {
        displayedSlugs: rwasData.displayedSlugs,
        searchValue: rwasData.searchValue,
        setSearchValue: rwasData.setSearchValue
      };
    case 'tokens':
      return {
        displayedSlugs: tokensData.filteredAssets,
        searchValue: tokensData.searchValue,
        setSearchValue: tokensData.setSearchValue
      };

    default:
      return {
        displayedSlugs: tokensData.filteredAssets,
        searchValue: tokensData.searchValue,
        setSearchValue: tokensData.setSearchValue
      };
  }
};
