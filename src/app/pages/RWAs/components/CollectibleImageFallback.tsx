import React, { memo } from 'react';

import clsx from 'clsx';

import { ReactComponent as BrokenImageSvg } from 'app/icons/broken-image.svg';
import { ReactComponent as MusicSvg } from 'app/icons/music.svg';

interface Props {
  large?: boolean;
  isAudioCollectible?: boolean;
  symbol: string | undefined;
}
// Token image not found
export const RwaImageFallback = memo<Props>(({ large = false, isAudioCollectible = false, symbol }) => {
  const height = large ? '23%' : '32%';

  return (
    <div className="w-full h-full flex items-center justify-center">
      {isAudioCollectible ? (
        <MusicSvg height={height} />
      ) : symbol ? (
        <span
          className={clsx(
            'flex flex-col  items-center',
            large ? 'text-body text-white' : 'text-xxxs text-primary-bg text-center'
          )}
        >
          <span>{symbol}</span>
          <span>Token image not found</span>
        </span>
      ) : (
        // if both are undefined -> return broken image
        <BrokenImageSvg height={height} /> ?? <BrokenImageSvg height={height} />
      )}
    </div>
  );
});
