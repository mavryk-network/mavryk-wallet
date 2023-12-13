import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

import CustomPopup, { CustomPopupProps } from 'app/atoms/CustomPopup';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';

import styles from './PopupModalWithTitle.module.css';

export interface PopupModalWithTitlePropsProps extends CustomPopupProps {
  title?: ReactNode;
}

export const PopupModalWithTitle: FC<PopupModalWithTitlePropsProps> = ({
  title,
  children,
  className,
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
        <div className={classNames('w-full max-h-500', styles.container)}>
          <CloseIcon className="w-6 h-auto absolute top-4 right-4 cursor-pointer" onClick={restProps.onRequestClose} />
          {title && <div className="text-white mb-6 w-full text-center text-xl">{title}</div>}
          {children}
        </div>
      </>
    </CustomPopup>
  );
};
