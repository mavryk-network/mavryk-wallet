import type { Action } from 'redux';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
import { catchError } from 'rxjs/operators';

import { abTestingEpics } from './ab-testing/epics';
import { assetsEpics } from './assets/epics';
import { balancesEpics } from './balances/epics';
import { collectiblesMetadataEpics } from './collectibles-metadata/epics';
// import { partnersPromotionEpics } from './partners-promotion/epics';
import type { RootState } from './root-state.type';
import { rwasMetadataEpics } from './rwas-metadata/epics';
// import { swapEpics } from './swap/epics';
import { tokensMetadataEpics } from './tokens-metadata/epics';

const allEpics = combineEpics(
  // swapEpics,
  // partnersPromotionEpics,
  balancesEpics,
  assetsEpics,
  tokensMetadataEpics,
  rwasMetadataEpics,
  collectiblesMetadataEpics,
  abTestingEpics
);

export const epicMiddleware = createEpicMiddleware<Action, Action, RootState>();

export const rootEpic: typeof allEpics = (action$, store$, dependencies) =>
  allEpics(action$, store$, dependencies).pipe(
    catchError((error, source) => {
      console.error(error);

      return source;
    })
  );
