import React from 'react';

import clsx from 'clsx';

import { setTestID, TestIDProps } from 'lib/analytics';
import { T } from 'lib/i18n';

interface Props extends TestIDProps {
  singleRow?: boolean;
  onClick: () => void;
}

export const SecretCover: React.FC<Props> = ({ onClick, singleRow, testID }) => (
  <div
    className={clsx(
      'flex flex-col items-center justify-center rounded-md bg-primary-card cursor-pointer',
      'absolute top-2px left-2px right-2px bottom-2px'
    )}
    onClick={onClick}
    {...setTestID(testID)}
  >
    {singleRow ? (
      <p className="flex items-center text-white text-sm">
        {/* <LockAltIcon className="mr-1 h-4 w-auto stroke-current stroke-2" /> */}
        <span>
          <T id="clickToReveal" />
        </span>
      </p>
    ) : (
      <>
        <p className="flex items-center mb-1 text-white text-xl font-normal leading-5 tracking-tight">
          {/* <LockAltIcon className="-ml-2 mr-1 h-6 w-auto stroke-current stroke-2" /> */}
          <span>
            <T id="protectedFormField" />!
          </span>
        </p>

        <p className="mb-1 flex items-center text-secondary-white text-base-plus">
          <span>
            <T id="clickToRevealField" />
          </span>
        </p>
      </>
    )}
  </div>
);
