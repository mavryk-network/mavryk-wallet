import React, { FC, useCallback, useMemo } from 'react';

import { openInFullPage, useAppEnv } from 'app/env';
import { ReactComponent as BlocksSvgIcon } from 'app/icons/blocks.svg';
import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { ReactComponent as ExitSvgIcon } from 'app/icons/exit.svg';
import { ReactComponent as ExtendSvgIcon } from 'app/icons/extend.svg';
import { ReactComponent as LinkSvgIcon } from 'app/icons/external-link.svg';
import { ReactComponent as SettingsScgIcon } from 'app/icons/settings.svg';
import { ReactComponent as SupportSvgIcon } from 'app/icons/support.svg';
import { T, TID } from 'lib/i18n';
import { Link } from 'lib/woozie';

type SettingsPopupProps = {
  closePopup: () => void;
};

export const SettingsPopup: FC<SettingsPopupProps> = ({ closePopup }) => {
  const appEnv = useAppEnv();

  const handleMaximiseViewClick = useCallback(() => {
    openInFullPage();
    if (appEnv.popup) {
      window.close();
    } else {
      closePopup();
    }
  }, [appEnv.popup, closePopup]);

  const settingsListData: SettingsListitemProps[] = useMemo(
    () => [
      {
        accountDetails: 'accountDetails',
        linkTo: null,
        Icon: BlocksSvgIcon,
        i18nKey: 'accountDetails',
        onClick: closePopup
      },
      {
        key: 'viewOnBlockExplorer',
        linkTo: null,
        Icon: LinkSvgIcon,
        i18nKey: 'viewOnBlockExplorer',
        onClick: closePopup
      },
      {
        key: 'expandView',
        linkTo: null,
        Icon: ExtendSvgIcon,
        i18nKey: 'expandView',
        onClick: handleMaximiseViewClick
      },
      {
        key: 'support',
        linkTo: null,
        Icon: SupportSvgIcon,
        i18nKey: 'support',
        onClick: closePopup
      },
      {
        key: 'settings',
        linkTo: '/settings',
        Icon: SettingsScgIcon,
        i18nKey: 'settings',
        onClick: closePopup
      },
      {
        key: 'logout',
        linkTo: null,
        Icon: ExitSvgIcon,
        i18nKey: 'logout',
        onClick: closePopup
      }
    ],
    [closePopup, handleMaximiseViewClick]
  );
  return (
    <div className="text-white mt-4 flex flex-col">
      {settingsListData.map(item => (
        <SettingsListitem {...item} />
      ))}
    </div>
  );
};

type SettingsListitemProps = {
  Icon: ImportedSVGComponent;
  linkTo: string | null;
  i18nKey: TID;
  onClick: () => void;
};

const SettingsListitem: FC<SettingsListitemProps> = ({ Icon, i18nKey, onClick, linkTo }) => {
  const baseProps = {
    className:
      'py-4 px-4 flex items-center justify-between border-b border-divider cursor-pointer hover:bg-primary-card-hover',
    onClick,
    children: (
      <>
        <div className="flex items-center">
          <Icon className="w-6 h-6 fill-white mr-2" />
          <span className="text-base-plus">
            <T id={i18nKey} />
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4" />
      </>
    )
  };

  return linkTo ? <Link {...baseProps} to={linkTo} /> : <div {...baseProps} />;
};
