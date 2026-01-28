import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';

import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as PlusIcon } from 'app/icons/plus.svg';
import { ReactComponent as SettingsIcon } from 'app/icons/settings.svg';
import SearchField from 'app/templates/SearchField/SearchField';
import { T, t } from 'lib/i18n';
import { useAccount, useRelevantAccounts, useSetAccountPkh } from 'lib/temple/front';
import useTippy, { UseTippyOptions } from 'lib/ui/useTippy';
import { Link } from 'lib/woozie';
import { useAccountsGroups } from 'mavryk/front/groups';

import { WalletCard } from './components/WalletCard';

type AccountPopupProps = {
  opened: boolean;
  setOpened: (v: boolean) => void;
};

const LIST_HEIGHT = 320;
const isShowSearch = true;

const AccountPopup: FC<AccountPopupProps> = ({ opened, setOpened }) => {
  const allAccounts = useRelevantAccounts();
  const { popup } = useAppEnv();
  const account = useAccount();
  const setAccountPkh = useSetAccountPkh();

  const settingsTippyOptions = useMemo<UseTippyOptions>(
    () => ({
      trigger: 'mouseenter',
      hideOnClick: false,
      content: 'Manage Accounts',
      animation: 'shift-away-subtle'
    }),
    []
  );

  const plusTippyOptions = useMemo<UseTippyOptions>(
    () => ({
      ...settingsTippyOptions,
      content: 'Import Account'
    }),
    [settingsTippyOptions]
  );

  const settingsRef = useTippy<HTMLAnchorElement>(settingsTippyOptions);
  const plusRef = useTippy<HTMLAnchorElement>(plusTippyOptions);

  const [searchValue, setSearchValue] = useState('');
  const [attractSelectedAccount, setAttractSelectedAccount] = useState(true);

  const filteredAccounts = useMemo(() => {
    if (searchValue.length === 0) {
      return allAccounts;
    } else {
      const lowerCaseSearchValue = searchValue.toLowerCase();
      return allAccounts.filter(currentAccount => currentAccount.name.toLowerCase().includes(lowerCaseSearchValue));
    }
  }, [searchValue, allAccounts]);

  const groups = useAccountsGroups(filteredAccounts);

  const handleAccountClick = useCallback(
    (publicKeyHash: string) => {
      const selected = publicKeyHash === account.publicKeyHash;
      if (!selected) {
        setAccountPkh(publicKeyHash);
      }
      setOpened(false);
    },
    [account, setAccountPkh, setOpened]
  );

  useEffect(() => {
    if (searchValue) setAttractSelectedAccount(false);
    else if (opened === false) setAttractSelectedAccount(true);
  }, [opened, searchValue]);

  const icons = useMemo(() => {
    return [
      {
        id: 1,
        Icon: SettingsIcon,
        ref: settingsRef,
        linkTo: '/manage-accounts'
      },
      {
        id: 2,
        Icon: PlusIcon,
        ref: plusRef,
        linkTo: '/add-or-import-account'
      }
    ];
  }, [settingsRef, plusRef]);

  return (
    <div className={classNames(popup ? 'my-2 px-4' : 'px-12')}>
      <div className="flex items-center justify-end mb-3 px-4 gap-3">
        {isShowSearch && (
          <SearchField
            value={searchValue}
            className={classNames(
              'py-2 pl-8 pr-4',
              'bg-secondary-card',
              'focus:outline-none',
              'transition ease-in-out duration-200',
              'text-white text-sm leading-tight',
              'placeholder-primary-white placeholder-opacity-50 rounded-lg'
            )}
            placeholder={t('searchByName')}
            searchIconClassName="h-5 w-auto"
            searchIconWrapperClassName="px-2 text-white opacity-50"
            cleanButtonStyle={{ backgroundColor: 'transparent' }}
            onValueChange={setSearchValue}
          />
        )}

        <div className="flex gap-2">
          {icons.map(item => (
            <Link
              key={item.id}
              ref={item.ref}
              to={item.linkTo}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary-card"
            >
              <item.Icon className="w-6 h-6" />
            </Link>
          ))}
        </div>
      </div>

      <div
        className={classNames(
          'flex flex-col',
          popup && 'max-h-80',
          isShowSearch && 'border-t-0 rounded-t-none',
          !popup && filteredAccounts.length > 5 && 'pr-4'
        )}
        style={isShowSearch ? { height: LIST_HEIGHT } : undefined}
      >
        {/* CLIP WRAPPER (doesn't scroll) */}
        <div className="flex-1 overflow-hidden rounded-xl bg-transparent">
          {/* SCROLLER */}
          <div className="h-full overflow-y-auto no-scrollbarD shadow-inner">
            <div className="flex flex-col gap-4 py-1">
              {filteredAccounts.length === 0 ? (
                <p className="text-center text-white text-base">
                  <T id="noResults" />
                </p>
              ) : (
                groups.map(group => <WalletCard key={group.id} group={group} handleAccountClick={handleAccountClick} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPopup;
