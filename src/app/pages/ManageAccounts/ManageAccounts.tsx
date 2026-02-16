import React, { FC, useMemo, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as PlusIcon } from 'app/icons/plus.svg';
import PageLayout from 'app/layouts/PageLayout';
import SearchField from 'app/templates/SearchField';
import { t, T } from 'lib/i18n';
import { useRelevantAccounts } from 'lib/temple/front';
import { Link } from 'lib/woozie';
import { useAccountsGroups } from 'mavryk/front/groups';

import { WalletCard } from './components/WalletCard/WalletCard';

export const ManageAccounts: FC = () => {
  const { popup } = useAppEnv();
  const allAccounts = useRelevantAccounts();

  const [searchValue, setSearchValue] = useState('');

  const filteredAccounts = useMemo(() => {
    if (searchValue.length === 0) {
      return allAccounts;
    } else {
      const lowerCaseSearchValue = searchValue.toLowerCase();

      return allAccounts.filter(currentAccount => currentAccount.name.toLowerCase().includes(lowerCaseSearchValue));
    }
  }, [searchValue, allAccounts]);

  const groups = useAccountsGroups(filteredAccounts);

  const memoizedContentContainerStyle = useMemo(() => (popup ? { padding: 0 } : {}), [popup]);

  return (
    <PageLayout
      pageTitle={
        <>
          <T id={'manageAccounts'} />
        </>
      }
      isTopbarVisible={false}
      contentContainerStyle={memoizedContentContainerStyle}
    >
      <div className={clsx(popup && 'px-4', 'flex h-full min-h-0 flex-col overflow-hidden')}>
        <div className={clsx('sticky top-0 z-10 mb-3 flex shrink-0 items-center justify-end gap-3 bg-inherit pt-4')}>
          <SearchField
            value={searchValue}
            className={clsx(
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
          <Link to="import-account" className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary-card">
            <PlusIcon className="w-6 h-6 stroke-2" />
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl shadow-inner stable-scrollbar visible-scrollbar mb-6">
          <div className="flex flex-col gap-4 py-2">
            {groups.length === 0 ? (
              <p className="text-center text-white text-base">
                <T id="noResults" />
              </p>
            ) : (
              groups.map(group => <WalletCard key={group.id} group={group} />)
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};
