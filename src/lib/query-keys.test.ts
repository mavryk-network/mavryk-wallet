import { assetDetailsKeys, swapKeys } from './query-keys';

describe('swapKeys', () => {
  it('builds a full account/chain/request quote key', () => {
    const key = swapKeys.params('mv1-account', 'NetX', {
      fromSymbol: 'MAV',
      toSymbol: 'USDt',
      amount: '123.45',
      chainsLimit: 4
    });

    expect(key).toEqual(['swap', 'params', 'mv1-account', 'NetX', 'MAV', 'USDt', '123.45', 4]);
  });

  it('keeps allParams as a strict quote-key prefix', () => {
    const key = swapKeys.params('mv1-account', 'NetX', {
      fromSymbol: 'MAV',
      toSymbol: 'USDt',
      amount: '123.45'
    });

    expect(swapKeys.allParams).toEqual(['swap', 'params']);
    expect(key.slice(0, swapKeys.allParams.length)).toEqual(swapKeys.allParams);
    expect(key.length).toBeGreaterThan(swapKeys.allParams.length);
    expect(key).toEqual(['swap', 'params', 'mv1-account', 'NetX', 'MAV', 'USDt', '123.45', null]);
  });
});

describe('assetDetailsKeys', () => {
  it('scopes batches without slug lists and separates leaf keys and categories', () => {
    expect(assetDetailsKeys.batch('collectibles', 'a', 'c', 'n')).toEqual([
      'asset-details',
      'collectibles',
      'batch',
      'a',
      'c',
      'n'
    ]);
    expect(assetDetailsKeys.leaf('rwas', 'a', 'c', 'n', 'slug')).toEqual([
      'asset-details',
      'rwas',
      'leaf',
      'a',
      'c',
      'n',
      'slug'
    ]);
    expect(assetDetailsKeys.batch('rwas', 'a', 'c', 'n')).not.toEqual(
      assetDetailsKeys.batch('collectibles', 'a', 'c', 'n')
    );
  });
});
