import React, { ComponentProps, FC, useCallback, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';

import { Name, Divider } from 'app/atoms';
import { Switcher } from 'app/atoms/Switcher';
import { useAppEnv } from 'app/env';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import CustomSelect, { OptionRenderProps } from 'app/templates/CustomSelect';
import DAppLogo from 'app/templates/DAppLogo';
import { TID, T, t } from 'lib/i18n';
import { useRetryableSWR } from 'lib/swr';
import { useTempleClient, useStorage } from 'lib/temple/front';
import { TempleSharedStorageKey, TempleDAppSession, TempleDAppSessions } from 'lib/temple/types';
import { useConfirm } from 'lib/ui/dialog';

type DAppEntry = [string, TempleDAppSession];
type DAppActions = {
  remove: (origin: string) => void;
};

const getDAppKey = (entry: DAppEntry) => entry[0];

const DAppSettings: FC = () => {
  const { getAllDAppSessions, removeDAppSession, removeAllDAppSessions } = useTempleClient();
  const confirm = useConfirm();
  const { popup } = useAppEnv();

  const { data, mutate } = useRetryableSWR<TempleDAppSessions>(['getAllDAppSessions'], getAllDAppSessions, {
    suspense: true,
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });
  const dAppSessions = data!;

  const [dAppEnabled, setDAppEnabled] = useStorage(TempleSharedStorageKey.DAppEnabled, true);

  const changingRef = useRef(false);
  const [error, setError] = useState<any>(null);

  const dAppEntries = useMemo(() => Object.entries(dAppSessions), [dAppSessions]);

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
          title: t('deleteDapp'),
          children: t('resetPermissionsConfirmation', origin),
          comfirmButtonText: t('delete')
        })
      ) {
        await removeDAppSession(origin);
        mutate();
      }
    },
    [removeDAppSession, mutate, confirm]
  );

  const handleRemoveAllClick = useCallback(async () => {
    if (
      await confirm({
        title: t('actionConfirmation'),
        children: t('resetPermissionsConfirmation', origin)
      })
    ) {
      const origins = dAppEntries.map(([origin]) => origin);
      await removeAllDAppSessions(origins);
      mutate();
    }

    // mutate();
  }, [confirm, dAppEntries, mutate, removeAllDAppSessions]);

  return (
    <div className={clsx('w-full h-full', popup && 'pb-8 max-w-sm mx-auto')}>
      <p className="text-sm text-secondary-white mb-4">
        <T id="dAppsCheckmarkPrompt" />
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white tracking-normal">
          <T id="dAppsInteraction" />
        </span>

        <Switcher on={dAppEnabled} onChange={handleChange} />
        {error?.message && <div className="text-sm text-primary-error my-1">{error.message}</div>}
      </div>
      <Divider ignoreParent={!popup} className="my-4" color="bg-divider" />

      <div className="text-base-plus text-white mb-4">
        <T id="authorizedDApps" />
      </div>
      {dAppEntries.length > 0 && (
        <div className={clsx('flex-grow flex flex-col', popup && 'pb-8')}>
          <div style={{ height: 290 }} className="no-scrollbar mb-6">
            <CustomSelect
              actions={{ remove: handleRemoveClick }}
              getItemId={getDAppKey}
              items={dAppEntries}
              OptionIcon={DAppIcon}
              OptionContent={DAppDescription}
              light
              hoverable={false}
              padding={'8px 0 8px 0'}
            />
          </div>
          <ButtonRounded onClick={handleRemoveAllClick} className="w-full" size="big">
            <T id="disconnectAll" />
          </ButtonRounded>
        </div>
      )}
    </div>
  );
};

export default DAppSettings;

const DAppIcon: FC<OptionRenderProps<DAppEntry, string, DAppActions>> = props => (
  <DAppLogo
    className="flex-none ml-2 mr-3 rounded-full"
    style={{ alignSelf: 'flex-start' }}
    origin={props.item[0]}
    size={44}
  />
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
            className={clsx('text-blue-200 hover:underline', className)}
          >
            <Name {...rest} />
          </a>
        )
      }
      // {
      //   key: 'networkLabel',
      //   value: typeof network === 'string' ? network : network.name || network.rpc,
      //   valueClassName: (typeof network === 'string' || network.name) && 'capitalize',
      //   Component: Name
      // },
      // {
      //   key: 'pkhLabel',
      //   value: <HashChip hash={pkh} type="link" small />,
      //   Component: 'span'
      // }
    ],
    [origin, network, pkh]
  );

  return (
    <div className="flex flex-1 w-full">
      <div className="flex flex-col justify-between flex-1">
        <Name className="text-base-plus text-left" style={{ maxWidth: '14rem' }}>
          {appMeta.name}
        </Name>

        {dAppAttributes.map(({ key, value, valueClassName, Component }) => (
          <div className="text-sm font-light leading-tight text-gray-600" key={key}>
            <T
              id={key}
              substitutions={[
                <Component
                  key={key}
                  className={clsx('font-normal text-sm inline-flex', valueClassName)}
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
        className={clsx('flex-none p-2', 'text-white hover:text-gray-600', 'transition ease-in-out duration-200')}
        onClick={handleRemoveClick}
      >
        <CloseIcon className="w-auto h-5 stroke-current stroke-2" title={t('delete')} />
      </button>
    </div>
  );
};
