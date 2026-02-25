import React, { FC, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';

import { Anchor, HashChip, Identicon, Name, SyncSpinner } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ReactComponent as EditIcon } from 'app/icons/edit-title.svg';
import { ReactComponent as LinkSvgIcon } from 'app/icons/external-link.svg';
import { ReactComponent as KeyIcon } from 'app/icons/key.svg';
import PageLayout from 'app/layouts/PageLayout';
import { ReactComponent as EllipsePurple } from 'app/misc/Ellipse-purple.svg';
import { BTN_ERROR, ButtonRounded } from 'app/molecules/ButtonRounded';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';
import AccountBanner from 'app/templates/AccountBanner';
import { HistoryDetailsPopup } from 'app/templates/History/HistoryDetailsPopup';
import { HistoryItem } from 'app/templates/History/HistoryItem';
import { usePopupState } from 'app/templates/PopupModalWithTitle/hooks/usePopupState';
import { T, t } from 'lib/i18n';
import {
  useAccount,
  useAllAccounts,
  useBlockExplorer,
  useContactsActions,
  useExplorerBaseUrls,
  useSetAccountPkh
} from 'lib/temple/front';
import { UserHistoryItem } from 'lib/temple/history';
import useHistory from 'lib/temple/history/hook';
import { TempleAccount, TempleAccountType } from 'lib/temple/types';
import { useConfirm } from 'lib/ui/dialog';
import { goBack, navigate } from 'lib/woozie';

import { useAccountOwnership } from './hooks';
import { EditAccountNamePopup } from './popups/EditAccountNamePopup';
import { RemoveAccountPopup } from './popups/RemoveAccountPopup';

export type EditAccountProps = {
  accHash?: string | null;
};

export const EditAccount: FC<EditAccountProps> = ({ accHash }) => {
  const { isOwn } = useAccountOwnership(accHash);

  return isOwn ? <EditOwnAccount accHash={accHash} /> : <EditContact accHash={accHash} />;
};

export const EditOwnAccount: FC<EditAccountProps> = ({ accHash }) => {
  const accounts = useAllAccounts();
  const { popup } = useAppEnv();

  const account = useMemo(
    () => (accHash ? accounts.find(acc => acc.publicKeyHash === accHash)! : accounts[0]),
    [accHash, accounts]
  );

  const { accToChange, isOwn } = useAccountOwnership(accHash);

  const editNamePopup = usePopupState(false);
  const removeAccountPopup = usePopupState(false);

  const accountOptions: ListItemWithNavigateprops[] = useMemo(
    () => [
      { i18nKey: 'editName', Icon: EditIcon, onClick: editNamePopup.open, fillIcon: true },
      ...(account.type !== TempleAccountType.WatchOnly
        ? [{ linkTo: '/settings/reveal-private-key', i18nKey: 'revealPrivateKey', Icon: KeyIcon, fillIcon: false }]
        : [])
    ],
    [account.type, editNamePopup.open]
  );

  return (
    <PageLayout pageTitle={<span>{isOwn ? t('editAccount') : t('editContact')}</span>} isTopbarVisible={false}>
      <div className={clsx('w-full mx-auto h-full flex flex-col flex-1', popup ? 'max-w-sm pb-8' : 'max-w-screen-xxs')}>
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex flex-col gap-1">
            <AccountBanner account={account} restrictAccountSelect />
          </div>

          <ul className={clsx('flex flex-col pb-4')}>
            {accountOptions.map(option => (
              <ListItemWithNavigate key={option.i18nKey} {...option} paddingClassName="py-4" fullWidthDivider />
            ))}
          </ul>
        </div>

        {account.type !== TempleAccountType.HD && (
          <ButtonRounded
            btnType={BTN_ERROR}
            size="big"
            fill={false}
            className="w-full mt-auto"
            onClick={removeAccountPopup.open}
          >
            <T id="deleteAccount" />
          </ButtonRounded>
        )}
      </div>

      <EditAccountNamePopup
        opened={editNamePopup.opened}
        close={editNamePopup.close}
        name={account.name}
        accountHash={account.publicKeyHash}
        isOwn={isOwn}
        accToChange={accToChange}
      />

      <RemoveAccountPopup
        opened={removeAccountPopup.opened}
        close={removeAccountPopup.close}
        accountId={account.id}
        onRemoved={goBack}
      />
    </PageLayout>
  );
};

