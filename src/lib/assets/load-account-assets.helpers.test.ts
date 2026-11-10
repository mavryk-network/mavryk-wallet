import { pickValidAssets } from './load-account-assets.helpers';

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
