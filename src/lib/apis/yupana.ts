import { of } from 'rxjs';

// TODO: Update YUPANA_API URL when new endpoint is known — preproduction-api.yupana.finance is deprecated (connection refused)
// All network calls disabled until the URL is updated.

type YupanaSymbol = 'WTEZ' | 'CTEZ' | 'KUSD' | 'UUSD' | 'TZBTC' | 'UBTC' | 'USDT' | 'SIRS' | 'MVK';

export const fetchApyFromYupana$ = (_symbol: YupanaSymbol) => {
  return of(0);
};

export const fetchApyFromYupana = async (_symbol: YupanaSymbol): Promise<number> => {
  return 0;
};
