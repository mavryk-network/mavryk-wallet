import { useMemo } from 'react';

import { MAVEN_METADATA } from 'lib/metadata';
import type { AssetMetadataBase } from 'lib/metadata';
import { atomsToTokens } from 'lib/temple/helpers';

/**
 * Converts an atoms value to token units using the given metadata's decimals,
 * falling back to MAVEN_METADATA.decimals when metadata is undefined.
 */
export function useTokenAmount(atoms: string | number | undefined, metadata: AssetMetadataBase | undefined) {
  return useMemo(
    () => atomsToTokens(atoms ?? 0, metadata?.decimals ?? MAVEN_METADATA.decimals),
    [atoms, metadata?.decimals]
  );
}
