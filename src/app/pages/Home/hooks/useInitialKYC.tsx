import React, { useEffect } from 'react';

import { getKYCStatus } from 'lib/temple/back/vault/misc';
import { useTempleClient } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

export const useInitialKYC = (acc: TempleAccount) => {
  const { updateAccountKYCStatus } = useTempleClient();
  useEffect(() => {
    (async function () {
      // run only ones for older accounts without KYC stored in their browser storage
      if (acc.isKYC === undefined) {
        const isKYC = await getKYCStatus(acc.publicKeyHash);

        await updateAccountKYCStatus(acc.publicKeyHash, isKYC);
      }
    })();
  }, [acc.isKYC, acc.publicKeyHash, updateAccountKYCStatus]);
};
