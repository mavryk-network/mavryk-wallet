import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';

import classNames from 'clsx';

import { ButtonLink } from 'app/molecules/ButtonLink/ButtonLink';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import SearchField from 'app/templates/SearchField';
import { T, t } from 'lib/i18n';
import { useAccount, useRelevantAccounts, useSetAccountPkh, useGasToken } from 'lib/temple/front';
import { HistoryAction, navigate } from 'lib/woozie';

import { AccountDropdownSelectors } from '../selectors';
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

  const action = useMemo(
    () => ({
      key: 'create-account',
      linkTo: '/create-account',
      testID: AccountDropdownSelectors.createOrRestoreAccountButton,
      onClick: () => setOpened(false)
    }),
    [setOpened]
  );

  return (
    <div className="my-2">
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
          cleanButtonIconStyle={{ stroke: 'white' }}
          containerClassName={'mb-4 px-4'}
          onValueChange={setSearchValue}
        />
      )}

      <div
        className={classNames(
          'overflow-y-auto shadow-inner max-h-80 no-scrollbar',
          isShowSearch && 'border-t-0 rounded-t-none h-80'
        )}
      >
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

      <div className="w-full flex justify-center">
        <ButtonLink {...action}>
          <ButtonRounded size="big" fill={false} className="mx-auto mt-4">
            <T id="addRestoreAccount" />
          </ButtonRounded>
        </ButtonLink>
      </div>
    </div>
  );
};

export default AccountPopup;
