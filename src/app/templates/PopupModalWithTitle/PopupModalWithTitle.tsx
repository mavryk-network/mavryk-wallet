import React, { FC, ReactNode, memo, useMemo } from 'react';

import classNames from 'clsx';

import CustomPopup, { CustomPopupContentPositionType, CustomPopupProps } from 'app/atoms/CustomPopup';
import { useAppEnv } from 'app/env';
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
  contentPosition?: CustomPopupContentPositionType;
}

export const PopupModalWithTitle: FC<PopupModalWithTitlePropsProps> = memo(
  ({ title, children, className, headerComponent, leftSidedComponent, contentPosition = 'bottom', ...restProps }) => {
    const { popup } = useAppEnv();
    const handleMouseEnter = useTippyById('#close-icon', tippyProps);

    const memoizedContentStyle = useMemo(
      () => (popup ? { maxHeight: 500 } : { maxHeight: 'calc(100vh - 190px' }),
      [popup]
    );

    return (
      <CustomPopup
        {...restProps}
        className={classNames(
          'w-full relative  bg-primary-card',
          contentPosition === 'center' ? 'rounded-2xl-plus' : 'rounded-tl-2xl-plus rounded-tr-2xl-plus',
          popup ? 'max-w-md' : contentPosition === 'center' ? 'max-w-screen-xxsPlus' : 'max-w-screen-xs',
          className
        )}
        shouldCloseOnEsc
        contentPosition={contentPosition}
      >
        <>
          {headerComponent && <div className={styles.headerComponent}>{headerComponent}</div>}
          <button onMouseEnter={handleMouseEnter} id="close-icon" className="absolute top-3 right-3 z-20">
            <CloseIcon className="w-6 h-auto cursor-pointer stroke stroke-1" onClick={restProps.onRequestClose} />
          </button>
          <div
            // used for infinite scrol lib to load more stuff while scrolled to the end
            id="popupModalScrollable"
            style={memoizedContentStyle}
            className={classNames('w-full no-scrollbar', styles.container)}
          >
            <div
              className={classNames(
                leftSidedComponent ? styles.headerContent : 'flex items-center justify-center relative',
                popup ? 'px-4' : contentPosition === 'center' ? 'mx-12' : 'ml-0',
                popup ? 'mb-4' : contentPosition === 'center' ? 'mb-8' : 'mb-4'
              )}
            >
              <div className="z-20">{leftSidedComponent}</div>
              {title && (
                <div className={classNames('text-white text-center text-xl px-4 bg-primary-card', styles.middle)}>
                  {title}
                </div>
              )}
            </div>
            <ChildComponent children={children} />
          </div>
        </>
      </CustomPopup>
    );
  }
);

const ChildComponent = memo(({ children }: { children: ReactNode }) => {
  return <div className="no-scrollbar h-full">{children}</div>;
});
