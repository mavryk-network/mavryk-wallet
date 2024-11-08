import React, { useEffect } from 'react';

import { getKYCStatus } from 'lib/temple/back/vault/misc';
import { useBlockExplorer, useChainId, useTempleClient } from 'lib/temple/front';
import { DEFAULT_TZKT_API } from 'lib/temple/front/blockexplorer';
import { isKnownChainId, TempleAccount } from 'lib/temple/types';

export const useInitialKYC = (acc: TempleAccount) => {
  const { explorer } = useBlockExplorer();
  const chainId = useChainId();
  const { updateAccountKYCStatus } = useTempleClient();
  useEffect(() => {
    (async function () {
      // run only ones for older accounts without KYC stored in their browser storage
      if (acc.isKYC === undefined && chainId && isKnownChainId(chainId)) {
        const apiUrl = explorer.baseUrls.get(chainId)?.api ?? DEFAULT_TZKT_API;
        const isKYC = await getKYCStatus(apiUrl, acc.publicKeyHash);

        await updateAccountKYCStatus(acc.publicKeyHash, isKYC);
      }
    })();
  }, [acc.isKYC, acc.publicKeyHash, chainId, explorer.baseUrls, updateAccountKYCStatus]);
};
