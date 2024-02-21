import React, { FC } from 'react';

import classNames from 'clsx';

import { T } from 'lib/i18n';

interface Props {
  disabled: boolean;
  percentage: number;
  onClick: (percentage: number) => void;
}

export const PercentageButton: FC<Props> = ({ percentage, onClick, disabled }) => {
  const handleClick = () => onClick(percentage);

  return (
    <button
      disabled={disabled}
      type="button"
      className={classNames(
        'border border-divider text-secondary-white rounded-md ml-1',
        'text-xs p-0.5 flex justify-center items-center'
      )}
      onClick={handleClick}
    >
      {percentage === 100 ? <T id="max" /> : `${percentage}%`}
    </button>
  );
};
