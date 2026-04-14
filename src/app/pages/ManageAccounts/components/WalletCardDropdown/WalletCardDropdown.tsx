import React, { FC, useCallback, useMemo } from 'react';

import clsx from 'clsx';
import { nanoid } from 'nanoid';

import { ReactComponent as PenIcon } from 'app/icons/edit-title.svg';
import { ReactComponent as EyeIcon } from 'app/icons/eye-open-secondary.svg';
import { ReactComponent as PlusIcon } from 'app/icons/plus.svg';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { ACCOUNT_EXISTS_SHOWN_WARNINGS_STORAGE_KEY } from 'lib/constants';
import { useStorage, useMavrykClient } from 'lib/temple/front';
import { useHDGroups } from 'lib/temple/front/ready';
import { DisplayedGroup, TempleAccount } from 'lib/temple/types';
import { useAlert } from 'lib/ui';
import { translateYModifiersNegative } from 'lib/ui/general-modifiers';
import { navigate } from 'lib/woozie';

type WalletCardDropdownProps = {
  group: DisplayedGroup;
  handleRenameClick: (group: DisplayedGroup) => void;
  showAccountAlreadyExistsWarning: (group: DisplayedGroup, oldAccount: TempleAccount) => void;
};

export const WalletCardDropdown: FC<WalletCardDropdownProps> = ({
  group,
  showAccountAlreadyExistsWarning,
  handleRenameClick
}) => {
  const { id: walletId } = group;
  const { createAccount, findFreeHdIndex } = useMavrykClient();
  const hdGroups = useHDGroups();
  const customAlert = useAlert();

  const [accountExistsShownWarnings, setAccountExistsShownWarnings] = useStorage<Record<string, boolean>>(
    ACCOUNT_EXISTS_SHOWN_WARNINGS_STORAGE_KEY,
    {}
  );

  const addAccount = useCallback(async () => {
    try {
      const { firstSkippedAccount } = await findFreeHdIndex(walletId);
      if (firstSkippedAccount && !accountExistsShownWarnings[walletId]) {
        showAccountAlreadyExistsWarning(group, firstSkippedAccount);
        setAccountExistsShownWarnings(prevState => ({
          ...Object.fromEntries(
            Object.entries(prevState).filter(([groupId]) => !hdGroups.some(({ id }) => id === groupId))
          ),
          [walletId]: true
        }));
      } else {
        await createAccount(walletId);
      }
    } catch (e: any) {
      console.error(e);
      customAlert({
        title: 'Failed to create an account',
        children: e.message
      });
    }
  }, [
    accountExistsShownWarnings,
    createAccount,
    customAlert,
    findFreeHdIndex,
    group,
    hdGroups,
    setAccountExistsShownWarnings,
    showAccountAlreadyExistsWarning,
    walletId
  ]);

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
        onClick: () => handleRenameClick(group)
      },
      {
        id: nanoid(),
        label: 'Reveal Seed Phrase',
        Icon: EyeIcon,
        onClick: revesalSeedPhrase
      }
    ],
    [addAccount, group, handleRenameClick, revesalSeedPhrase]
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
