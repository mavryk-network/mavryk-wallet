import React, { FC, useCallback, useState } from 'react';

import classNames from 'clsx';

import { Button } from 'app/atoms/Button';
import Identicon from 'app/atoms/Identicon';
import Name from 'app/atoms/Name';
import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { useTempleClient, useAccount } from 'lib/temple/front';
import Popper from 'lib/ui/Popper';

import styles from './Header.module.css';
import { HeaderSelectors } from './Header.selectors';
import AccountDropdown from './Header/AccountDropdown';
import NetworkSelect from './Header/NetworkSelect';

const Header: FC = () => {
  const appEnv = useAppEnv();
  const { ready } = useTempleClient();

  return (
    <header className={classNames('bg-primary-card', styles['inner-shadow'], appEnv.fullPage && 'pb-20 -mb-20')}>
      <ContentContainer className="py-3">
        <div className={classNames(appEnv.fullPage && 'px-4')}>
          <div className="flex items-stretch">{ready && <Control />}</div>
        </div>
      </ContentContainer>
    </header>
  );
};

export default Header;

const Control: FC = () => {
  const account = useAccount();

  // new
  const [show, setShow] = useState(false);

  const close = useCallback(() => {
    setShow(false);
  }, []);
  const open = useCallback(() => {
    setShow(true);
  }, []);

  return (
    <>
      <Popper
        placement="left-start"
        strategy="fixed"
        style={{ pointerEvents: 'none' }}
        popup={props => <AccountDropdown {...props} />}
      >
        {({ ref, opened, toggleOpened }) => (
          <Button
            ref={ref}
            className={classNames(
              'flex-shrink-0 flex p-px',
              'rounded-md border border-white border-opacity-25',
              'bg-white bg-opacity-10 cursor-pointer',
              'transition ease-in-out duration-200',
              opened
                ? 'shadow-md opacity-100'
                : 'shadow hover:shadow-md focus:shadow-md opacity-90 hover:opacity-100 focus:opacity-100'
            )}
            onClick={toggleOpened}
            testID={HeaderSelectors.accountIcon}
          >
            <Identicon type="bottts" hash={account.publicKeyHash} size={48} />
          </Button>
        )}
      </Popper>

      <button onClick={open} className="text-white">
        TEMPO
      </button>

      <div className="ml-2 flex-1 flex flex-col items-start">
        <div className="max-w-full overflow-x-hidden">
          <Name className="text-primary-white text-sm font-semibold text-shadow-black opacity-90">{account.name}</Name>
        </div>

        <div className="flex-1" />
        <NetworkSelect />
      </div>
      {/* <PopupModalWithTitle isOpen={show} onRequestClose={close} title="Test">
        <div className="flex flex-col text-white">
          <div>content</div>
          <div>content</div>
          <div>content</div>
          <div>content</div>
          <div>content</div>
          <div>content</div>
          <div>content</div>
          <div className="text-black">content</div>
        </div>
      </PopupModalWithTitle> */}
    </>
  );
};
