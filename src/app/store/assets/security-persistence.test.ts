import { BROWSER_STORAGE } from 'lib/store/zustand/persist-storage';

import { persistAssetSecurity, restoreAssetSecurity } from './security-persistence';

it('retains offline whitelist/scamlist while leaving legacy payloads untouched and preferring the active Redux root', async () => {
  const legacy = {
    tokens: { data: { 'a@b': { token: { status: 'enabled' } } } },
    mainnetWhitelist: { data: ['safe'], isLoading: true },
    mainnetScamlist: { data: { scam: true }, isLoading: true }
  };
  const before = JSON.stringify(legacy);
  const read = jest.spyOn(BROWSER_STORAGE, 'get').mockResolvedValue({ 'persist:root.assets': legacy });
  const restored = await restoreAssetSecurity(undefined);
  expect(restored.mainnetWhitelist).toMatchObject({ data: ['safe'], isLoading: false });
  expect(restored.mainnetScamlist.data).toEqual({ scam: true });
  expect(restored.tokens.data).toEqual({});
  expect(JSON.stringify(legacy)).toBe(before);
  restored.mainnetScamlist.data = { newer: true };
  const active = persistAssetSecurity(restored);
  read.mockClear();
  expect((await restoreAssetSecurity(active)).mainnetScamlist.data).toEqual({ newer: true });
  expect(read).not.toHaveBeenCalled();
  read.mockRestore();
});

it('exposes storage and invalid security-cache errors', async () => {
  const read = jest.spyOn(BROWSER_STORAGE, 'get').mockRejectedValue(new Error('offline read failure'));
  await expect(restoreAssetSecurity(undefined)).rejects.toThrow('offline read failure');
  await expect(
    restoreAssetSecurity({ mainnetWhitelist: { data: [] }, mainnetScamlist: { data: { scam: 'false' } } })
  ).rejects.toThrow();
  read.mockRestore();
});
