import React, { FC, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import classNames from 'clsx';

import { Name } from 'app/atoms';
import { Dropdown, DropdownHeader, DropdownOpened } from 'app/compound/CustomDropdown';
import { useAppEnv } from 'app/env';
import { ReactComponent as LoadingSvg } from 'app/icons/loading.svg';
import CustomSelect, { OptionRenderProps } from 'app/templates/CustomSelect';
import DAppLogo from 'app/templates/DAppLogo';
import { TID, T, t } from 'lib/i18n';
import { useRetryableSWR } from 'lib/swr';
import { useRelevantAccounts, useTempleClient } from 'lib/temple/front';
import { TempleDAppSession, TempleDAppSessions } from 'lib/temple/types';

import { areUrlsContainSameHost, getActiveTabUrl } from './utils/activeTab';

// -----------------------Dapps context logic
type DappsContextType = {
  isLoading: boolean;
  activeDAppEntry: [string, TempleDAppSession] | undefined;
  getAccName: (activeDAppEntry: [string, TempleDAppSession]) => string;
  handleRemoveClick: (origin: string) => Promise<void>;
  dAppEntries: [string, TempleDAppSession][];
};

const dappsContext = createContext<DappsContextType>(undefined!);

export const DappsContext: FC<{ children: ReactNode }> = ({ children }) => {
  const { getAllDAppSessions, removeDAppSession } = useTempleClient();
  const allAccounts = useRelevantAccounts();

  // NOTE  connected - all, active - if current acc === connected site acc
  const { data, mutate, isLoading } = useRetryableSWR<TempleDAppSessions>(['getAllDAppSessions'], getAllDAppSessions, {
    suspense: false,
    shouldRetryOnError: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const dAppSessions = useMemo(() => data! ?? {}, [data]);

  const [activeUrl, setActiveUrl] = useState<string | undefined>('');

  const handleRemoveClick = useCallback(
    async (origin: string) => {
      await removeDAppSession(origin);
      mutate();
    },
    [removeDAppSession, mutate]
  );

  const dAppEntries = useMemo(() => Object.entries(dAppSessions), [dAppSessions]);

  const activeDAppEntry = useMemo(
    () => dAppEntries.find(entry => areUrlsContainSameHost(entry[0], activeUrl)),
    [activeUrl, dAppEntries]
  );

  const getAccName = useCallback(
    (activeDAppEntry: [string, TempleDAppSession]) => {
      return allAccounts.find(acc => acc.publicKeyHash === activeDAppEntry[1].pkh)?.name ?? t('unknownAccount');
    },
    [allAccounts]
  );

  useEffect(() => {
    getActiveTabUrl(u => setActiveUrl(u));
  }, []);

  const value = useMemo(
    () => ({ isLoading, activeDAppEntry, getAccName, handleRemoveClick, dAppEntries }),
    [activeDAppEntry, dAppEntries, getAccName, handleRemoveClick, isLoading]
  );
  return <dappsContext.Provider value={value}>{children}</dappsContext.Provider>;
};

export const useDappsContext = () => {
  const ctx = useContext(dappsContext);

  if (!ctx) {
    throw new Error('useDappsContext must be used within DappsContext');
  }

  return ctx;
};

// -----------------------------------------------
// Popup & components
type DAppsPopupProps = {
  opened: boolean;
  setOpened: (v: boolean) => void;
};

type DAppEntry = [string, TempleDAppSession];
type DAppActions = {
  remove: (origin: string) => void;
};

const getDAppKey = (entry: DAppEntry) => entry[0];

export const DAppsPopup: FC<DAppsPopupProps> = () => {
  const { popup } = useAppEnv();
  const { isLoading, activeDAppEntry, getAccName, handleRemoveClick, dAppEntries } = useDappsContext();

  if (isLoading)
    return (
      <div className="animate-spin flex justify-center items-center p-8">
        <LoadingSvg style={{ width: 24, height: 24 }} />
      </div>
    );

  return (
    <section className={classNames(popup ? 'px-4' : 'px-12')}>
      {activeDAppEntry && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-base-plus text-white">
              <T id="activeSites" />
            </div>
            <div className="text-sm text-secondary-white">{t('connectedAcc', getAccName(activeDAppEntry))}</div>
          </div>
          <CustomSelect
            actions={{ remove: handleRemoveClick }}
            getItemId={getDAppKey}
            items={[activeDAppEntry]}
            OptionIcon={DAppIcon}
            OptionContent={DAppDescription}
            hoverable={false}
            padding={'0.75rem 0'}
            activeItemId={activeDAppEntry[0]}
          />
        </div>
      )}
      <Divider />
      <Dropdown initialShowState={true}>
        <>
          <DropdownHeader
            header={t('connectedSites')}
            subHeader={t('connectedSitesDesc')}
            disabled={dAppEntries.length <= 0}
          />
          <DropdownOpened>
            <CustomSelect
              actions={{ remove: handleRemoveClick }}
              getItemId={getDAppKey}
              items={dAppEntries}
              OptionIcon={DAppIcon}
              OptionContent={DAppDescription}
              light
              hoverable={false}
              padding={'0.75rem 0'}
            />
          </DropdownOpened>
        </>
      </Dropdown>
    </section>
  );
};

const Divider = () => {
  return <div className="w-full border-t border-divider my-3" />;
};

const DAppIcon: FC<OptionRenderProps<DAppEntry, string, DAppActions>> = props => (
  <DAppLogo className="flex-none mr-1 rounded-full overflow-hidden" origin={props.item[0]} size={24} />
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
      // {
      //   key: 'originLabel',
      //   value: origin,
      //   Component: ({ className, ...rest }: ComponentProps<typeof Name>) => (
      //     <a
      //       href={origin}
      //       target="_blank"
      //       rel="noopener noreferrer"
      //       className={classNames('text-blue-700 hover:underline', className)}
      //     >
      //       <Name {...rest} />
      //     </a>
      //   )
      // },
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
        <a href={origin} target="_blank" rel="noreferrer">
          <Name className="text-base font-medium leading-tight text-left text-white" style={{ maxWidth: '14rem' }}>
            {appMeta.name}
          </Name>
        </a>

        {dAppAttributes.map(({ key, value, valueClassName, Component }) => (
          <div className="text-xs font-light leading-tight text-white" key={key}>
            <T
              id={key}
              substitutions={[
                <Component
                  key={key}
                  className={classNames('font-normal text-xs inline-flex', valueClassName)}
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
        className={classNames('text-base text-accent-blue', 'transition ease-in-out duration-200')}
        onClick={handleRemoveClick}
      >
        <T id="disconnect" />
      </button>
    </div>
  );
};
