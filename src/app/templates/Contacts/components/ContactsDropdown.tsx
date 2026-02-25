import React, { FC, ReactNode, useCallback, useMemo } from 'react';

import clsx from 'clsx';
import { nanoid } from 'nanoid';

import { FileExportWrapper, FileTransferProvider } from 'app/compound/FileTransfer';
import { useAppEnv } from 'app/env';
import { ReactComponent as ExportSvg } from 'app/icons/export.svg';
import { ReactComponent as ImportSvg } from 'app/icons/import.svg';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { usePopupState } from 'app/templates/PopupModalWithTitle/hooks/usePopupState';
import { T, t } from 'lib/i18n';
import { TempleContact } from 'lib/temple/types';
import { translateYModifiersNegative } from 'lib/ui/general-modifiers';
import { navigate } from 'lib/woozie';

import { ContactExportPopup } from '../popups/ContactExportPopup';

type ContactDropdownProps = {
  allContacts: TempleContact[];
};

type RenderOptionContentType = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string | ReactNode;
  id: string;
  onClick?: () => void;
  disabled?: boolean;
  isExport?: boolean;
};

export const ContactsDropdown: FC<ContactDropdownProps> = ({ allContacts }) => {
  const { open, opened, close } = usePopupState();
  const { popup } = useAppEnv();

  const handleImportContactClick = useCallback(() => {
    navigate('/settings/import-contacts');
  }, []);

  const settingsListData: RenderOptionContentType[] = useMemo(
    () => [
      {
        id: nanoid(),
        Icon: ImportSvg,
        label: t('importContacts'),
        onClick: handleImportContactClick
      },
      {
        id: nanoid(),
        label: t('exportContacts'),
        Icon: ExportSvg,
        isExport: true,
        disabled: allContacts.length === 0
      }
    ],
    [allContacts.length, handleImportContactClick]
  );

  const renderOption = useCallback(
    (option: RenderOptionContentType) => {
      const content = (
        <div className={clsx('flex items-center gap-2 p-4', option.disabled && 'opacity-50 cursor-not-allowed')}>
          <option.Icon className={clsx('w-6 h-6')} />
          <div className="text-white text-base-plus">{option.label}</div>
        </div>
      );

      if (!option.isExport) return content;

      return (
        <FileExportWrapper data={allContacts} suggestedFileName="contacts" onClick={open}>
          {content}
        </FileExportWrapper>
      );
    },
    [allContacts, open]
  );

  return (
    <FileTransferProvider>
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
          renderOptionContent: renderOption,
          onOptionChange: option => {
            if (!option.isExport) option.onClick?.();
          }
        }}
      />

      <PopupModalWithTitle
        isOpen={opened}
        onRequestClose={close}
        title={<T id="chooseFileType" />}
        portalClassName="contacts-export-popup"
        contentPosition={popup ? 'bottom' : 'center'}
      >
        <ContactExportPopup close={close} />
      </PopupModalWithTitle>
    </FileTransferProvider>
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
          className="text-white bg-current block"
        />
      ))}
    </div>
  );
};
