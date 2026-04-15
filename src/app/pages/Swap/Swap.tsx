import React, { FC, Suspense, useEffect } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { SwapForm } from 'app/templates/SwapForm/SwapForm';
import { t, T } from 'lib/i18n';
import { useResetSwapParams } from 'lib/swap/use-swap.query';
import { useNetwork } from 'lib/temple/front';

export const Swap: FC = () => {
  const { popup } = useAppEnv();

  const network = useNetwork();
  const resetSwapParams = useResetSwapParams();

  useEffect(() => {
    resetSwapParams();
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
