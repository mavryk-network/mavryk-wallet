import React, { CSSProperties, FC, HTMLAttributes, useMemo } from 'react';

import Avatars from '@dicebear/avatars';
import botttsSprites from '@dicebear/avatars-bottts-sprites';
import jdenticonSpirtes from '@dicebear/avatars-jdenticon-sprites';
import classNames from 'clsx';

import NoTokenIcon from 'app/misc/no-image-token.png';
import initialsSprites from 'lib/avatars-initials-sprites';

export type IdeniconType = 'jdenticon' | 'bottts' | 'initials';

type IdenticonProps = HTMLAttributes<HTMLDivElement> & {
  type?: IdeniconType;
  hash: string;
  size?: number;
  isToken?: boolean;
};

const MAX_INITIALS_LENGTH = 5;
const DEFAULT_FONT_SIZE = 50;

const cache = new Map<string, string>();

const icons: Record<NonNullable<IdenticonProps['type']>, Avatars<{}>> = {
  jdenticon: new Avatars(jdenticonSpirtes),
  bottts: new Avatars(botttsSprites),
  initials: new Avatars(initialsSprites)
};

const Identicon: FC<IdenticonProps> = ({
  type = 'jdenticon',
  hash,
  size = 100,
  className,
  style = {},
  isToken = true,
  ...rest
}) => {
  const backgroundImage = useMemo(() => {
    const key = `${type}_${hash}_${size}`;
    if (cache.has(key)) {
      return cache.get(key);
    } else {
      const basicOpts = {
        base64: true,
        width: size,
        height: size,
        margin: 4
      };

      const opts =
        type === 'initials'
          ? {
              ...basicOpts,
              chars: MAX_INITIALS_LENGTH,
              radius: 50,
              fontSize: estimateOptimalFontSize(hash.slice(0, MAX_INITIALS_LENGTH).length)
            }
          : basicOpts;
      const additionalOpts = isToken ? { background: 'transparent' } : {};
      const imgSrc = icons[type].create(hash, { ...opts, ...additionalOpts });

      const bi = `url('${imgSrc}')`;
      cache.set(key, bi);
      return bi;
    }
  }, [type, hash, size, isToken]);

  return (
    <RenderIcon
      addWrapper={isToken && type === 'initials'}
      className={classNames('relative', 'bg-transparent', 'bg-no-repeat bg-center', 'overflow-hidden', className)}
      style={{
        width: size,
        height: size,
        maxWidth: size,
        ...style
      }}
    >
      <div
        className={classNames(
          'inline-block relative',
          type === 'initials' ? 'bg-transparent' : 'bg-gray-100',
          'bg-no-repeat bg-center',
          'overflow-hidden',
          className
        )}
        style={{
          backgroundImage,
          width: size,
          height: size,
          maxWidth: size,
          zIndex: isToken ? 1 : 0,
          ...style
        }}
        {...rest}
      />
      {isToken && type === 'initials' && (
        <div className="absolute inset-0 rounded-full">
          <img style={{ objectFit: 'contain' }} src={NoTokenIcon} className=" w-full h-full" alt="no token" />
        </div>
      )}
    </RenderIcon>
  );
};

export default Identicon;

export function estimateOptimalFontSize(length: number, defaultFontSize = DEFAULT_FONT_SIZE) {
  const initialsLength = Math.min(length, MAX_INITIALS_LENGTH);
  if (initialsLength > 2) {
    const n = initialsLength;
    const multiplier = Math.sqrt(10000 / ((32 * n + 4 * (n - 1)) ** 2 + 36 ** 2));
    return Math.floor(defaultFontSize * multiplier);
  }
  return defaultFontSize;
}

const RenderIcon: FC<PropsWithChildren & { addWrapper: boolean; className: string; style: CSSProperties }> = ({
  addWrapper,
  children,
  className,
  style
}) => {
  return addWrapper ? (
    <div style={style} className={className}>
      {children}
    </div>
  ) : (
    <>{children}</>
  );
};
