import React, { FC } from 'react';

import classNames from 'clsx';

import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { T, TID } from 'lib/i18n';
import { Link } from 'lib/woozie';

export type ListItemWithnavigateprops = {
  Icon: ImportedSVGComponent;
  linkTo: string | null;
  i18nKey: TID;
  onClick: () => void;
  className?: string;
};

export const ListItemWithnavigate: FC<ListItemWithnavigateprops> = ({ Icon, i18nKey, onClick, linkTo, className }) => {
  const baseProps = {
    className: classNames(
      'py-4 px-4 flex items-center justify-between border-b border-divider cursor-pointer hover:bg-primary-card-hover',
      className
    ),
    onClick,
    children: (
      <>
        <div className="flex items-center">
          <Icon className="w-6 h-6 fill-white mr-2" />
          <span className="text-base-plus">
            <T id={i18nKey} />
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 fill-white" />
      </>
    )
  };

  return linkTo ? <Link {...baseProps} to={linkTo} /> : <div {...baseProps} />;
};
