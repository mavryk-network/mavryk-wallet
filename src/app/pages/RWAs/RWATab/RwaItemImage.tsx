import React, { memo, useMemo, useState } from 'react';

import { isDefined } from '@rnw-community/shared';
import { debounce } from 'lodash';

import { useCollectibleIsAdultSelector } from 'app/store/collectibles/selectors';
import { RwaDetails } from 'app/store/rwas/state';
import { buildCollectibleImagesStack } from 'lib/images-uri';
import type { TokenMetadata } from 'lib/metadata';
import { ImageStacked } from 'lib/ui/ImageStacked';
import { useIntersectionByOffsetObserver } from 'lib/ui/use-intersection-observer';

import { CollectibleBlur } from '../components/CollectibleBlur';
import { RwaImageFallback } from '../components/CollectibleImageFallback';
import { CollectibleImageLoader } from '../components/CollectibleImageLoader';

interface Props {
  assetSlug: string;
  metadata?: TokenMetadata;
  adultBlur: boolean;
  areDetailsLoading: boolean;
  containerElemRef: React.RefObject<Element>;
}
// Need to be present in metadata response, at the moment there is no mime
const isAudioCollectible = false;

export const RwaItemImage = memo<Props>(({ assetSlug, metadata, adultBlur, areDetailsLoading, containerElemRef }) => {
  const isAdultContent = useCollectibleIsAdultSelector(assetSlug);
  const isAdultFlagLoading = areDetailsLoading && !isDefined(isAdultContent);
  const shouldShowBlur = isAdultContent && adultBlur;

  const sources = useMemo(() => (metadata ? buildCollectibleImagesStack(metadata) : []), [metadata]);

  const [isInViewport, setIsInViewport] = useState(false);
  const handleIntersection = useMemo(() => debounce(setIsInViewport, 500), []);

  useIntersectionByOffsetObserver(containerElemRef, handleIntersection, true, 800);

  return (
    <div className={isInViewport ? 'contents' : 'hidden'}>
      {isAdultFlagLoading ? (
        <CollectibleImageLoader />
      ) : shouldShowBlur ? (
        <CollectibleBlur />
      ) : (
        <ImageStacked
          sources={sources}
          loading="lazy"
          className="max-w-full max-h-full object-contain"
          loader={<CollectibleImageLoader />}
          fallback={<RwaImageFallback isAudioCollectible={isAudioCollectible} symbol={metadata?.symbol} />}
        />
      )}
    </div>
  );
});
