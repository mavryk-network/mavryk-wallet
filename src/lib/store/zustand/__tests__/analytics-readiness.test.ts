import { sendPageEvent, sendTrackEvent } from 'lib/analytics/send-events.utils';
import { request } from 'lib/temple/front/client';
import { TempleMessageType } from 'lib/temple/types';

import { getOwnedUISnapshot } from '../ui-client';

jest.mock('../ui-client', () => ({ getOwnedUISnapshot: jest.fn() }));
jest.mock('lib/temple/front/client', () => ({ request: jest.fn(), assertResponse: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it('does not send before migration readiness or with restored opt-out', async () => {
  (getOwnedUISnapshot as jest.Mock).mockImplementation(() => {
    throw new Error('not ready');
  });
  await expect(sendTrackEvent('temporary', undefined, 'event')).rejects.toThrow('not ready');
  await expect(sendPageEvent('temporary', undefined, '/', '')).rejects.toThrow('not ready');
  (getOwnedUISnapshot as jest.Mock).mockReturnValue({
    ui: { legacyMigrated: true, isAnalyticsEnabled: false, userId: 'durable' }
  });
  await sendTrackEvent('temporary', undefined, 'event');
  await sendPageEvent('temporary', undefined, '/', '');
  expect(request).not.toHaveBeenCalled();
});

it('uses the adopted identity instead of caller-supplied startup IDs after readiness and consent', async () => {
  (getOwnedUISnapshot as jest.Mock).mockReturnValue({
    ui: { legacyMigrated: true, isAnalyticsEnabled: true, userId: 'durable' }
  });
  (request as jest.Mock)
    .mockResolvedValueOnce({ type: TempleMessageType.SendTrackEventResponse })
    .mockResolvedValueOnce({ type: TempleMessageType.SendPageEventResponse });
  await sendTrackEvent('temporary', undefined, 'event');
  await sendPageEvent('temporary', undefined, '/', '');
  expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: 'durable' }));
  expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: 'durable' }));
});
