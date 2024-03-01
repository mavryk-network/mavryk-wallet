import React, { FC } from 'react';

import classNames from 'clsx';

import { T } from 'lib/i18n';

interface Props {
  disabled: boolean;
  percentage: number;
  selectedPercentage: number;
  onClick: (percentage: number) => void;
}

export const PercentageButton: FC<Props> = ({ percentage, selectedPercentage, onClick, disabled }) => {
  const handleClick = () => onClick(percentage);

  return (
    <button
      disabled={disabled}
      type="button"
      className={classNames(
        'border rounded-md ml-1',
        'transition duration-200 ease-in-out',
        'text-xs p-0.5 flex justify-center items-center',
        percentage === selectedPercentage ? 'border-accent-blue text-white' : 'border-divider text-secondary-white '
      )}
      onClick={handleClick}
    >
      {percentage === 100 ? <T id="max" /> : `${percentage}%`}
    </button>
  );
};
