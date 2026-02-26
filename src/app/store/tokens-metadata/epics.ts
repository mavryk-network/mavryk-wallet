import { combineEpics, Epic } from 'redux-observable';
import { ignoreElements, tap } from 'rxjs/operators';
import { ofType, toPayload } from 'ts-action-operators';

import { metadataStore } from 'lib/store/zustand/metadata.store';

import { loadTokensWhitelistActions } from '../assets/actions';

/**
 * Bridge epic: forwards whitelist data from the assets Redux slice
 * to the Zustand metadata store. Will be removed when the assets
 * slice is migrated.
 */
const addWhitelistMetadataBridgeEpic: Epic = action$ =>
  action$.pipe(
    ofType(loadTokensWhitelistActions.success),
    toPayload(),
    tap(payload => {
      metadataStore.getState().addWhitelistTokensMetadata(payload);
    }),
    ignoreElements()
  );

export const tokensMetadataEpics = combineEpics(addWhitelistMetadataBridgeEpic);
