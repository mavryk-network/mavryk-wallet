import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

import CustomPopup, { CustomPopupProps } from 'app/atoms/CustomPopup';

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
      className={classNames('w-full max-w-md rounded-tl-2xl-plus rounded-tr-2xl-plus bg-primary-card', className)}
      shouldCloseOnEsc
    >
      <>
        <div className={classNames('w-full max-h-500', styles.container)}>
          {title && <div className="text-white mb-6 w-full text-center text-xl">{title}</div>}
          {children}
        </div>
      </>
    </CustomPopup>
  );
};
