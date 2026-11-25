import { hasDisplayableRawPayload } from './raw-payload.helpers';

describe('hasDisplayableRawPayload', () => {
  it('returns false for empty payloads', () => {
    expect(hasDisplayableRawPayload(undefined)).toBe(false);
    expect(hasDisplayableRawPayload(null)).toBe(false);
    expect(hasDisplayableRawPayload('')).toBe(false);
    expect(hasDisplayableRawPayload('   ')).toBe(false);
    expect(hasDisplayableRawPayload([])).toBe(false);
    expect(hasDisplayableRawPayload({ contents: [] })).toBe(false);
  });

  it('returns true for non-empty string payloads', () => {
    expect(hasDisplayableRawPayload('0x1234')).toBe(true);
    expect(hasDisplayableRawPayload('{ Elt "foo" "bar" }')).toBe(true);
  });

  it('returns true for raw operation payloads with items', () => {
    expect(hasDisplayableRawPayload([{ kind: 'transaction' }])).toBe(true);
    expect(hasDisplayableRawPayload({ branch: 'BLock', contents: [{ kind: 'transaction' }] })).toBe(true);
  });
});
