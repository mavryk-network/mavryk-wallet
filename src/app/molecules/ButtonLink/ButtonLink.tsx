import React from 'react';

import { Link } from 'lib/woozie';

export interface ActionButtonProps {
  linkTo: string;
  state?: any;
  onClick?: () => void;
  testID: string;
  children: React.ReactNode;
  replace?: boolean;
}

/**
 * Wrap your component (in most cases button | label) with this Link component to be able to use router logic
 * @example
 *     <ButtonLink {...action}>
          <ButtonRounded size="big" fill={false} className="mx-auto mt-4" onClick={handleButtonClick}>
            <T id="addRestoreAccount" />
          </ButtonRounded>
        </ButtonLink>
 */
export const ButtonLink: React.FC<ActionButtonProps> = ({
  children,
  state,
  linkTo,
  onClick,
  testID,
  replace = false
}) => {
  const baseProps = {
    testID,
    onClick,
    children,
    state,
    replace
  };

  return <Link className="w-full" {...baseProps} to={linkTo} />;
};
