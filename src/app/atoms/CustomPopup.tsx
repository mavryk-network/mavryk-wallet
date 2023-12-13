import React, { FC } from 'react';

import classNames from 'clsx';
import Modal from 'react-modal';

export type CustomPopupProps = Modal.Props & React.PropsWithChildren;

const CustomPopup: FC<CustomPopupProps> = props => {
  const { className, overlayClassName, ...restProps } = props;

  return (
    <Modal
      {...restProps}
      className={classNames('bg-primary-card rounded z-30 shadow-2xl px-4 pt-6 pb-8', className)}
      appElement={document.getElementById('root')!}
      closeTimeoutMS={200}
      overlayClassName={classNames(
        'fixed inset-0 z-30',
        'bg-primary-bg bg-opacity-60',
        'flex items-end justify-center',
        overlayClassName
      )}
      onAfterOpen={() => {
        document.body.classList.add('overscroll-y-none');
      }}
      onAfterClose={() => {
        document.body.classList.remove('overscroll-y-none');
      }}
    />
  );
};

export default CustomPopup;
