import React, { FC } from 'react';

import { Identicon } from 'app/atoms';

interface BakerLogoProps {
  logo?: string | FC<{ className?: string; style?: React.CSSProperties }>;
  address: string;
  size: number;
  className?: string;
  style?: React.CSSProperties;
  /** Background class for the `<img>` branch only. Defaults to `'bg-white'`. */
  imgBg?: string;
}

function isSafeLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Renders a baker's logo as either an <img> (URL string), an SVG component,
 * or falls back to an Identicon. Shared across BakerBanner, DelegateTag,
 * DelegationOperations, and BakingHistoryItem.
 */
export const BakerLogo: FC<BakerLogoProps> = ({ logo, address, size, className, style, imgBg = 'bg-white' }) => {
  if (!logo) {
    return <Identicon type="bottts" hash={address} size={size} className={`rounded-full ${className ?? ''}`} />;
  }

  if (typeof logo === 'string') {
    if (!isSafeLogoUrl(logo)) {
      return <Identicon type="bottts" hash={address} size={size} className={`rounded-full ${className ?? ''}`} />;
    }

    return (
      <img
        src={logo}
        alt={address}
        className={`flex-shrink-0 ${imgBg} rounded-full ${className ?? ''}`}
        style={{ width: size, height: size, ...style }}
      />
    );
  }

  const SvgLogo = logo;
  return (
    <SvgLogo
      className={`flex-shrink-0 bg-transparent rounded-full ${className ?? ''}`}
      style={{ width: size, height: size, ...style }}
    />
  );
};
