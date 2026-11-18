import { useExchangeRatesQuery } from './use-exchange-rates.query';

export const useLongRefreshLoading = () => {
  useExchangeRatesQuery(true);
};
