import React, { memo, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';

import { useCollectibleIsAdultSelector } from 'app/store/collectibles/selectors';
import { AssetImage } from 'app/templates/AssetImage';
import type { TokenMetadata } from 'lib/metadata';

import { CollectibleBlur } from '../components/CollectibleBlur';
import { NFTImageFallback } from '../components/NFTImageFallback';
import { NFTImageLoader } from '../components/NFTImageLoader';

interface Props {
  assetSlug: string;
  metadata?: TokenMetadata;
  areDetailsLoading: boolean;
  mime?: string | null;
}

export const NFTItemImage = memo<Props>(({ assetSlug, metadata, areDetailsLoading, mime }) => {
  const isAdultContent = useCollectibleIsAdultSelector(assetSlug);
  const isAdultFlagLoading = areDetailsLoading && !isDefined(isAdultContent);

  const isAudioNFT = useMemo(() => Boolean(mime && mime.startsWith('audio')), [mime]);

  if (isAdultFlagLoading) {
    return <NFTImageLoader />;
  }

  if (isAdultContent) {
    return <CollectibleBlur />;
  }

  return (
    <AssetImage
      metadata={metadata}
      loader={<NFTImageLoader />}
      fallback={<NFTImageFallback isAudioNFT={isAudioNFT} />}
    />
  );
});
