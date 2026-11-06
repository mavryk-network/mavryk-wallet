import { applyBalanceRecords } from '../balances-command';
import { createBalancesMigration } from '../balances-migration';
import { BALANCE_RECORD_SCHEMA, BALANCES_SCHEMA } from '../balances-state.schema';
import { createBalancesStore } from '../balances.store';
import { memoryStorage } from '../test-support/helpers';

const source = (data: Record<string, string>) => ({
  balances: { balancesAtomic: { alice_chain: { data, isLoading: true, error: 'old' } } }
});
async function setup(initial: Record<string, unknown> = {}) {
  const memory = memoryStorage(initial);
  const balances = createBalancesStore(memory.storage);
  const readFallback = jest.fn(async (_key: string): Promise<string | null> => null);
  const migration = createBalancesMigration({ balances, storage: memory.storage, readFallback });
  return { ...memory, balances, readFallback, migration };
}

it('adopts active data only, retains precision/zero, excludes transient fields and preserves sources', async () => {
  const sources = {
    'persist:temple-root-task11': source({ mav: '0', token: '999999999999999999999.123' }),
    'persist:temple-root': source({ old: '1' })
  };
  const s = await setup(sources);
  await s.migration.initialize();
  expect(s.balances.getState().legacy).toEqual({ alice_chain: { mav: '0', token: '999999999999999999999.123' } });
  expect(s.balances.getState().isBalancesAdopted).toBe(true);
  for (const [key, value] of Object.entries(sources)) expect(s.records[key]).toEqual(value);
  const restart = await setup({ ...s.records, 'persist:temple-root-task11': 'broken' });
  await restart.migration.initialize();
  expect(restart.balances.getState().legacy).toEqual(s.balances.getState().legacy);
});

it('supports serialized historical sources and fresh profiles', async () => {
  const s = await setup();
  s.readFallback.mockImplementation(async key =>
    key === 'persist:temple-root' ? JSON.stringify({ balances: JSON.stringify(source({ token: '2' }).balances) }) : null
  );
  await s.migration.initialize();
  expect(s.balances.getState().legacy.alice_chain).toEqual({ token: '2' });
  const fresh = await setup();
  await fresh.migration.initialize();
  expect(fresh.balances.getState().legacy).toEqual({});
  expect(fresh.migration.isReady()).toBe(true);
});

it('does not revive historical data when the active source is a valid empty map', async () => {
  const s = await setup({
    'persist:temple-root-task11': { balances: { balancesAtomic: {} } },
    'persist:temple-root': source({ mav: '10' })
  });
  await s.migration.initialize();
  expect(s.balances.getState().legacy).toEqual({});
});

it.each([null, 'invalid', { balances: null }, { balances: {} }, source({ token: '-1' }), source({ token: 'NaN' })])(
  'rejects malformed present sources without completion: %p',
  async raw => {
    const s = await setup({ 'persist:temple-root-task11': raw });
    await expect(s.migration.initialize()).rejects.toThrow();
    expect(s.migration.isReady()).toBe(false);
    expect(s.readFallback).not.toHaveBeenCalled();
  }
);

it.each(['read', 'write', 'readback'])('retries %s failures without deleting source data', async failure => {
  const s = await setup({ 'persist:temple-root-task11': source({ mav: '7' }) });
  await s.balances.hydration.retry();
  if (failure === 'read') (s.storage.get as jest.Mock).mockRejectedValueOnce(new Error('read'));
  if (failure === 'write') (s.storage.set as jest.Mock).mockRejectedValueOnce(new Error('write'));
  if (failure === 'readback')
    (s.storage.get as jest.Mock).mockImplementation(async key => {
      if (key === 'zustand-balances') throw new Error('readback');
      return { [key]: s.records[key] };
    });
  await expect(s.migration.initialize()).rejects.toThrow();
  expect(s.migration.isReady()).toBe(false);
  (s.storage.get as jest.Mock).mockImplementation(async key => ({ [key]: s.records[key] }));
  await s.migration.initialize();
  expect(s.balances.getState().legacy.alice_chain.mav).toBe('7');
  expect(s.records['persist:temple-root-task11']).toBeDefined();
});

it('preserves validated destination values during partial-adoption restart', async () => {
  const state = BALANCES_SCHEMA.parse({
    legacy: { alice_chain: { mav: '9' } },
    scoped: {},
    revision: 0,
    isBalancesAdopted: false
  });
  const s = await setup({
    'zustand-balances': { version: 1, state },
    'persist:temple-root-task11': source({ mav: '1', token: '2' })
  });
  await s.migration.initialize();
  expect(s.balances.getState().legacy.alice_chain).toEqual({ mav: '9', token: '2' });
});

it('orders snapshot/delta races by owner revision, preserves omissions and allows corrected lower values', () => {
  const state = BALANCES_SCHEMA.parse({ legacy: {}, scoped: {}, revision: 0, isBalancesAdopted: true });
  applyBalanceRecords(state, 'scope', { mav: '10', token: '20' }, 1);
  applyBalanceRecords(state, 'scope', { token: '0' }, 3, { category: 'tokens', level: 20, isReorg: false });
  applyBalanceRecords(state, 'scope', { mav: '9', token: '25' }, 2);
  expect(state.scoped.scope.data).toEqual({ mav: '9', token: '0' });
  applyBalanceRecords(state, 'scope', { token: '30' }, 4, { category: 'tokens', level: 19, isReorg: false });
  expect(state.scoped.scope.data.token).toBe('0');
  applyBalanceRecords(state, 'scope', {}, 5, { category: 'tokens', level: 18, isReorg: true });
  applyBalanceRecords(state, 'scope', { staleNewSlug: '100' }, 4);
  expect(state.scoped.scope.data.staleNewSlug).toBeUndefined();
  applyBalanceRecords(state, 'scope', { token: '2' }, 6);
  expect(state.scoped.scope.data).toEqual({ mav: '9', token: '2' });
  applyBalanceRecords(state, 'other-scope', { mav: '1' }, 7);
  expect(state.scoped.scope.data.mav).toBe('9');
});

it.each(['', '-1', '1e20', 'Infinity', 'NaN'])('rejects invalid balance %s', value => {
  expect(() => BALANCE_RECORD_SCHEMA.parse({ mav: value })).toThrow();
});