export const EditContact: FC<EditAccountProps> = ({ accHash }) => {
  const setAccountPkh = useSetAccountPkh();
  const { removeContact } = useContactsActions();
  const account = useAccount();
  const confirm = useConfirm();
  const { popup } = useAppEnv();
  const { explorer } = useBlockExplorer();
  const { account: explorerBaseUrl } = useExplorerBaseUrls();

  const { accToChange, isOwn } = useAccountOwnership(accHash);

  const accountHash = useMemo(
    () => (accToChange ? accToChange.address : account.publicKeyHash),
    [accToChange, account.publicKeyHash]
  );

  const accountName = useMemo(() => (accToChange ? accToChange.name : account.name), [accToChange, account.name]);

  const accountObj: TempleAccount = useMemo(
    () => ({ publicKeyHash: accountHash, name: accountName, isKYC: false, type: TempleAccountType.WatchOnly }),
    [accountHash, accountName]
  );

  const { loading: userHistoryLoading, list: userHistory } = useHistory(3, undefined, undefined, accountObj);
  const [isOpen, setIsOpen] = useState(false);
  const [activeHistoryItem, setActiveHistoryItem] = useState<UserHistoryItem | null>(null);

  const editNamePopup = usePopupState(false);

  const autoCancelTimeoutRef = useRef<number>();

  useEffect(
    () => () => {
      clearTimeout(autoCancelTimeoutRef.current);
    },
    []
  );

  // handlers --------------------------------------------

  const handleRequestClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleRemoveContactClick = useCallback(async () => {
    if (isOwn) {
      // switch acc so u will see proper acc on the settings/remove-account screen
      setAccountPkh(accountHash);
      // navigate to the /settings/remove-account screen
      return navigate('/settings/remove-account');
    }

    if (
      !(await confirm({
        title: t('deleteContact'),
        children: t('deleteContactConfirm'),
        comfirmButtonText: t('delete'),
        confirmButtonType: BTN_ERROR,
        cancelButtonType: BTN_ERROR
      }))
    ) {
      return;
    }

    await removeContact(accountHash);
    goBack();
  }, [accountHash, confirm, isOwn, removeContact, setAccountPkh]);

  const handleItemClick = useCallback(
    (hash: string) => {
      setIsOpen(true);
      setActiveHistoryItem(userHistory.find(item => item.hash === hash) ?? null);
    },
    [userHistory]
  );

  return (
    <PageLayout pageTitle={<span>{t('contactInfo')}</span>} isTopbarVisible={false}>
      <div
        className={clsx(
          'w-full mx-auto h-full flex flex-col flex-1 justify-between',
          popup ? 'max-w-sm' : 'max-w-screen-xxs'
        )}
      >
        <section className="flex flex-col">
          <div className="p-4 rounded-2xl overflow-hidden bg-gray-900 flex flex-col items-center relative mb-4">
            {/* Positioned Content */}
            <Anchor
              href={`${explorerBaseUrl}${accountHash}`}
              className="flex items-center absolute top-4 right-4 text-white text-xs z-20"
            >
              <p className="underline">
                <T id="viewOnBlockExplorerName" substitutions={[explorer.name]} />
              </p>
              <LinkSvgIcon className="fill-current w-4 h-4" />
            </Anchor>

            <EllipsePurple className="absolute left-0 top-0 z-0" />
            {/* ------------------- */}
            <div className="z-10 flex flex-col items-center">
              <Identicon type="bottts" hash={accountHash} size={64} className="shadow-xs rounded-full flex-shrink-0" />
              <div className="text-white flex items-center gap-1 mb-2 mt-3">
                <Name className="text-primary-white text-xl">{accountName}</Name>

                <button onClick={editNamePopup.open} className="outline-none focus:outline-none">
                  <EditIcon className="min-w-6 w-6 h-6 fill-current" />
                </button>
              </div>
              <HashChip hash={accountHash} trim={false} />
            </div>
          </div>

          <p className="mb-2 text-white text-base-plus font-bold">
            <T id="recentTransfers" />
          </p>

          <section>
            {userHistoryLoading ? (
              <>
                <SyncSpinner className="mt-4" />
              </>
            ) : !userHistory.length ? (
              <div
                style={{ height: popup ? 200 : 300 }}
                className="text-sm text-secondary-white flex items-center justify-center "
              >
                No recent transfers yet
              </div>
            ) : (
              userHistory.map((historyItem, idx) => (
                <Fragment key={historyItem.hash + idx}>
                  <HistoryItem
                    address={accountHash}
                    historyItem={historyItem}
                    handleItemClick={handleItemClick}
                    last={false}
                  />
                </Fragment>
              ))
            )}
          </section>
        </section>
        <div className="flex-1 min-h-8"></div>
        <div>
          <ButtonRounded
            btnType={BTN_ERROR}
            size="big"
            fill={false}
            className={clsx('w-full', popup && 'mb-8')}
            onClick={handleRemoveContactClick}
          >
            <T id="deleteContact" />
          </ButtonRounded>
        </div>
      </div>
      <EditAccountNamePopup
        opened={editNamePopup.opened}
        close={editNamePopup.close}
        name={accountName}
        accountHash={accountHash}
        isOwn={isOwn}
        accToChange={accToChange}
      />
      <HistoryDetailsPopup isOpen={isOpen} onRequestClose={handleRequestClose} historyItem={activeHistoryItem} />
    </PageLayout>
  );
};
