import React, { CSSProperties, FC, useMemo, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as AddAccountIcon } from 'app/icons/account-card-add.svg';
import { ReactComponent as ImportAccountIcon } from 'app/icons/account-card-import.svg';
import { ReactComponent as RestoreAccountIcon } from 'app/icons/account-card-restore.svg';
import PageLayout from 'app/layouts/PageLayout';
import { ReactComponent as LedgerIcon } from 'app/misc/ledger.svg';
import { T, TID } from 'lib/i18n';
import { useRelevantAccounts } from 'lib/temple/front';
import { useAccount, useHDGroups } from 'lib/temple/front/ready';
import { TempleAccountType } from 'lib/temple/types';
import { Link } from 'lib/woozie';
import { useAccountsGroups } from 'mavryk/front/groups';

type BtnRoute = {
  key: string;
  i18nKey: TID;
  description: string;
  linkTo?: string;
  onClick?: EmptyFn;
  disabled?: boolean;
  tags?: TID[];
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  theme: {
    accentColor: string;
    borderColor: string;
    hoverColor: string;
  };
};

const BADGE_COPY_STYLE: CSSProperties = {
  letterSpacing: '-0.24px',
  lineHeight: '12px'
};

const BADGE_STYLE: CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.15)'
};

const baseCardClassName =
  'w-full rounded-lg border p-4 text-left transition duration-200 ease-in-out focus:outline-none';

const getCardStyle = (route: BtnRoute, isHovered: boolean): CSSProperties => ({
  backgroundColor: '#010101',
  borderColor: isHovered ? route.theme.hoverColor : route.theme.borderColor,
  boxShadow: isHovered ? `0 0 4px ${route.theme.hoverColor}` : 'none',
  opacity: route.disabled ? 0.6 : 1
});

export const AddOrImportAccount: FC = () => {
  const { popup } = useAppEnv();
  const currentAccount = useAccount();
  const allAccounts = useRelevantAccounts();
  const hdGroups = useHDGroups();
  const groups = useAccountsGroups(allAccounts);

  const [hoveredRouteKey, setHoveredRouteKey] = useState<string | null>(null);

  const currentWalletId = useMemo(
    () => (currentAccount.type === TempleAccountType.HD ? currentAccount.walletId : hdGroups[0]?.id),
    [currentAccount, hdGroups]
  );

  const currentGroup = useMemo(() => groups.find(group => group.id === currentWalletId), [currentWalletId, groups]);

  const buttonRoutes = useMemo<BtnRoute[]>(
    () => [
      {
        key: 'add-account',
        i18nKey: 'addNewAccount',
        description:
          'Create a new sub-account linked to your current wallet. Perfect for organising funds or separating activities.',
        linkTo: '/create-account',
        disabled: !currentWalletId || !currentGroup,
        Icon: AddAccountIcon,
        theme: {
          accentColor: '#AB58FF',
          borderColor: 'rgba(171, 88, 255, 0.5)',
          hoverColor: 'rgba(171, 88, 255, 0.75)'
        }
      },
      {
        key: 'import-account',
        i18nKey: 'importAccount',
        description: 'Bring in an account you already use on another platform or device.',
        linkTo: '/import-account',
        tags: ['privateKey', 'seedPhrase', 'fundraiser', 'managedKTAccount', 'watchOnlyAccount'],
        Icon: ImportAccountIcon,
        theme: {
          accentColor: '#F958FF',
          borderColor: 'rgba(249, 88, 255, 0.5)',
          hoverColor: 'rgba(249, 88, 255, 0.75)'
        }
      },
      {
        key: 'restore-account',
        i18nKey: 'restoreAccount',
        description: 'Recover an account you no longer have access to using your backup credentials.',
        linkTo: '/import-wallet',
        tags: ['seedPhrase', 'keystoreFile'],
        Icon: RestoreAccountIcon,
        theme: {
          accentColor: '#58BFFF',
          borderColor: 'rgba(88, 191, 255, 0.5)',
          hoverColor: 'rgba(88, 191, 255, 0.75)'
        }
      },
      {
        key: 'connect-ledger',
        i18nKey: 'connectLedger',
        description: 'Connect a Ledger hardware wallet and keep transaction signing on your device.',
        linkTo: '/connect-ledger',
        tags: ['ledger'],
        Icon: LedgerIcon,
        theme: {
          accentColor: '#4B5567',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          hoverColor: 'rgba(148, 163, 184, 0.6)'
        }
      }
    ],
    [currentGroup, currentWalletId]
  );

  return (
    <PageLayout pageTitle={<T id="addOrImportAccount" />} isTopbarVisible={false}>
      <div
        className={clsx('w-full mx-auto h-full flex flex-col justify-start', popup ? 'max-w-sm' : 'max-w-screen-xxs')}
      >
        <p className="mb-4 text-sm text-cleanWhite leading-none">
          <T id="addOrImportAccountDescfiption" />
        </p>
        <div className="flex flex-col gap-3 items-stretch pb-4">
          {buttonRoutes.map(route => (
            <AddOrImportAccountCard
              key={route.key}
              route={route}
              hovered={hoveredRouteKey === route.key}
              onHoverChange={setHoveredRouteKey}
            />
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

type AddOrImportAccountCardProps = {
  route: BtnRoute;
  hovered: boolean;
  onHoverChange: (routeKey: string | null) => void;
};

const AddOrImportAccountCard: FC<AddOrImportAccountCardProps> = ({ route, hovered, onHoverChange }) => {
  const content = (
    <>
      <div
        className="mb-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: route.theme.accentColor }}
      >
        <route.Icon className="h-6 w-6 text-cleanWhite" />
      </div>

      <div className="flex flex-col gap-2 w-full">
        <p className="text-sm font-bold text-cleanWhite leading-none capitalize">
          <T id={route.i18nKey} />
        </p>

        <p className="text-sm text-cleanWhite leading-none">{route.description}</p>

        {route.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {route.tags.map(tag => (
              <span key={tag} className="rounded px-1 py-0.5 text-cleanWhite" style={BADGE_STYLE}>
                <span className="text-xs" style={BADGE_COPY_STYLE}>
                  <T id={tag} />
                </span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );

  const commonProps = {
    className: clsx(baseCardClassName, 'flex flex-col items-start', route.disabled && 'cursor-not-allowed'),
    onMouseEnter: () => onHoverChange(route.key),
    onMouseLeave: () => onHoverChange(null),
    onFocus: () => onHoverChange(route.key),
    onBlur: () => onHoverChange(null),
    style: getCardStyle(route, hovered)
  };

  if (route.linkTo) {
    return (
      <Link to={route.linkTo} {...commonProps}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" {...commonProps} onClick={route.onClick} disabled={route.disabled}>
      {content}
    </button>
  );
};
