import type { Action } from 'redux';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
import { catchError } from 'rxjs/operators';

import type { RootState } from './root-state.type';
// import { swapEpics } from './swap/epics';

const allEpics = combineEpics<Action, Action, RootState>();
// const allEpics = combineEpics(swapEpics);

export const epicMiddleware = createEpicMiddleware<Action, Action, RootState>();

export const rootEpic: typeof allEpics = (action$, store$, dependencies) =>
  allEpics(action$, store$, dependencies).pipe(
    catchError((error, source) => {
      console.error(error);

      return source;
    })
  );
