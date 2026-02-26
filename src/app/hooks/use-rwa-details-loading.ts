import { isEqual } from 'lodash';

import { useAccountRwas } from 'lib/assets/hooks/rwas';
import { useRwasDetailsQuery } from 'lib/rwas/use-rwas-details.query';
import { useAccount, useChainId } from 'lib/temple/front';
import { useMemoWithCompare } from 'lib/ui/hooks';

export const useRWAsDetailsLoading = () => {
  const chainId = useChainId()!;
  const { publicKeyHash } = useAccount();
  const rwas = useAccountRwas(publicKeyHash, chainId);

  const slugs = useMemoWithCompare(() => rwas.map(({ slug }) => slug).sort(), [rwas], isEqual);

  // TanStack Query handles fetching + refetch interval automatically
  useRwasDetailsQuery(slugs);
};
