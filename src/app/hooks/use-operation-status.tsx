import { useEffect } from 'react';

import type { WalletOperation } from '@mavrykdynamics/taquito';
import { BatchWalletOperation } from '@mavrykdynamics/taquito/dist/types/wallet/batch-operation';

import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { navigate } from 'lib/woozie';

export const useOperationStatus = (
  operation: WalletOperation | BatchWalletOperation | null,
  navigateProps: SuccessStateType
) => {
  useEffect(() => {
    if (operation) {
      navigate<SuccessStateType>('/success', undefined, {
        ...navigateProps
      });
    }
  }, [navigateProps, operation]);
};
