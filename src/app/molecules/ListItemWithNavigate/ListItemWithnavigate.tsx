import React, { FC } from 'react';

import classNames from 'clsx';

import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { T, TID } from 'lib/i18n';
import { Link } from 'lib/woozie';

export type ListItemWithnavigateprops = {
  Icon: ImportedSVGComponent | null;
  linkTo: string | null;
  i18nKey: TID;
  onClick: () => void;
  className?: string;
  fillIcon?: boolean;
};

export const ListItemWithnavigate: FC<ListItemWithnavigateprops> = ({
  Icon,
  i18nKey,
  onClick,
  linkTo,
  className,
  fillIcon = true
}) => {
  const baseProps = {
    className: classNames(
      'py-4 px-4 flex items-center justify-between border-b border-divider cursor-pointer hover:bg-primary-card-hover',
      className
    ),
    onClick,
    children: (
      <>
        <div className="flex items-center">
          {Icon && <Icon className={classNames('w-6 h-6 mr-2', fillIcon && 'fill-white')} />}
          <span className="text-base-plus text-white">
            <T id={i18nKey} />
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 fill-white" />
      </>
    )
  };

  return linkTo ? <Link {...baseProps} to={linkTo} /> : <div {...baseProps} />;
};
