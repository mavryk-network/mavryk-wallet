import React, { FC, useCallback, useMemo, useState, useEffect } from 'react';

import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import { ButtonLink } from 'app/molecules/ButtonLink/ButtonLink';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import SearchField from 'app/templates/SearchField/SearchField';
import { useGasToken } from 'lib/assets/hooks';
import { T, t } from 'lib/i18n';
import { useAccount, useRelevantAccounts, useSetAccountPkh } from 'lib/temple/front';

import { AccountDropdownSelectors } from '../selectors';

import { AccountItem } from './AccountItem';

type AccountPopupProps = {
  opened: boolean;
  setOpened: (v: boolean) => void;
  onlyAccSelect?: boolean;
};

const AccountPopup: FC<AccountPopupProps> = ({ opened, setOpened, onlyAccSelect = false }) => {
  const allAccounts = useRelevantAccounts();
  const { popup } = useAppEnv();
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
    },
    [account, setAccountPkh, setOpened]
  );

  useEffect(() => {
    if (searchValue) setAttractSelectedAccount(false);
    else if (opened === false) setAttractSelectedAccount(true);
  }, [opened, searchValue]);

  const action = useMemo(
    () => ({
      key: 'add-or-import-account',
      linkTo: '/add-or-import-account',
      testID: AccountDropdownSelectors.addorImportAccountButton,
      onClick: () => setOpened(false)
    }),
    [setOpened]
  );

  return (
    <div className={classNames(popup ? 'my-2' : 'px-12')}>
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
          containerClassName={'mb-4 px-4'}
          onValueChange={setSearchValue}
        />
      )}

      <div
        className={classNames(
          'overflow-y-auto shadow-inner no-scrollbar',
          popup && 'max-h-80',
          isShowSearch && 'border-t-0 rounded-t-none',
          !popup && filteredAccounts.length > 5 && 'pr-4'
        )}
        style={{ height: isShowSearch && popup ? (filteredAccounts.length > 5 ? 328 : 397) : 'auto' }}
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

      {!onlyAccSelect && (
        <div className={classNames('w-full flex justify-cente', popup ? 'px-4 mt-4' : 'mt-8')}>
          <ButtonLink {...action}>
            <ButtonRounded size="big" fill={false} className="w-full">
              <T id="addOrImportAccount" />
            </ButtonRounded>
          </ButtonLink>
        </div>
      )}
    </div>
  );
};

export default AccountPopup;
