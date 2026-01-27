import React, { FC, useCallback, useMemo } from 'react';

import clsx from 'clsx';
import { nanoid } from 'nanoid';

import { ReactComponent as PenIcon } from 'app/icons/edit-title.svg';
import { ReactComponent as EyeIcon } from 'app/icons/eye-open-secondary.svg';
import { ReactComponent as PlusIcon } from 'app/icons/plus.svg';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { usePopupState } from 'app/templates/PopupModalWithTitle/hooks/usePopupState';
import { t } from 'lib/i18n';
import { useAllAccounts, useTempleClient } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { translateYModifiersNegative } from 'lib/ui/general-modifiers';
import { navigate } from 'lib/woozie';

import { EditWalletGroupNamePopup } from '../../popups/EditWalletGroupNamePopup';

type WalletCardDropdownProps = {
  walletId: string;
  walletName: string;
};

export const WalletCardDropdown: FC<WalletCardDropdownProps> = ({ walletId, walletName }) => {
  const { createAccount } = useTempleClient();
  const allAccounts = useAllAccounts();

  const allHDOrImported = useMemo(
    () => allAccounts.filter(acc => [TempleAccountType.HD, TempleAccountType.Imported].includes(acc.type)),
    [allAccounts]
  );

  const defaultName = useMemo(
    () => t('defaultAccountName', String(allHDOrImported.length + 1)),
    [allHDOrImported.length]
  );

  const editWalletnameState = usePopupState(false);

  const addAccount = useCallback(async () => {
    try {
      await createAccount(walletId, defaultName);
    } catch (err: any) {
      console.error(err);
    }
  }, [createAccount, defaultName, walletId]);

  const revesalSeedPhrase = useCallback(() => {
    navigate<SuccessStateType>('/success', undefined, {
      pageTitle: 'revealSeedPhrase',
      btnText: 'proceedToReveal',
      btnLink: '/settings/reveal-seed-phrase',
      description: 'proceedToRevealMsg',
      subHeader: 'pleaseNote',
      iconType: 'warning'
    });
  }, []);

  const settingsListData: RenderOptionContentType[] = useMemo(
    () => [
      {
        id: nanoid(),
        Icon: PlusIcon,
        label: 'Add Account',
        onClick: addAccount
      },
      {
        id: nanoid(),
        label: 'Rename Wallet',
        Icon: PenIcon,
        onClick: editWalletnameState.open
      },
      {
        id: nanoid(),
        label: 'Reveal Seed Phrase',
        Icon: EyeIcon,
        onClick: revesalSeedPhrase
      }
    ],
    [addAccount, editWalletnameState.open, revesalSeedPhrase]
  );

  return (
    <>
      <DropdownSelect
        dropdownWrapperClassName={clsx('border border-divider bg-primary-card rounded-2xl-plus w-auto')}
        optionsListClassName="bg-primary-card w-auto py-2"
        dropdownButtonClassName="bg-transparent gap-0 w-auto"
        fontContentWrapperClassname="border-none bg-transparent"
        DropdownFaceContent={<Dots />}
        showIcon={false}
        poperModifiers={translateYModifiersNegative}
        poperPlacement="bottom-end"
        optionsProps={{
          options: settingsListData,
          getKey: option => option.id,
          noItemsText: 'No Items',
          renderOptionContent: option => renderOptionContent(option),
          onOptionChange: option => option.onClick?.()
        }}
      />
      <EditWalletGroupNamePopup
        walletName={walletName}
        walletId={walletId}
        opened={editWalletnameState.opened}
        close={editWalletnameState.close}
      />
    </>
  );
};

const Dots = () => {
  return (
    <div className="h-6 flex items-center gap-1 cursor-pointer">
      {[0, 1, 2].map((_, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%'
          }}
          className="bg-current block"
        />
      ))}
    </div>
  );
};

type RenderOptionContentType = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  id: string;
  onClick?: () => void;
  disabled?: boolean;
};

const renderOptionContent = ({ Icon, label, disabled }: RenderOptionContentType) => {
  return (
    <div className={clsx('flex items-center gap-2 p-4', disabled && 'opacity-50 cursor-not-allowed')}>
      <Icon className={clsx('w-6 h-6', 'fill-white')} />
      <p className="text-white text-base-plus">{label}</p>
    </div>
  );
};
