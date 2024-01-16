import React, { FC, useCallback, useMemo } from 'react';

import { openInFullPage, useAppEnv } from 'app/env';
import { ReactComponent as BlocksSvgIcon } from 'app/icons/blocks.svg';
import { ReactComponent as ExitSvgIcon } from 'app/icons/exit.svg';
import { ReactComponent as ExtendSvgIcon } from 'app/icons/extend.svg';
import { ReactComponent as LinkSvgIcon } from 'app/icons/external-link.svg';
import { ReactComponent as SettingsScgIcon } from 'app/icons/settings.svg';
import { ReactComponent as SupportSvgIcon } from 'app/icons/support.svg';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';

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

  const settingsListData: ListItemWithNavigateprops[] = useMemo(
    () => [
      {
        key: 'accountDetails',
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
        onClick: closePopup,
        showDivider: false
      }
    ],
    [closePopup, handleMaximiseViewClick]
  );
  return (
    <div className="text-white mt-6 flex flex-col px-4">
      {settingsListData.map(item => (
        <ListItemWithNavigate {...item} />
      ))}
    </div>
  );
};
