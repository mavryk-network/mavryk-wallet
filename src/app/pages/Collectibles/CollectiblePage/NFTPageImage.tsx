import React, { memo, useCallback, useEffect, useState } from 'react';

import { Model3DViewer } from 'app/atoms/Model3DViewer';
import { AssetImage } from 'app/templates/AssetImage';
import { TokenMetadata } from 'lib/metadata';
import { isSvgDataUriInUtf8Encoding, buildObjktCollectibleArtifactUri } from 'lib/temple/front';
import { Image } from 'lib/ui/Image';

import { AudioNFT } from '../components/AudioNFT';
import { CollectibleBlur } from '../components/CollectibleBlur';
import { NFTImageFallback } from '../components/NFTImageFallback';
import { NFTImageLoader } from '../components/NFTImageLoader';
import { VideoCollectible } from '../components/VideoCollectible';

interface Props {
  metadata?: TokenMetadata;
  areDetailsLoading: boolean;
  mime?: string | null;
  objktArtifactUri?: string;
  isAdultContent?: boolean;
  className?: string;
}

export const NFTPageImage = memo<Props>(
  ({ metadata, mime, objktArtifactUri, className, areDetailsLoading, isAdultContent = false }) => {
    const [isRenderFailedOnce, setIsRenderFailedOnce] = useState(false);

    const [shouldShowBlur, setShouldShowBlur] = useState(isAdultContent);
    useEffect(() => setShouldShowBlur(isAdultContent), [isAdultContent]);

    const handleBlurClick = useCallback(() => setShouldShowBlur(false), []);

    const handleError = useCallback(() => setIsRenderFailedOnce(true), []);

    if (areDetailsLoading) {
      return <NFTImageLoader large />;
    }

    if (shouldShowBlur) {
      return <CollectibleBlur onClick={handleBlurClick} />;
    }

    if (objktArtifactUri && !isRenderFailedOnce) {
      if (isSvgDataUriInUtf8Encoding(objktArtifactUri)) {
        return (
          <Image
            src={objktArtifactUri}
            alt={metadata?.name}
            loader={<NFTImageLoader large />}
            onError={handleError}
            className={className}
          />
        );
      }

      if (mime) {
        if (mime.startsWith('model')) {
          return (
            <Model3DViewer
              uri={buildObjktCollectibleArtifactUri(objktArtifactUri)}
              alt={metadata?.name}
              onError={handleError}
            />
          );
        }

        if (mime.startsWith('video')) {
          return (
            <VideoCollectible
              uri={buildObjktCollectibleArtifactUri(objktArtifactUri)}
              loader={<NFTImageLoader large />}
              className={className}
              onError={handleError}
            />
          );
        }

        if (mime.startsWith('audio')) {
          return (
            <AudioNFT
              uri={buildObjktCollectibleArtifactUri(objktArtifactUri)}
              metadata={metadata}
              loader={<NFTImageLoader large />}
              className={className}
              onAudioError={handleError}
            />
          );
        }
      }
    }

    return (
      <AssetImage
        metadata={metadata}
        fullViewCollectible
        loader={<NFTImageLoader large />}
        fallback={<NFTImageFallback large />}
        className={className}
      />
    );
  }
);
