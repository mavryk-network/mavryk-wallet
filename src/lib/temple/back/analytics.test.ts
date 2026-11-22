import { capturePostHogEvent, isPostHogConfigured } from 'lib/analytics/posthog.client';
import { waitForAnalyticsIdentity } from 'lib/store/zustand/ui-owner';

import { trackBackgroundEvent, trackEvent, trackOperationError } from './analytics';

jest.mock('lib/analytics/posthog.client', () => ({
  isPostHogConfigured: jest.fn(),
  capturePostHogEvent: jest.fn()
}));
jest.mock('lib/store/zustand/ui-owner', () => ({ waitForAnalyticsIdentity: jest.fn() }));
const mockStorageGet = jest.fn();
jest.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: { storage: { local: { get: (...args: unknown[]) => mockStorageGet(...args) } } }
}));

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  (isPostHogConfigured as jest.Mock).mockReturnValue(true);
  (waitForAnalyticsIdentity as jest.Mock).mockResolvedValue('anon-id');
  (capturePostHogEvent as jest.Mock).mockResolvedValue(undefined);
  mockStorageGet.mockResolvedValue({ network_id: 'basenet' });
});

it('sends whitelisted properties with anonymous super properties only', async () => {
  await trackBackgroundEvent('account_added', { type: 'hd' });

  expect(capturePostHogEvent).toHaveBeenCalledWith({
    event: 'account_added',
    distinctId: 'anon-id',
    properties: expect.objectContaining({ type: 'hd', network: 'basenet', extension_version: process.env.VERSION })
  });
  const { properties } = (capturePostHogEvent as jest.Mock).mock.calls[0][0];
  expect(Object.keys(properties).sort()).toEqual(['browser', 'environment', 'extension_version', 'network', 'type']);
});

it('is a no-op without a key, without consent, or for non-whitelisted payloads', async () => {
  (isPostHogConfigured as jest.Mock).mockReturnValueOnce(false);
  await trackBackgroundEvent('wallet_unlocked', {});

  (waitForAnalyticsIdentity as jest.Mock).mockResolvedValueOnce(null);
  await trackBackgroundEvent('wallet_unlocked', {});

  await trackBackgroundEvent('wallet_unlocked', { address: 'mv1' } as {});

  expect(capturePostHogEvent).not.toHaveBeenCalled();
});

it('never throws when the transport fails', async () => {
  (capturePostHogEvent as jest.Mock).mockRejectedValueOnce(new Error('offline'));

  await expect(trackBackgroundEvent('wallet_unlocked', {})).resolves.toBeUndefined();
});

it('buckets the operation network from its RPC and reports rejections and failures separately', async () => {
  trackOperationError(new Error('Declined'), { tx_type: 'send', asset_type: 'mvrk' }, 'wallet', 'https://x.io', true);
  trackOperationError(
    { errors: [{ id: 'proto.002-PtBoreas.contract.balance_too_low' }] },
    { tx_type: 'send', asset_type: 'token' },
    'dapp',
    'https://mainnet.rpc.mavryk.network',
    false
  );
  await flush();

  expect(capturePostHogEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'tx_rejected',
      properties: expect.objectContaining({ tx_type: 'send', source: 'wallet', network: 'custom' })
    })
  );
  expect(capturePostHogEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'tx_failed',
      properties: expect.objectContaining({ error_code: 'contract.balance_too_low', network: 'mainnet' })
    })
  );
});

it('accepts only foreground events from extension pages', async () => {
  await trackEvent({ userId: 'ignored', rpc: undefined, event: 'tx_confirmed', category: 'General' as never });
  await trackEvent({
    userId: 'ignored',
    rpc: undefined,
    event: 'contact_added',
    category: 'General' as never,
    properties: { method: 'manual' }
  });
  await flush();

  expect(capturePostHogEvent).toHaveBeenCalledTimes(1);
  expect(capturePostHogEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'contact_added' }));
});
