import React, { FC, useCallback, useMemo, useState } from 'react';

import { useTempleClient } from 'lib/temple/front';
import { DisplayedGroup, TempleAccount } from 'lib/temple/types';
import { useAlert } from 'lib/ui/dialog';

import { AccountAlreadyExistsWarning } from '../popups/AccountAlreadyExistsWarning';
import { EditWalletGroupNamePopup } from '../popups/EditWalletGroupNamePopup';

import { WalletCardDropdown } from './WalletCardDropdown/WalletCardDropdown';

type AccountsmanagementProps = {
  group: DisplayedGroup;
};

enum AccountsManagementModal {
  RenameWallet = 'rename-wallet',
  ConfirmSeedPhraseAccess = 'confirm-seed-phrase-access',
  RevealSeedPhrase = 'reveal-seed-phrase',
  DeleteWallet = 'delete-wallet',
  AccountAlreadyExistsWarning = 'account-already-exists-warning',
  CreateHDWalletFlow = 'create-hd-wallet-flow',
  ImportAccount = 'import-account',
  ImportWallet = 'import-wallet',
  WatchOnly = 'watch-only',
  ConnectLedger = 'connect-ledger'
}

export const Accountsmanagement: FC<AccountsmanagementProps> = ({ group }) => {
  const { createAccount } = useTempleClient();
  const customAlert = useAlert();

  const [selectedGroup, setSelectedGroup] = useState<DisplayedGroup | null>(null);
  const [oldAccount, setOldAccount] = useState<TempleAccount | null>(null);
  const [activeModal, setActiveModal] = useState<AccountsManagementModal | null>(null);

  const handleModalClose = useCallback(() => {
    setActiveModal(null);
    setSelectedGroup(null);
    setOldAccount(null);
  }, []);

  const actionWithModalFactory = useCallback(
    (modal: AccountsManagementModal) => (group: DisplayedGroup) => {
      setSelectedGroup(group);
      setActiveModal(modal);
    },
    []
  );

  const handleRenameClick = useMemo(
    () => actionWithModalFactory(AccountsManagementModal.RenameWallet),
    [actionWithModalFactory]
  );

  const showAccountAlreadyExistsWarning = useCallback((group: DisplayedGroup, oldAccount: TempleAccount) => {
    setSelectedGroup(group);
    setOldAccount(oldAccount);
    setActiveModal(AccountsManagementModal.AccountAlreadyExistsWarning);
  }, []);

  const handleAccountAlreadyExistsWarnClose = useCallback(async () => {
    try {
      await createAccount(selectedGroup!.id);
      handleModalClose();
    } catch (e: any) {
      console.error(e);
      customAlert({
        title: 'Failed to create an account',
        children: e.message
      });
    }
  }, [createAccount, customAlert, handleModalClose, selectedGroup]);

  const modal = useMemo(() => {
    switch (activeModal) {
      case AccountsManagementModal.RenameWallet:
        return (
          <EditWalletGroupNamePopup
            group={selectedGroup!}
            opened={activeModal === AccountsManagementModal.RenameWallet}
            close={handleModalClose}
          />
        );

      case AccountsManagementModal.AccountAlreadyExistsWarning:
        return (
          <AccountAlreadyExistsWarning
            newAccountGroup={selectedGroup!}
            oldAccount={oldAccount!}
            onClose={handleAccountAlreadyExistsWarnClose}
          />
        );

      default:
        return null;
    }
  }, [activeModal, handleAccountAlreadyExistsWarnClose, handleModalClose, oldAccount, selectedGroup]);

  return (
    <>
      <WalletCardDropdown
        group={group}
        showAccountAlreadyExistsWarning={showAccountAlreadyExistsWarning}
        handleRenameClick={handleRenameClick}
      />
      {modal}
    </>
  );
};
