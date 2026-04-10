import { useEffect, useRef } from 'react';

import { Estimate } from '@mavrykdynamics/webmavryk';

/**
 * Manages the cached delegation estimation ref.
 * Clears whenever the resolved delegate address or network changes
 * so stale estimations are never used across address/network boundaries.
 */
export function useEstimationRef(toResolved: string | undefined, tezosChecksum: string) {
  const estimationRef = useRef<Estimate | null>(null);

  useEffect(() => {
    estimationRef.current = null;
  }, [toResolved, tezosChecksum]);

  return estimationRef;
}
