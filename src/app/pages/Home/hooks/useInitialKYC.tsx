import { useEffect } from 'react';

import { getKYCStatus } from 'lib/temple/back/vault/misc';
import { useNetwork, useTempleClient } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

export const useInitialKYC = (acc: TempleAccount) => {
  const { updateAccountKYCStatus } = useTempleClient();
  const { rpcBaseURL: rpcUrl } = useNetwork();
  useEffect(() => {
    (async function () {
      const isKYC = await getKYCStatus(acc.publicKeyHash, rpcUrl);

      await updateAccountKYCStatus(acc.publicKeyHash, isKYC);
    })();
  }, [acc.publicKeyHash, rpcUrl]);
};
