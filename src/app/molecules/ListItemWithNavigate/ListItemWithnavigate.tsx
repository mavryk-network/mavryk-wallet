import React, { FC } from 'react';

import classNames from 'clsx';

import { Anchor } from 'app/atoms';
import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { T, TID } from 'lib/i18n';
import { Link } from 'lib/woozie';

import styles from './ListItemWithNavigate.module.css';

export type ListItemWithNavigateprops = {
  Icon: ImportedSVGComponent | null;
  linkTo?: string | null;
  i18nKey: TID;
  onClick?: () => void;
  className?: string;
  hasExternalLink?: boolean;
  fillIcon?: boolean;
  showDivider?: boolean;
  fullWidthDivider?: boolean;
  disabled?: boolean;
  paddingClassName?: string;
};

export const ListItemWithNavigate: FC<ListItemWithNavigateprops> = ({
  Icon,
  i18nKey,
  onClick,
  linkTo,
  className,
  paddingClassName = 'p-4',
  hasExternalLink = false,
  fillIcon = true,
  showDivider = true,
  fullWidthDivider = false,
  disabled = false
}) => {
  const baseProps = {
    className: classNames(
      'flex items-center justify-between cursor-pointer hover:bg-primary-card-hover relative ',
      showDivider && 'hover:outline hover:outline-2 hover:outline-offset-2',
      !fullWidthDivider && (showDivider ? styles.listItemBorder : styles.listItemWithoutDivider),
      showDivider && fullWidthDivider && 'border-b border-divider',
      disabled && 'opacity-50 pointer-events-none',
      className,
      paddingClassName
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

  if (hasExternalLink && linkTo) {
    return <Anchor href={linkTo} {...baseProps} />;
  }

  return linkTo ? <Link {...baseProps} to={linkTo} /> : <div {...baseProps} />;
};

export default ListItemWithNavigate;
