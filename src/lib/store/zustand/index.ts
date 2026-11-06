// Background-only destination boundary; foregrounds use ui-client snapshots and commands.
export { uiStore, createUIStore } from './ui.store';
export type { UIState } from './ui.store';
export { metadataStore, createMetadataStore } from './metadata.store';
export type { MetadataState } from './metadata.store';
export { assetsStore, createAssetsStore } from './assets.store';
export type { AssetsState } from './assets.store';
export { awaitStoresHydrated } from './await-stores-hydrated';
export { commitStagedWrites } from './destination-store';
export type { StagedWrite } from './destination-store';
export { balancesStore, createBalancesStore } from './balances.store';
export type { BalancesState } from './balances-state.schema';
