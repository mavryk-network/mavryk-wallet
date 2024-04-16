import React, { FC, useCallback, useLayoutEffect, useMemo } from 'react';

import clsx from 'clsx';
import CSSTransition from 'react-transition-group/CSSTransition';

import DocBg from 'app/a11y/DocBg';
import { useAppEnv } from 'app/env';
import styles from 'app/layouts/pageLayout.module.css';
import InternalConfirmation from 'app/templates/InternalConfirmation';
import { useTempleClient } from 'lib/temple/front';
import Portal from 'lib/ui/Portal';

const ConfirmationOverlay: FC = () => {
  const { confirmation, resetConfirmation, confirmInternal } = useTempleClient();
  const { popup } = useAppEnv();
  const displayed = Boolean(confirmation);

  useLayoutEffect(() => {
    if (displayed) {
      const x = window.scrollX;
      const y = window.scrollY;
      document.body.classList.add('overscroll-y-none');

      return () => {
        window.scrollTo(x, y);
        document.body.classList.remove('overscroll-y-none');
      };
    }
    return undefined;
  }, [displayed]);

  const handleConfirm = useCallback(
    async (confirmed: boolean, modifiedTotalFee?: number, modifiedStorageLimit?: number) => {
      if (confirmation) {
        await confirmInternal(confirmation.id, confirmed, modifiedTotalFee, modifiedStorageLimit);
      }
      resetConfirmation();
    },
    [confirmation, confirmInternal, resetConfirmation]
  );

  const memoizedBgClassname = useMemo(() => (popup ? 'bg-primary-bg' : styles.fullpageBg), [popup]);

  return (
    <>
      {displayed && <DocBg bgClassName={memoizedBgClassname} />}

      <Portal>
        <CSSTransition
          in={displayed}
          timeout={200}
          clsx={{
            enter: 'opacity-0',
            enterActive: clsx('opacity-100', 'transition ease-out duration-200'),
            exit: clsx('opacity-0', 'transition ease-in duration-200')
          }}
          unmountOnExit
        >
          <div className={clsx('fixed inset-0 z-50 overflow-y-auto', memoizedBgClassname)}>
            {confirmation && (
              <InternalConfirmation
                payload={confirmation.payload}
                error={confirmation.error}
                onConfirm={handleConfirm}
              />
            )}
          </div>
        </CSSTransition>
      </Portal>
    </>
  );
};

export default ConfirmationOverlay;
