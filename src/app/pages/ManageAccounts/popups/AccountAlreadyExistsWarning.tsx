import React, { memo, useMemo } from 'react';

import {
  ActionModal,
  ActionModalBodyContainer,
  ActionModalButton,
  ActionModalButtonsContainer
} from 'app/atoms/ActionModal';
import { T } from 'lib/i18n';
import { useHDGroups } from 'lib/temple/front/ready';
import { DisplayedGroup, TempleAccount } from 'lib/temple/types';
import { getAllGroups } from 'mavryk/front/accounts-groups';

interface AccountAlreadyExistsWarningProps {
  newAccountGroup: DisplayedGroup;
  oldAccount: TempleAccount;
  onClose: EmptyFn;
}

export const AccountAlreadyExistsWarning = memo<AccountAlreadyExistsWarningProps>(
  ({ newAccountGroup, oldAccount, onClose }) => {
    const hdGroups = useHDGroups();
    const oldAccountGroupName = useMemo(() => getAllGroups(hdGroups, [oldAccount])[0].name, [hdGroups, oldAccount]);

    return (
      <ActionModal title={<T id="addAccount" />} hasCloseButton={false} onClose={onClose}>
        <ActionModalBodyContainer>
          <span className="w-full text-center text-font-description text-grey-1">
            <T id="accountAlreadyExistsWarning" substitutions={[newAccountGroup.name, oldAccountGroupName]} />
          </span>
        </ActionModalBodyContainer>
        <ActionModalButtonsContainer>
          <ActionModalButton color="primary" type="button" onClick={onClose}>
            <T id="okGotIt" />
          </ActionModalButton>
        </ActionModalButtonsContainer>
      </ActionModal>
    );
  }
);
