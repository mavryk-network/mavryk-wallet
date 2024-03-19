import React, { FC } from 'react';

import { ReactComponent as BrokenImageSvg } from 'app/icons/broken-image.svg';
import { ReactComponent as MusicSvg } from 'app/icons/music.svg';

interface NFTImageFallbackProps {
  large?: boolean;
  isAudioNFT?: boolean;
}

export const NFTImageFallback: FC<NFTImageFallbackProps> = ({ large = false, isAudioNFT = false }) => {
  const height = large ? '23%' : '32%';

  return (
    <div className="w-full h-full flex items-center justify-center">
      {isAudioNFT ? <MusicSvg height={height} /> : <BrokenImageSvg height={height} />}
    </div>
  );
};
