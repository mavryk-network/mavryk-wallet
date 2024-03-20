import React, { FC, useEffect } from 'react';

import classNames from 'clsx';
import Modal from 'react-modal';

import './customPopup.css';
import { merge } from 'lib/utils/merge';

export type CustomPopupProps = Modal.Props & React.PropsWithChildren;

const CustomPopup: FC<CustomPopupProps> = props => {
  const { className, overlayClassName, ...restProps } = props;

  useEffect(() => {
    if (props.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [props.isOpen]);

  return (
    <Modal
      {...restProps}
      className={merge('bg-primary-card rounded z-30 shadow-2xl pt-6 pb-8', className as string)}
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
