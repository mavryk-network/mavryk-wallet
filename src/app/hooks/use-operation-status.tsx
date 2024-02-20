import { useEffect } from 'react';

import type { WalletOperation } from '@taquito/taquito';

import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { navigate } from 'lib/woozie';

export const useOperationStatus = (operation: WalletOperation | null, navigateProps: SuccessStateType) => {
  useEffect(() => {
    if (operation) {
      navigate<SuccessStateType>('/success', undefined, {
        ...navigateProps
      });
    }
  }, [navigateProps, operation]);
};
