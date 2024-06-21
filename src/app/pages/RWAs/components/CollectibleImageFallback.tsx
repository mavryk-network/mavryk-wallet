import React, { memo } from 'react';

import clsx from 'clsx';

import { estimateOptimalFontSize } from 'app/atoms/Identicon';
import { ReactComponent as BrokenImageSvg } from 'app/icons/broken-image.svg';
import { ReactComponent as MusicSvg } from 'app/icons/music.svg';
import NoImageToken from 'app/misc/no-image-token.png';
import NoRWABg from 'app/misc/no-rwa-bg.png';
import { useAppEnv } from 'app/env';

const MAX_INITIALS_LENGTH = 5;

interface Props {
  large?: boolean;
  isAudioCollectible?: boolean;
  symbol: string | undefined;
}
// Token image not found
export const RwaImageFallback = memo<Props>(({ large = false, isAudioCollectible = false, symbol }) => {
  const { popup } = useAppEnv();
  const height = large ? '23%' : '32%';
  const size = large ? (popup ? 222 : 165) : 50;

  return (
    <div className="w-full h-full flex items-center justify-center">
      {isAudioCollectible ? (
        <MusicSvg height={height} />
      ) : symbol ? (
        <div className={clsx('flex flex-col  items-center')}>
          <span
            className={'text-white'}
            style={{
              zIndex: 2,
              fontSize: estimateOptimalFontSize(
                symbol.slice(0, MAX_INITIALS_LENGTH).length,
                large ? (popup ? 64 : 50) : 18
              )
            }}
          >
            {symbol.slice(0, MAX_INITIALS_LENGTH)}
          </span>
          <img src={NoRWABg} alt="rwa fallback" className="absolute inset-0 bg-no-repeat" style={{ zIndex: 0 }} />
          <img
            src={NoImageToken}
            alt="rwa fallback"
            className="absolute bg-no-repeat"
            style={{
              zIndex: 1,
              width: size,
              height: size,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>
      ) : (
        // if both are undefined -> return broken image
        <BrokenImageSvg height={height} /> ?? <BrokenImageSvg height={height} />
      )}
    </div>
  );
});
