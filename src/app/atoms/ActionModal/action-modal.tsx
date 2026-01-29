import React, { ReactNode, memo } from 'react';

import clsx from 'clsx';

import { Button } from 'app/atoms';
import CustomModal from 'app/atoms/CustomModal';
import { useAppEnv } from 'app/env';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import {
  FULL_PAGE_LAYOUT_CONTAINER_CLASSNAME,
  FULL_PAGE_WRAP_OVERLAY_CLASSNAME,
  LAYOUT_CONTAINER_CLASSNAME
} from 'app/layouts/containers';

import { IconBase } from '../IconBase';

import actionModalStyles from './action-modal.module.css';

export interface ActionModalProps {
  hasHeader?: boolean;
  hasCloseButton?: boolean;
  onClose?: EmptyFn;
  children?: ReactNode;
  title?: ReactNode;
  headerClassName?: string;
  contentClassName?: string;
  className?: string;
  closeButtonTestID?: string;
}

export const ActionModal = memo<ActionModalProps>(
  ({
    onClose,
    children,
    hasHeader = true,
    hasCloseButton = true,
    title,
    headerClassName,
    contentClassName,
    className,
    closeButtonTestID
  }) => {
    const { fullPage, confirmWindow } = useAppEnv();

    return (
      <CustomModal
        isOpen
        className={clsx('rounded-lg outline-none', className)}
        overlayClassName={clsx(
          'backdrop-blur-xs',
          fullPage &&
            !confirmWindow && [
              FULL_PAGE_WRAP_OVERLAY_CLASSNAME,
              actionModalStyles.fullPageOverlay,
              LAYOUT_CONTAINER_CLASSNAME,
              FULL_PAGE_LAYOUT_CONTAINER_CLASSNAME
            ]
        )}
        onRequestClose={onClose}
      >
        {hasHeader && (
          <div className={clsx('relative p-3 border-b-0.5 border-lines w-modal', contentClassName)}>
            <h1 className={clsx('text-center text-font-regular-bold mx-12', headerClassName)}>{title}</h1>
            {hasCloseButton && (
              <Button className="absolute top-3 right-3" onClick={onClose} testID={closeButtonTestID}>
                <IconBase Icon={CloseIcon} className="text-grey-2" />
              </Button>
            )}
          </div>
        )}
        {children}
      </CustomModal>
    );
  }
);
