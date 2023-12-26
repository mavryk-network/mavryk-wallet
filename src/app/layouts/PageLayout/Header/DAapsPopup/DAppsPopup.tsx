import React, { ComponentProps, FC, useCallback, useMemo, useRef, useState } from 'react';

import classNames from 'clsx';

import { Name, FormCheckbox, HashChip } from 'app/atoms';
import { Dropdown, DropdownHeader, DropdownOpened } from 'app/compound/CustomDropdown';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import CustomSelect, { OptionRenderProps } from 'app/templates/CustomSelect';
import DAppLogo from 'app/templates/DAppLogo';
import { TID, T, t } from 'lib/i18n';
import { useRetryableSWR } from 'lib/swr';
import { useTempleClient, useStorage } from 'lib/temple/front';
import { TempleSharedStorageKey, TempleDAppSession, TempleDAppSessions } from 'lib/temple/types';
import { useConfirm } from 'lib/ui/dialog';

type DAppsPopupProps = {
  opened: boolean;
  setOpened: (v: boolean) => void;
};

// export const DAppsPopup: FC<DAppsPopupProps> = ({ opened, setOpened }) => {
export const DAppsPopup: FC<DAppsPopupProps> = () => {
  // const { getAllDAppSessions, removeDAppSession } = useTempleClient();
  // const confirm = useConfirm();

  // const { data, mutate } = useRetryableSWR<TempleDAppSessions>(['getAllDAppSessions'], getAllDAppSessions, {
  //   suspense: true,
  //   shouldRetryOnError: false,
  //   revalidateOnFocus: false,
  //   revalidateOnReconnect: false
  // });
  // const dAppSessions = data!;

  // const [dAppEnabled, setDAppEnabled] = useStorage(TempleSharedStorageKey.DAppEnabled, true);

  // const changingRef = useRef(false);
  // const [error, setError] = useState<any>(null);

  // const handleChange = useCallback(
  //   async (checked: boolean) => {
  //     if (changingRef.current) return;
  //     changingRef.current = true;
  //     setError(null);

  //     setDAppEnabled(checked).catch((err: any) => setError(err));

  //     changingRef.current = false;
  //   },
  //   [setError, setDAppEnabled]
  // );

  // const handleRemoveClick = useCallback(
  //   async (origin: string) => {
  //     if (
  //       await confirm({
  //         title: t('actionConfirmation'),
  //         children: t('resetPermissionsConfirmation', origin)
  //       })
  //     ) {
  //       await removeDAppSession(origin);
  //       mutate();
  //     }
  //   },
  //   [removeDAppSession, mutate, confirm]
  // );

  // const dAppEntries = useMemo(() => Object.entries(dAppSessions), [dAppSessions]);
  return (
    <section className="my-2 px-4 pb-8">
      <Divider />
      <Dropdown>
        <>
          <DropdownHeader header={t('connectedSites')} subHeader={t('connectedSitesDesc')} />
          <DropdownOpened>
            <div className="text-white text-lg">content</div>
          </DropdownOpened>
        </>
      </Dropdown>
    </section>
  );
};

const Divider = () => {
  return <div className="w-full h-[1px] bg-divider my-4" />;
};
