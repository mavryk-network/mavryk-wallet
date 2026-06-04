import React, { FC } from 'react';

import classNames from 'clsx';
import CSSTransition from 'react-transition-group/CSSTransition';

import { ReactComponent as LedgerNanoIcon } from 'app/misc/ledger.svg';
import { T } from 'lib/i18n';

interface ConfirmLedgerOverlayProps {
  displayed: boolean;
}

const ConfirmLedgerOverlay: FC<ConfirmLedgerOverlayProps> = ({ displayed }) => (
  <CSSTransition
    in={displayed}
    timeout={500}
    classNames={{
      enter: 'opacity-0',
      enterActive: classNames('opacity-100', 'transition ease-out duration-500'),
      exit: classNames('opacity-0', 'transition ease-in duration-500')
    }}
    unmountOnExit
  >
    <div
      className={classNames('absolute inset-0', 'bg-primary-bg', 'p-8', 'flex flex-col items-center justify-center')}
    >
      <h1 className={classNames('mb-8', 'text-center', 'text-xl font-medium tracking-tight text-primary-white')}>
        <span className="text-base font-normal text-secondary-white">
          <T id="confirmActionOnDevice" />
        </span>
        <br />
        <T
          id="deviceName"
          substitutions={[
            <span key="ledgerNano" className="text-cleanWhite">
              <T id="ledgerNano" />
            </span>
          ]}
        />
      </h1>

      <LedgerNanoIcon className="animate-pulse" style={{ width: '10rem', height: 'auto' }} />

      <p className={classNames('mt-8', 'text-center', 'text-sm text-secondary-white', 'max-w-xs')}>
        <T id="ledgerBridgeGuide" />
      </p>
    </div>
  </CSSTransition>
);

export default ConfirmLedgerOverlay;
