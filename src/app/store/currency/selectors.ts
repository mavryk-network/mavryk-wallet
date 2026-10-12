import { useExchangeRates } from 'app/hooks/use-exchange-rates.query';

export const useUsdToTokenRatesSelector = () => useExchangeRates().usdToTokenRates;
