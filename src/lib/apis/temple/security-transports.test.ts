import axios from 'axios';

import { fetchScamlistTokens } from './scamlist-tokens';
import { fetchWhitelistTokens } from './whitelist-tokens';

jest.mock('axios', () => ({ create: jest.fn(() => ({ get: jest.fn() })) }));

const reply = (data: unknown) => {
  for (const result of (axios.create as jest.Mock).mock.results) result.value.get.mockResolvedValue({ data });
};

it('rejects missing/malformed security payloads and accepts explicit successful empty responses', async () => {
  for (const data of [
    {},
    { slugs: null, tokens: null },
    { slugs: [], tokens: {} },
    { slugs: { scam: 'false' }, tokens: [{}] }
  ]) {
    reply(data);
    await expect(fetchScamlistTokens()).rejects.toThrow();
    await expect(fetchWhitelistTokens()).rejects.toThrow();
  }
  reply({ slugs: {}, tokens: [] });
  await expect(fetchScamlistTokens()).resolves.toEqual({});
  await expect(fetchWhitelistTokens()).resolves.toEqual([]);
  reply({ slugs: { scam: true, allowed: false } });
  await expect(fetchScamlistTokens()).resolves.toEqual({ scam: true, allowed: false });
});
