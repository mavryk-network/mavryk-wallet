import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';

import classNames from 'clsx';

import SearchField from 'app/templates/SearchField';
import { T, t } from 'lib/i18n';
import { useAccount, useRelevantAccounts, useSetAccountPkh, useGasToken } from 'lib/temple/front';
import { HistoryAction, navigate } from 'lib/woozie';

import { AccountItem } from './AccountItem';

type AccountPopupProps = {
  opened: boolean;
  setOpened: (v: boolean) => void;
};

const AccountPopup: FC<AccountPopupProps> = ({ opened, setOpened }) => {
  const allAccounts = useRelevantAccounts();
  const account = useAccount();
  const setAccountPkh = useSetAccountPkh();
  const { assetName: gasTokenName } = useGasToken();

  const [searchValue, setSearchValue] = useState('');
  const [attractSelectedAccount, setAttractSelectedAccount] = useState(true);

  const isShowSearch = useMemo(() => allAccounts.length > 5, [allAccounts.length]);

  const filteredAccounts = useMemo(() => {
    if (searchValue.length === 0) {
      return allAccounts;
    } else {
      const lowerCaseSearchValue = searchValue.toLowerCase();

      return allAccounts.filter(currentAccount => currentAccount.name.toLowerCase().includes(lowerCaseSearchValue));
    }
  }, [searchValue, allAccounts]);

  const handleAccountClick = useCallback(
    (publicKeyHash: string) => {
      const selected = publicKeyHash === account.publicKeyHash;
      if (!selected) {
        setAccountPkh(publicKeyHash);
      }
      setOpened(false);
      navigate('/', HistoryAction.Replace);
    },
    [account, setAccountPkh, setOpened]
  );

  useEffect(() => {
    if (searchValue) setAttractSelectedAccount(false);
    else if (opened === false) setAttractSelectedAccount(true);
  }, [opened, searchValue]);

  return (
    <div className="my-2">
      {isShowSearch && (
        <SearchField
          value={searchValue}
          className={classNames(
            'py-2 pl-8 pr-4',
            'bg-transparent',
            'border border-white border-opacity-10',
            'focus:outline-none',
            'transition ease-in-out duration-200',
            'rounded-md rounded-b-none',
            'text-white text-sm leading-tight'
          )}
          placeholder={t('searchByName')}
          searchIconClassName="h-5 w-auto"
          searchIconWrapperClassName="px-2 text-white opacity-75"
          cleanButtonStyle={{ backgroundColor: 'transparent' }}
          cleanButtonIconStyle={{ stroke: 'white' }}
          onValueChange={setSearchValue}
        />
      )}

      <div className={classNames('overflow-y-auto shadow-inner', isShowSearch && 'border-t-0 rounded-t-none')}>
        <div className="flex flex-col">
          {filteredAccounts.length === 0 ? (
            <p className="text-center text-white text-base">
              <T id="noResults" />
            </p>
          ) : (
            filteredAccounts.map(acc => (
              <AccountItem
                key={acc.publicKeyHash}
                account={acc}
                selected={acc.publicKeyHash === account.publicKeyHash}
                gasTokenName={gasTokenName}
                attractSelf={attractSelectedAccount}
                onClick={() => handleAccountClick(acc.publicKeyHash)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountPopup;
