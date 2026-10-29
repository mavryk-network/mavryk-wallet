import { catchError, from, map, of } from 'rxjs';

import { ABTestGroup } from '../ab-test-group.enum';

import { templeWalletApi } from './templewallet.api';

export { ABTestGroup } from '../ab-test-group.enum';

interface GetABGroupResponse {
  ab: ABTestGroup.A | ABTestGroup.B;
}

export const getABGroup$ = () =>
  from(templeWalletApi.get<GetABGroupResponse>('/abtest')).pipe(
    map(response => response.data.ab),
    catchError(() => of(ABTestGroup.Unknown))
  );
