import React, { FC, Suspense, useEffect } from 'react';

import clsx from 'clsx';
import { useDispatch } from 'react-redux';

import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { resetSwapParamsAction } from 'app/store/swap/actions';
import { SwapForm } from 'app/templates/SwapForm/SwapForm';
import { t, T } from 'lib/i18n';
import { useNetwork } from 'lib/temple/front';

export const Swap: FC = () => {
  const { popup } = useAppEnv();
  const dispatch = useDispatch();

  const network = useNetwork();

  useEffect(() => {
    dispatch(resetSwapParamsAction());
  }, []);

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<>{t('swap')}</>}>
      <div>
        <div className={clsx('w-full mx-auto', popup ? 'max-w-sm' : 'max-w-screen-xxs')}>
          <Suspense fallback={null}>
            {network.type === 'main' ? (
              <>
                <SwapForm />
              </>
            ) : (
              <p className="text-center text-base-plus text-white">
                <T id="noExchangersAvailable" />
              </p>
            )}
          </Suspense>
        </div>
      </div>
    </PageLayout>
  );
};
