import { createActions } from 'lib/store';

import { ExchangeRateRecord } from './state';

export interface ExchangeRateInterface {
  usdToTokenRates: ExchangeRateRecord;
  fiatToTezosRates: ExchangeRateRecord<number>;
}

export const loadExchangeRates = createActions<void, ExchangeRateInterface, string>('currency/LOAD_EXCHANGE_RATES');
