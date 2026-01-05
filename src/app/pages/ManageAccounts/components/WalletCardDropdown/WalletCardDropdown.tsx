import React, { FC, useCallback, useMemo } from 'react';

import clsx from 'clsx';
import { nanoid } from 'nanoid';

import { ReactComponent as PenIcon } from 'app/icons/edit-title.svg';
import { ReactComponent as EyeIcon } from 'app/icons/eye-open-secondary.svg';
import { ReactComponent as PlusIcon } from 'app/icons/plus.svg';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { t } from 'lib/i18n';
import { useAllAccounts, useTempleClient } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { translateYModifiers } from 'lib/ui/general-modifiers';

export const WalletCardDropdown: FC = () => {
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

  const addAccount = useCallback(async () => {
    try {
      await createAccount(defaultName);
    } catch (err: any) {
      console.error(err);
    }
  }, [createAccount, defaultName]);

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
        disabled: true
      },
      {
        id: nanoid(),
        label: 'Reveal Seed Phrase',
        Icon: EyeIcon,
        disabled: true
        // onClick: handleMaximiseViewClick
      }
    ],
    [addAccount]
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
        poperModifiers={translateYModifiers}
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
