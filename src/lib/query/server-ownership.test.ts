import { readFileSync } from 'fs';
import { resolve } from 'path';

import { loadAllCurrenciesActions } from 'app/store/buy-with-credit-card/actions';
import { buyWithCreditCardReducer } from 'app/store/buy-with-credit-card/reducers';
import { loadExchangeRates } from 'app/store/currency/actions';
import { currencyReducer } from 'app/store/currency/reducers';

const source = (path: string) => readFileSync(resolve(process.cwd(), 'src', path), 'utf8');

it('has no legacy rate/card/list fetchers registered alongside Query', () => {
  const root = source('app/store/root-state.epics.ts');
  expect(root).not.toMatch(
    /currencyEpics|buyWithCreditCardEpics|notificationsEpics|advertisingEpics|partnersPromotionEpics/
  );
  expect(source('app/store/swap/epics.ts')).not.toMatch(/loadSwapTokens|loadSwapDexes/);
  expect(source('app/WithDataLoading.tsx')).not.toMatch(/loadSwapTokens|loadSwapDexes|useAdvertisingLoading/);
  expect(source('app/hooks/use-long-refresh-loading.hook.ts')).not.toMatch(/dispatch/);
});

it('keeps old fetched actions inert and Query functions free of store mirrors', () => {
  const currency = currencyReducer(undefined, { type: 'init' });
  expect(
    currencyReducer(currency, loadExchangeRates.success({ usdToTokenRates: { mav: '99' }, fiatToTezosRates: {} }))
  ).toBe(currency);
  expect(source('app/pages/BuyWithCreditCard/hooks/use-one-payment-provider.ts')).not.toMatch(
    /getUpdatedFiatLimits|setOutputAmount|setOutputError/
  );
  const cards = buyWithCreditCardReducer(undefined, { type: 'init' });
  expect(buyWithCreditCardReducer(cards, loadAllCurrenciesActions.submit())).toBe(cards);
  for (const path of [
    'app/hooks/use-exchange-rates.query.ts',
    'lib/buy-with-credit-card/use-buy-with-credit-card.query.ts',
    'lib/buy-with-credit-card/use-card-output.query.ts',
    'lib/notifications/hooks/use-notifications.query.ts',
    'lib/swap/use-swap.query.ts',
    'app/hooks/use-advertising-promotion.query.ts',
    'app/hooks/use-partners-promo.query.ts'
  ]) {
    expect(source(path)).not.toMatch(/dispatch\(|updateOwnedUI\(|putToStorage\(|\.setState\(/);
  }
});
