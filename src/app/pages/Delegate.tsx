import React, { memo } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { ErrorBoundaryContent } from 'app/ErrorBoundary';
import { ReactComponent as DiamondIcon } from 'app/icons/diamond.svg';
import PageLayout from 'app/layouts/PageLayout';
import DelegateForm from 'app/templates/DelegateForm';
import { SpinnerSection } from 'app/templates/SendForm/SpinnerSection';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { T } from 'lib/i18n';
import { useAccount } from 'lib/temple/front';
import { ZERO } from 'lib/utils/numbers';

const Delegate = memo(() => {
  const { publicKeyHash } = useAccount();
  const { popup } = useAppEnv();

  const gasBalance = useBalance(MAV_TOKEN_SLUG, publicKeyHash);

  const isLoading = !gasBalance.value && gasBalance.isSyncing;

  return (
    <PageLayout
      pageTitle={
        <>
          <DiamondIcon className="mr-1 h-4 w-auto stroke-current" /> <T id="delegate" />
        </>
      }
    >
      {isLoading ? (
        <SpinnerSection />
      ) : gasBalance.error ? (
        <ErrorBoundaryContent errorMessage={String(gasBalance.error)} onTryAgainClick={gasBalance.refresh} />
      ) : (
        <div className="py-4">
          <div className={clsx('w-full mx-auto', popup ? 'max-w-sm' : 'max-w-screen-xxs')}>
            <DelegateForm balance={gasBalance.value ?? ZERO} />
          </div>
        </div>
      )}
    </PageLayout>
  );
});

export default Delegate;
