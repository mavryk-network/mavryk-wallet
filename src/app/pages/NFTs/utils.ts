import { isDefined } from '@rnw-community/shared';

import { NFTDetails } from 'app/store/nfts/state';
import { objktCurrencies } from 'lib/apis/objkt';

export function getListingDetails(details: NFTDetails | nullish) {
  if (!details?.listing) return null;

  const { floorPrice, currencyId } = details.listing;

  const currency = objktCurrencies[currencyId];

  if (!isDefined(currency)) return null;

  return { floorPrice, decimals: currency.decimals, symbol: currency.symbol };
}
