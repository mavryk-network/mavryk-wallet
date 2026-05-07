import React, { FC, useCallback, useState } from 'react';

import { DisplayedGroup } from 'lib/temple/types';

import { EditWalletGroupNamePopup } from '../popups/EditWalletGroupNamePopup';

import { WalletCardDropdown } from './WalletCardDropdown/WalletCardDropdown';

type AccountsmanagementProps = {
  group: DisplayedGroup;
};

export const Accountsmanagement: FC<AccountsmanagementProps> = ({ group }) => {
  const [isRenameWalletPopupOpen, setIsRenameWalletPopupOpen] = useState(false);

  const handleModalClose = useCallback(() => {
    setIsRenameWalletPopupOpen(false);
  }, []);

  const handleRenameClick = useCallback(() => {
    setIsRenameWalletPopupOpen(true);
  }, []);

  return (
    <>
      <WalletCardDropdown handleRenameClick={handleRenameClick} />
      {isRenameWalletPopupOpen && <EditWalletGroupNamePopup group={group} opened close={handleModalClose} />}
    </>
  );
};
