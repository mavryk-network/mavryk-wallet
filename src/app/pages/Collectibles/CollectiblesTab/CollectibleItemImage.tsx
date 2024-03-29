import React, { memo, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
// import { debounce } from 'lodash';

import { useCollectibleIsAdultSelector } from 'app/store/collectibles/selectors';
// import { buildCollectibleImagesStack } from 'lib/images-uri';
import { AssetImage } from 'app/templates/AssetImage';
import type { TokenMetadata } from 'lib/metadata';
// import { ImageStacked } from 'lib/ui/ImageStacked';
// import { useIntersectionByOffsetObserver } from 'lib/ui/use-intersection-observer';

import { CollectibleBlur } from '../components/CollectibleBlur';
import { CollectibleImageFallback } from '../components/CollectibleImageFallback';
import { CollectibleImageLoader } from '../components/CollectibleImageLoader';

interface Props {
  assetSlug: string;
  metadata?: TokenMetadata;
  adultBlur?: boolean;
  areDetailsLoading: boolean;
  mime?: string | null;
  containerElemRef?: React.RefObject<Element>;
}

export const CollectibleItemImage = memo<Props>(({ assetSlug, metadata, areDetailsLoading, mime }) => {
  const isAdultContent = useCollectibleIsAdultSelector(assetSlug);
  const isAdultFlagLoading = areDetailsLoading && !isDefined(isAdultContent);
  // const shouldShowBlur = isAdultContent && adultBlur;

  // const sources = useMemo(() => (metadata ? buildCollectibleImagesStack(metadata) : []), [metadata]);

  const isAudioCollectible = useMemo(() => Boolean(mime && mime.startsWith('audio')), [mime]);

  // const [isInViewport, setIsInViewport] = useState(false);
  // const handleIntersection = useMemo(() => debounce(setIsInViewport, 500), []);

  // useIntersectionByOffsetObserver(containerElemRef, handleIntersection, true, 800);

  if (isAdultFlagLoading) {
    return <CollectibleImageLoader />;
  }

  if (isAdultContent) {
    return <CollectibleBlur />;
  }

  return (
    <AssetImage
      metadata={metadata}
      loader={<CollectibleImageLoader />}
      fallback={<CollectibleImageFallback isAudioCollectible={isAudioCollectible} />}
    />
  );
});
