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

type DAppEntry = [string, TempleDAppSession];
type DAppActions = {
  remove: (origin: string) => void;
};

const getDAppKey = (entry: DAppEntry) => entry[0];

// export const DAppsPopup: FC<DAppsPopupProps> = ({ opened, setOpened }) => {
export const DAppsPopup: FC<DAppsPopupProps> = () => {
  const { getAllDAppSessions, removeDAppSession } = useTempleClient();
  const confirm = useConfirm();

  // NOTE  connected - all, active - if current acc === connected site acc
  const { data, mutate } = useRetryableSWR<TempleDAppSessions>(['getAllDAppSessions'], getAllDAppSessions, {
    suspense: true,
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });
  const dAppSessions = data!;
  console.log(dAppSessions, 'dAppSessions');
  console.log(window.location, 'location');

  const [dAppEnabled, setDAppEnabled] = useStorage(TempleSharedStorageKey.DAppEnabled, true);

  const changingRef = useRef(false);
  const [error, setError] = useState<any>(null);

  const handleChange = useCallback(
    async (checked: boolean) => {
      if (changingRef.current) return;
      changingRef.current = true;
      setError(null);

      setDAppEnabled(checked).catch((err: any) => setError(err));

      changingRef.current = false;
    },
    [setError, setDAppEnabled]
  );

  const handleRemoveClick = useCallback(
    async (origin: string) => {
      if (
        await confirm({
          title: t('actionConfirmation'),
          children: t('resetPermissionsConfirmation', origin)
        })
      ) {
        await removeDAppSession(origin);
        mutate();
      }
    },
    [removeDAppSession, mutate, confirm]
  );

  const dAppEntries = useMemo(() => Object.entries(dAppSessions), [dAppSessions]);
  return (
    <section className="my-2 px-4 pb-8">
      <Divider />
      <Dropdown>
        <>
          <DropdownHeader
            header={t('connectedSites')}
            subHeader={t('connectedSitesDesc')}
            disabled={dAppEntries.length <= 0}
          />
          <DropdownOpened>
            <CustomSelect
              actions={{ remove: handleRemoveClick }}
              className="mb-6"
              getItemId={getDAppKey}
              items={dAppEntries}
              OptionIcon={DAppIcon}
              OptionContent={DAppDescription}
              light
              hoverable={false}
            />
          </DropdownOpened>
        </>
      </Dropdown>
    </section>
  );
};

const Divider = () => {
  return <div className="w-full h-[1px] bg-divider my-4" />;
};

const DAppIcon: FC<OptionRenderProps<DAppEntry, string, DAppActions>> = props => (
  <DAppLogo className="flex-none ml-2 mr-1 my-1" style={{ alignSelf: 'flex-start' }} origin={props.item[0]} size={36} />
);

const DAppDescription: FC<OptionRenderProps<DAppEntry, string, DAppActions>> = props => {
  const {
    actions,
    item: [origin, { appMeta, network, pkh }]
  } = props;
  const { remove: onRemove } = actions!;

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.stopPropagation();
      onRemove(origin);
    },
    [onRemove, origin]
  );

  interface TDAppAttribute {
    key: TID;
    value: React.ReactNode;
    valueClassName?: string;
    Component: React.FC | keyof JSX.IntrinsicElements;
  }

  const dAppAttributes = useMemo(
    (): TDAppAttribute[] => [
      {
        key: 'originLabel',
        value: origin,
        Component: ({ className, ...rest }: ComponentProps<typeof Name>) => (
          <a
            href={origin}
            target="_blank"
            rel="noopener noreferrer"
            className={classNames('text-blue-700 hover:underline', className)}
          >
            <Name {...rest} />
          </a>
        )
      },
      {
        key: 'networkLabel',
        value: typeof network === 'string' ? network : network.name || network.rpc,
        valueClassName: (typeof network === 'string' || network.name) && 'capitalize',
        Component: Name
      },
      {
        key: 'pkhLabel',
        value: <HashChip hash={pkh} type="link" small />,
        Component: 'span'
      }
    ],
    [origin, network, pkh]
  );

  return (
    <div className="flex flex-1 w-full">
      <div className="flex flex-col justify-between flex-1">
        <Name className="mb-1 text-sm font-medium leading-tight text-left" style={{ maxWidth: '14rem' }}>
          {appMeta.name}
        </Name>

        {dAppAttributes.map(({ key, value, valueClassName, Component }) => (
          <div className="text-xs font-light leading-tight text-gray-600" key={key}>
            <T
              id={key}
              substitutions={[
                <Component
                  key={key}
                  className={classNames('font-normal text-sm inline-flex', valueClassName)}
                  style={{ maxWidth: '10rem' }}
                >
                  {value}
                </Component>
              ]}
            />
          </div>
        ))}
      </div>

      <button
        className={classNames(
          'flex-none p-2',
          'text-gray-500 hover:text-gray-600',
          'transition ease-in-out duration-200'
        )}
        onClick={handleRemoveClick}
      >
        <CloseIcon className="w-auto h-5 stroke-current stroke-2" title={t('delete')} />
      </button>
    </div>
  );
};
