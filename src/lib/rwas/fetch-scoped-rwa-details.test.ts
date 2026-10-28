import browser from 'webextension-polyfill';

import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';
import { NETWORK_ID_STORAGE_KEY } from 'lib/temple/network-storage';
import { fetchWalletRwaAssets } from 'mavryk/api/rwas';
import { getSelectedNetworkIdFromStorage, getWalletAddressFromStorage } from 'mavryk/api/storage';

import { fetchScopedRwaDetails } from './fetch-scoped-rwa-details';

jest.mock('mavryk/api/rwas', () => ({
  fetchWalletRwaAssets: jest.fn(),
  walletRwaAssetToDetails: (asset: { name: string }) => ({ name: asset.name })
}));
jest.mock('mavryk/api/storage', () => ({
  getSelectedNetworkIdFromStorage: jest.fn(),
  getWalletAddressFromStorage: jest.fn(),
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY: 'auth-map'
}));

const scope = { account: 'a', chainId: 'chain', networkId: 'mainnet' };
const fetchAssets = fetchWalletRwaAssets as jest.MockedFunction<typeof fetchWalletRwaAssets>;
const getAccount = getWalletAddressFromStorage as jest.MockedFunction<typeof getWalletAddressFromStorage>;
const getNetwork = getSelectedNetworkIdFromStorage as jest.MockedFunction<typeof getSelectedNetworkIdFromStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  getAccount.mockResolvedValue('a');
  getNetwork.mockResolvedValue('mainnet');
});

it('keeps the existing wallet batch transport and maps its returned assets', async () => {
  fetchAssets.mockResolvedValue([
    {
      address: 'asset',
      name: 'Example',
      balance: 1,
      marketPrice: null,
      lastSale: null,
      pricingValidUntil: null,
      marketValueUsd: null
    }
  ]);
  expect(await fetchScopedRwaDetails(scope)).toEqual({ asset_0: { name: 'Example' } });
  expect(fetchAssets).toHaveBeenCalledTimes(1);
  expect(fetchAssets).toHaveBeenCalledWith({ walletAddress: 'a' });
  expect(browser.storage.onChanged.removeListener).toHaveBeenCalled();
});

it.each(['account', 'network'])('skips requests for a mismatched selected %s', async field => {
  if (field === 'account') getAccount.mockResolvedValue('b');
  else getNetwork.mockResolvedValue('basenet');
  await expect(fetchScopedRwaDetails(scope)).rejects.toMatchObject({ revert: true });
  expect(fetchAssets).not.toHaveBeenCalled();
});

it.each([ACCOUNT_PKH_STORAGE_KEY, NETWORK_ID_STORAGE_KEY])(
  'rejects an observed selection transition even when storage returns to the original value: %s',
  async key => {
    fetchAssets.mockImplementation(async () => {
      const listener = (
        browser.storage.onChanged.addListener as jest.MockedFunction<typeof browser.storage.onChanged.addListener>
      ).mock.calls[0][0];
      listener({ [key]: { oldValue: 'a', newValue: 'b' } }, 'local');
      listener({ [key]: { oldValue: 'b', newValue: 'a' } }, 'local');
      return [];
    });
    await expect(fetchScopedRwaDetails(scope)).rejects.toMatchObject({ revert: true });
    expect(browser.storage.onChanged.removeListener).toHaveBeenCalled();
  }
);

it('propagates transport failures and rejects a cancelled late response', async () => {
  fetchAssets.mockRejectedValueOnce(new Error('failed'));
  await expect(fetchScopedRwaDetails(scope)).rejects.toThrow('failed');
  const controller = new AbortController();
  fetchAssets.mockImplementationOnce(async () => {
    controller.abort();
    return [];
  });
  await expect(fetchScopedRwaDetails(scope, controller.signal)).rejects.toMatchObject({ revert: true });
});
