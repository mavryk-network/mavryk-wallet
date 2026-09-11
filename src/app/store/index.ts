import { devToolsEnhancer } from '@redux-devtools/remote';
import { Action, configureStore } from '@reduxjs/toolkit';
import {
  persistReducer,
  persistStore,
  createMigrate,
  PersistorOptions,
  PersistConfig,
  PersistedState
} from 'redux-persist';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';

import { IS_DEV_ENV } from 'lib/env';
import { createTransformsBeforePersist, storageConfig } from 'lib/store';
import { decodeLegacyUIRoot } from 'lib/store/zustand/legacy-ui-source';

import { persistAssetSecurity, restoreAssetSecurity } from './assets/security-persistence';
import { sanitizeCollectiblesMetadataForDevTools } from './collectibles-metadata/state';
import { MIGRATIONS } from './migrations';
import { ownedAssetsMiddleware } from './owned-assets.middleware';
import { ownedUIMiddleware } from './owned-ui.middleware';
import { epicMiddleware, rootEpic } from './root-state.epics';
import { rootReducer } from './root-state.reducer';
import type { RootState } from './root-state.type';
import { sanitizeRwasMetadataForDevTools } from './rwas-metadata/state';

export const SLICES_BLACKLIST = [
  'buyWithCreditCard' as const,
  'collectibles' as const,
  'rwas' as const,
  'rwasMetadata' as const,
  'collectiblesMetadata' as const
];

const persistConfigBlacklist: (keyof RootState)[] = SLICES_BLACKLIST;
const DEFAULT_REDUX_DEVTOOLS_PORT = 8000;

let preparedReduxState: PersistedState;

// Preflight before redux-persist starts: its internal rehydrate path otherwise swallows rejected storage reads.
async function readReduxState(config: PersistConfig<RootState>): Promise<PersistedState> {
  const state =
    (await storageConfig.getStoredState(config)) ??
    (await storageConfig.getStoredState({ ...config, key: 'temple-root' }));
  const decoded = state ? decodeLegacyUIRoot(state) : {};
  decoded.assets = await restoreAssetSecurity(decoded.assets);
  return {
    ...rootReducer(undefined, { type: '@@INIT' }),
    ...decoded,
    _persist: decoded._persist ?? { version: 3, rehydrated: false }
  } as PersistedState;
}

const reduxPersistConfig: PersistConfig<RootState> = {
  key: 'temple-root-task11',
  version: 3,
  ...storageConfig,
  // Preserve the rollback root verbatim; unrelated Redux domains continue under a separate live root.
  getStoredState: async () => preparedReduxState,
  stateReconciler: autoMergeLevel2,
  blacklist: persistConfigBlacklist,
  transforms: [createTransformsBeforePersist<RootState>({ assets: persistAssetSecurity })],
  debug: IS_DEV_ENV,
  migrate: createMigrate(MIGRATIONS, { debug: IS_DEV_ENV })
};

const persistedReducer = persistReducer<RootState>(reduxPersistConfig, rootReducer);

const REDUX_DEVTOOLS_ENABLED = IS_DEV_ENV && process.env.ENABLE_REDUX_DEVTOOLS === 'true';

const getReduxDevToolsPort = () => {
  const rawPort = process.env.REDUX_DEVTOOLS_PORT;
  if (!rawPort) return DEFAULT_REDUX_DEVTOOLS_PORT;

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid REDUX_DEVTOOLS_PORT: ${rawPort}`);
  }

  return port;
};

const REDUX_DEVTOOLS_PORT = REDUX_DEVTOOLS_ENABLED ? getReduxDevToolsPort() : null;

const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware => {
    const defMiddleware = getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false
    });

    return defMiddleware.concat(ownedUIMiddleware, ownedAssetsMiddleware, epicMiddleware);
  },
  devTools: false,
  enhancers: REDUX_DEVTOOLS_PORT
    ? [
        // See: https://github.com/zalmoxisus/remote-redux-devtools?tab=readme-ov-file#parameters
        devToolsEnhancer<RootState, Action>({
          realtime: true,
          port: Number(REDUX_DEVTOOLS_PORT),
          // See: https://github.com/reduxjs/redux-devtools/issues/496#issuecomment-670246737
          stateSanitizer: state => ({
            ...state,
            collectiblesMetadata: sanitizeCollectiblesMetadataForDevTools(state.collectiblesMetadata),
            rwasMetadata: sanitizeRwasMetadataForDevTools(state.rwasMetadata)
          })
        })
      ]
    : undefined
});

// redux-persist 6 implements manualPersist but omits it from its shipped declaration.
const persistOptions: PersistorOptions & { manualPersist: boolean } = { manualPersist: true };
const persistor = persistStore(store, persistOptions);

/** Surface root/security read failures to the startup retry gate before allowing Redux or consumers to run. */
export async function initializeReduxPersistence(): Promise<void> {
  preparedReduxState = await readReduxState(reduxPersistConfig);
  persistor.persist();
}

epicMiddleware.run(rootEpic);

const dispatch = store.dispatch.bind(store);

export { store, persistor, dispatch };

export { useSelector } from './root-state.selector';
