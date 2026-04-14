import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import clsx from 'clsx';

import DocBg from 'app/a11y/DocBg';
import { useAppEnv } from 'app/env';
import styles from 'app/layouts/pageLayout.module.css';
import InternalConfirmation from 'app/templates/InternalConfirmation';
import { useMavrykClient, useWalletConfirmation } from 'lib/temple/front';

const ConfirmationOverlay: FC = () => {
  const confirmation = useWalletConfirmation();
  const { resetConfirmation, confirmInternal } = useMavrykClient();
  const { popup } = useAppEnv();
  const displayed = Boolean(confirmation);

  // Two-state animation: rendered controls mount/unmount, visible drives CSS opacity transition
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);

  // rendered controls mount/unmount; visible drives the CSS opacity transition.
  // confirmation and displayed are always in sync (same source), so InternalConfirmation
  // is only rendered when a real confirmation payload is present.
  useEffect(() => {
    if (displayed) {
      setRendered(true);
      // Double-rAF ensures the browser has painted opacity-0 before transitioning to opacity-100.
      // Cancel both frames on cleanup to avoid setVisible(true) firing after unmount.
      let inner: number;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    } else {
      setVisible(false);
      const t = setTimeout(() => setRendered(false), 200);
      return () => clearTimeout(t);
    }
  }, [displayed]);

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

  if (!rendered) return null;

  return (
    <>
      {displayed && <DocBg bgClassName={memoizedBgClassname} />}

      <div
        className={clsx(
          'fixed inset-0 z-30 overflow-y-auto',
          'transition-opacity duration-200',
          memoizedBgClassname,
          visible ? 'opacity-100' : 'opacity-0'
        )}
      >
        {confirmation && (
          <InternalConfirmation payload={confirmation.payload} error={confirmation.error} onConfirm={handleConfirm} />
        )}
      </div>
    </>
  );
};

export default ConfirmationOverlay;
