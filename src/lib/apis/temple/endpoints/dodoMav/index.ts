import { toTokenSlug } from 'lib/assets';

import { DodoMavItemType } from '../queries';

import { getPMMTokenPrice } from './price';

export const getDodoMavTokenPrices = (storages: DodoMavItemType[]) => {
  return storages.reduce<StringRecord<string>>((acc, storage) => {
    const slug = toTokenSlug(storage.base_token.address, storage?.base_token.token_id);

    if (slug && storage) {
      const decimals = Number(storage.base_token.dodo_mav_base_tokens[0].base_token.token_metadata?.decimals || 6);
      const price = getPMMTokenPrice(storage, decimals);
      acc[slug] = price.toString();
    }
    return acc;
  }, {});
};
