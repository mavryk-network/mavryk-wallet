import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

import CustomPopup, { CustomPopupProps } from 'app/atoms/CustomPopup';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import { t } from 'lib/i18n';
import { useTippyById } from 'lib/ui/useTippy';

import styles from './PopupModalWithTitle.module.css';

const tippyProps = {
  trigger: 'mouseenter',
  hideOnClick: true,
  content: t('close'),
  animation: 'shift-away-subtle'
};
export interface PopupModalWithTitlePropsProps extends CustomPopupProps {
  title?: ReactNode;
  headerComponent?: JSX.Element;
  leftSidedComponent?: JSX.Element;
}

export const PopupModalWithTitle: FC<PopupModalWithTitlePropsProps> = ({
  title,
  children,
  className,
  headerComponent,
  leftSidedComponent,
  ...restProps
}) => {
  const handleMouseEnter = useTippyById('#close-icon', tippyProps);

  return (
    <CustomPopup
      {...restProps}
      className={classNames(
        'w-full max-w-md relative rounded-tl-2xl-plus rounded-tr-2xl-plus bg-primary-card',
        className
      )}
      shouldCloseOnEsc
    >
      <>
        {headerComponent && <div className={styles.headerComponent}>{headerComponent}</div>}
        <div className={classNames('w-full max-h-500', styles.container)}>
          <div className="absolute top-4 px-4 w-full flex justify-end items-cente">
            <button onMouseEnter={handleMouseEnter} id="close-icon" className=" ">
              <CloseIcon className="w-6 h-auto cursor-pointer stroke stroke-1" onClick={restProps.onRequestClose} />
            </button>
          </div>
          <div
            className={classNames(
              leftSidedComponent ? styles.headerContent : 'flex items-center justify-center',
              'mb-4 px-4'
            )}
          >
            {leftSidedComponent}
            {title && (
              <div className={classNames('text-white text-center text-xl px-4 bg-primary-card', styles.middle)}>
                {title}
              </div>
            )}
          </div>
          <div className="h-full no-scrollbar">{children}</div>
        </div>
      </>
    </CustomPopup>
  );
};
