import { FetchedMetadataRecord } from 'lib/metadata/fetch';

import { pickAccountAssetsSync, pickValidAssets } from './load-account-assets.helpers';

const LONG_SLUG = `KT1spam_${'9'.repeat(600)}`;

it('skips oversized slugs and invalid balances so one airdropped token cannot block the account list', () => {
  expect(
    pickValidAssets({
      slugs: ['KT1ok_0', LONG_SLUG, 'KT1bad_0'],
      balances: { KT1ok_0: '5', [LONG_SLUG]: '1', KT1bad_0: '-1' }
    })
  ).toEqual({ slugs: ['KT1ok_0'], balances: { KT1ok_0: '5' } });
});

it('still treats a valid slug without any balance as an incomplete response', () => {
  expect(() => pickValidAssets({ slugs: ['KT1ok_0'], balances: {} })).toThrow('Incomplete asset balances');
  expect(() => pickValidAssets({ slugs: {}, balances: {} })).toThrow();
});

it('skips only the metadata of a new token whose raw metadata holds an unsafe key, keeping every token and balance', () => {
  const unsafe = { decimals: 0, name: 'Spam', thumbnailUri: { constructor: 'x' } };
  const result = pickAccountAssetsSync('tokens', {
    slugs: ['KT1ok_0', 'KT1spam_0'],
    balances: { KT1ok_0: '5', KT1spam_0: '1' },
    newMeta: {
      KT1ok_0: { decimals: 6, name: 'Ok', symbol: 'OK' },
      KT1spam_0: unsafe
    } as unknown as FetchedMetadataRecord
  });
  expect(result.slugs).toEqual(['KT1ok_0', 'KT1spam_0']);
  expect(result.balances).toEqual({ KT1ok_0: '5', KT1spam_0: '1' });
  expect(Object.keys(result.metadata)).toEqual(['KT1ok_0']);
  expect(result.metadata.KT1ok_0).toMatchObject({ name: 'Ok', symbol: 'OK', decimals: 6 });
});

it('never reads fields other than slugs and balances, so a full response cannot fail the asset check', () => {
  const response = { slugs: ['KT1ok_0'], balances: { KT1ok_0: '5' }, newMeta: JSON.parse('{"__proto__":{"x":1}}') };
  expect(pickValidAssets(response)).toEqual({ slugs: ['KT1ok_0'], balances: { KT1ok_0: '5' } });
});
