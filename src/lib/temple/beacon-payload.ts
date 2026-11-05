// Kept free of heavy imports: the content script bundles this module.
export const MAX_BEACON_PAYLOAD_LENGTH = 64 * 1024;

export const isBeaconPayloadWithinLimit = (payload: unknown): payload is string =>
  typeof payload === 'string' && payload.length <= MAX_BEACON_PAYLOAD_LENGTH;
