import { useEffect } from 'react';

import { getKYCStatus } from 'lib/temple/back/vault/misc';
import { useTempleClient } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

export const useInitialKYC = (acc: TempleAccount) => {
  const { updateAccountKYCStatus } = useTempleClient();
  useEffect(() => {
    (async function () {
      const isKYC = await getKYCStatus(acc.publicKeyHash);

      await updateAccountKYCStatus(acc.publicKeyHash, isKYC);
    })();
  }, [acc.publicKeyHash]);
};
