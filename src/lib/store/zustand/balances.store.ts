import { BALANCES_SCHEMA } from './balances-state.schema';
import { createDestinationStore } from './destination-store';
import { BrowserStorage } from './persist-storage';

/** Background-owned durable strings only; requests and errors belong to Query. */
export function createBalancesStore(storage?: BrowserStorage) {
  return createDestinationStore({
    name: 'zustand-balances',
    storage,
    schema: BALANCES_SCHEMA,
    defaults: { legacy: {}, scoped: {}, revision: 0, isBalancesAdopted: false },
    actions: () => ({})
  });
}
export const balancesStore = createBalancesStore();
