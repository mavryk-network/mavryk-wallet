import React, { FC } from 'react';

import { usePrivacyMode } from 'lib/store/zustand/ui.store';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const PrivacyAmount: FC<Props> = ({ children, className }) => {
  const privacyMode = usePrivacyMode();

  if (privacyMode) {
    return (
      <span className={className} aria-label="Hidden balance">
        ••••
      </span>
    );
  }

  return <span className={className}>{children}</span>;
};
