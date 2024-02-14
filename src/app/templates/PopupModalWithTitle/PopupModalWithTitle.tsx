import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

import CustomPopup, { CustomPopupProps } from 'app/atoms/CustomPopup';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';

import styles from './PopupModalWithTitle.module.css';

export interface PopupModalWithTitlePropsProps extends CustomPopupProps {
  title?: ReactNode;
  headerComponent?: JSX.Element;
}

export const PopupModalWithTitle: FC<PopupModalWithTitlePropsProps> = ({
  title,
  children,
  className,
  headerComponent,
  ...restProps
}) => {
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
          <CloseIcon
            className="w-6 h-auto absolute top-4 right-4 cursor-pointer stroke stroke-1"
            onClick={restProps.onRequestClose}
          />
          {title && (
            <div
              className={classNames(
                'text-white mb-4 w-auto mx-auto text-center text-xl px-4 bg-primary-card flex flex-col items-center',
                headerComponent && 'mt-2'
              )}
            >
              {title}
            </div>
          )}
          <div className="h-full no-scrollbar">{children}</div>
        </div>
      </>
    </CustomPopup>
  );
};
