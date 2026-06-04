type RawPayloadRecord = Record<string, unknown> & {
  contents?: unknown;
};

const isRawPayloadRecord = (value: unknown): value is RawPayloadRecord => typeof value === 'object' && value !== null;

/**
 * Checks whether a raw confirmation payload contains displayable content for the Raw tab.
 * @param payload Raw payload candidate from a confirmation request.
 * @returns `true` when the payload contains non-empty string data or at least one raw item.
 */
export const hasDisplayableRawPayload = (payload: unknown): boolean => {
  if (typeof payload === 'string') {
    return payload.trim().length > 0;
  }

  if (Array.isArray(payload)) {
    return payload.length > 0;
  }

  if (!isRawPayloadRecord(payload)) {
    return false;
  }

  if (Array.isArray(payload.contents)) {
    return payload.contents.length > 0;
  }

  return Object.keys(payload).length > 0;
};
