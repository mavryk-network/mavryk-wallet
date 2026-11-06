import React, { ComponentType, FC, useEffect, useLayoutEffect, useMemo } from 'react';

import RootSuspenseFallback from 'app/a11y/RootSuspenseFallback';
import { OpenInFullPage, useAppEnv } from 'app/env';
// import { Buy } from 'app/pages/Buy/Buy';
// import Exolix from 'app/pages/Buy/Crypto/Exolix/Exolix';
// import { BuyWithCreditCard } from 'app/pages/BuyWithCreditCard/BuyWithCreditCard';
import Home from 'app/pages/Home/Home';
// import AttentionPage from 'app/pages/Onboarding/pages/AttentionPage';
// import { Swap } from 'app/pages/Swap/Swap';
import Unlock from 'app/pages/Unlock/Unlock';
import Welcome from 'app/pages/Welcome/Welcome';
// import { AliceBobWithdraw } from 'app/pages/Withdraw/Debit/AliceBob/AliceBobWithdraw';
// import { Withdraw } from 'app/pages/Withdraw/Withdraw';
import { usePageRouterAnalytics } from 'lib/analytics';
// import { Notifications, NotificationsItem } from 'lib/notifications/components';
import { useTempleClient } from 'lib/temple/front';
import { lazyPage, preloadLazyPagesOnIdle } from 'lib/ui/lazy-page';
import * as Woozie from 'lib/woozie';

import { WithDataLoading } from './WithDataLoading';

// First screens (Unlock, Home with /explore, Welcome) stay eager; every other page loads on demand.
const lazyRoute = <P extends object>(load: () => Promise<ComponentType<P>>) => lazyPage(load, RootSuspenseFallback);

const AddAsset = lazyRoute(() => import('app/pages/AddAsset/AddAsset').then(m => m.default));
const NFTsPage = lazyRoute(() => import('app/pages/Collectibles/CollectiblePage').then(m => m.default));
const ConnectLedger = lazyRoute(() => import('app/pages/ConnectLedger/ConnectLedger').then(m => m.default));
const CreateAccount = lazyRoute(() => import('app/pages/CreateAccount/CreateAccount').then(m => m.default));
const DApps = lazyRoute(() => import('app/pages/DApps').then(m => m.default));
const ImportAccount = lazyRoute(() => import('app/pages/ImportAccount').then(m => m.default));
const ManageAssets = lazyRoute(() => import('app/pages/ManageAssets/ManageAssets').then(m => m.default));
const CreateWallet = lazyRoute(() => import('app/pages/NewWallet/CreateWallet').then(m => m.CreateWallet));
const ImportWallet = lazyRoute(() => import('app/pages/NewWallet/ImportWallet').then(m => m.ImportWallet));
const Receive = lazyRoute(() => import('app/pages/Receive/Receive').then(m => m.default));
const Send = lazyRoute(() => import('app/pages/Send').then(m => m.default));
const Settings = lazyRoute(() => import('app/pages/Settings/Settings').then(m => m.default));
const AddNetworkScreen = lazyRoute(() => import('./pages/AddNetwork/AddNetwork').then(m => m.AddNetworkScreen));
const AddOrImportAccount = lazyRoute(() => import('./pages/AddOrImportAccount').then(m => m.AddOrImportAccount));
const CoStake = lazyRoute(() => import('./pages/CoStake/CoStake').then(m => m.CoStake));
const EditAccount = lazyRoute(() => import('./pages/EditAccount').then(m => m.EditAccount));
const ManageAccounts = lazyRoute(() => import('./pages/ManageAccounts/ManageAccounts').then(m => m.ManageAccounts));
const ManageStake = lazyRoute(() => import('./pages/ManageStake/ManageStake').then(m => m.ManageStake));
const Onboarding = lazyRoute(() => import('./pages/Onboarding/Onboarding').then(m => m.default));
const ProVersion = lazyRoute(() => import('./pages/ProVersion/ProVersion').then(m => m.ProVersion));
const RWAPage = lazyRoute(() => import('./pages/RWAs/RWAPage').then(m => m.default));
const Stake = lazyRoute(() => import('./pages/Stake/Stake').then(m => m.Stake));
const SuccessScreen = lazyRoute(() => import('./pages/SuccessScreen/SuccessScreen').then(m => m.SuccessScreen));

/** Preloaded on idle once the wallet is ready, likely next routes first, so navigation renders without a fallback. */
const READY_PAGES_PRELOAD_ORDER = [
  Send,
  Receive,
  Settings,
  NFTsPage,
  RWAPage,
  ManageAssets,
  AddAsset,
  Stake,
  CoStake,
  ManageStake,
  AddOrImportAccount,
  CreateAccount,
  ImportAccount,
  ConnectLedger,
  EditAccount,
  ManageAccounts,
  AddNetworkScreen,
  DApps,
  ProVersion,
  SuccessScreen,
  Onboarding
];

/** Preloaded on idle while no wallet exists (Welcome). */
const NOT_READY_PAGES_PRELOAD_ORDER = [ImportWallet, CreateWallet];

interface RouteContext {
  popup: boolean;
  fullPage: boolean;
  ready: boolean;
  locked: boolean;
}

type RouteFactory = Woozie.ResolveResult<RouteContext>;

const ROUTE_MAP = Woozie.createMap<RouteContext>([
  [
    '/import-wallet/:tabSlug?',
    (p, ctx) => {
      switch (true) {
        case ctx.ready && ctx.locked:
          return Woozie.SKIP;

        case !ctx.fullPage && ctx.locked:
          return <OpenInFullPage />;

        default:
          return <ImportWallet ownMnemonic={!ctx.fullPage} key={p.tabSlug ?? ''} tabSlug={p.tabSlug ?? undefined} />;
      }
    }
  ],
  [
    '*',
    (_p, ctx) => {
      switch (true) {
        case ctx.locked:
          return <Unlock />;

        case !ctx.ready && !ctx.fullPage:
          return <OpenInFullPage />;

        default:
          return Woozie.SKIP;
      }
    }
  ],
  ['/loading', (_p, ctx) => (ctx.ready ? <Woozie.Redirect to={'/'} /> : <RootSuspenseFallback />)],
  ['/', (_p, ctx) => (ctx.ready ? <Home /> : <Welcome />)],
  ['/explore/:assetSlug?', onlyReady(({ assetSlug }) => <Home assetSlug={assetSlug} />)],
  ['/create-wallet', onlyNotReady(onlyInFullPage(() => <CreateWallet />))],
  ['/add-or-import-account', onlyReady(() => <AddOrImportAccount />)],
  ['/create-account', onlyReady(() => <CreateAccount />)],
  ['/edit-account/:accHash', onlyReady(({ accHash }) => <EditAccount accHash={accHash} />)],
  ['/import-account/:tabSlug?', onlyReady(({ tabSlug }) => <ImportAccount tabSlug={tabSlug} />)],
  ['/connect-ledger', onlyReady(() => <ConnectLedger />)],
  ['/receive', onlyReady(() => <Receive />)],
  ['/send/:assetSlug?', onlyReady(({ assetSlug }) => <Send assetSlug={assetSlug} />)],
  // ['/swap', onlyReady(() => <Swap />)],
  ['/pro-version', onlyReady(() => <ProVersion />)],
  ['/stake/:assetType?', onlyReady(() => <Stake />)],
  ['/co-stake/:assetType?', onlyReady(() => <CoStake />)],
  ['/manage-stake/:tabSlug?', onlyReady(() => <ManageStake />)],
  ['/dapps', onlyReady(() => <DApps />)],
  ['/manage-assets/:assetType?', onlyReady(({ assetType }) => <ManageAssets assetType={assetType!} />)],
  ['/nft/:assetSlug?', onlyReady(({ assetSlug }) => <NFTsPage assetSlug={assetSlug!} />)],
  ['/rwa/:assetSlug?', onlyReady(({ assetSlug }) => <RWAPage assetSlug={assetSlug!} />)],
  ['/add-asset', onlyReady(() => <AddAsset />)],
  ['/settings/:tabSlug?', onlyReady(({ tabSlug }) => <Settings tabSlug={tabSlug} />)],
  ['/add-network', onlyReady(() => <AddNetworkScreen />)],
  ['/manage-accounts', onlyReady(() => <ManageAccounts />)],
  // ['/buy', onlyReady(onlyInFullPage(() => <Buy />))],
  // ['/buy/crypto/exolix', onlyReady(onlyInFullPage(() => <Exolix />))],
  // ['/buy/debit', onlyReady(onlyInFullPage(() => <BuyWithCreditCard />))],
  // ['/withdraw', onlyReady(onlyInFullPage(() => <Withdraw />))],
  // ['/withdraw/debit/alice-bob', onlyReady(onlyInFullPage(() => <AliceBobWithdraw />))],
  // ['/attention', onlyReady(onlyInFullPage(() => <AttentionPage />))],
  ['/onboarding', onlyReady(onlyInFullPage(() => <Onboarding />))],
  // ['/notifications', onlyReady(() => <Notifications />)],
  // ['/notifications/:id', onlyReady(({ id }) => <NotificationsItem id={Number(id) ?? 0} />)],
  ['/success', onlyReady(() => <SuccessScreen />)],
  ['*', () => <Woozie.Redirect to="/" />]
]);

export const PageRouter: FC = () => {
  const { trigger, pathname, search } = Woozie.useLocation();

  // Scroll to top after new location pushed.
  useLayoutEffect(() => {
    if (trigger === Woozie.HistoryAction.Push) {
      window.scrollTo(0, 0);
    }

    if (pathname === '/') {
      Woozie.resetHistoryPosition();
    }
  }, [trigger, pathname]);

  const appEnv = useAppEnv();
  const temple = useTempleClient();

  const ctx = useMemo<RouteContext>(
    () => ({
      popup: appEnv.popup,
      fullPage: appEnv.fullPage,
      ready: temple.ready,
      locked: temple.locked
    }),
    [appEnv.popup, appEnv.fullPage, temple.ready, temple.locked]
  );

  usePageRouterAnalytics(pathname, search, ctx.ready);

  // Warms lazy page modules on idle after the first screen; nothing to preload while locked. Cleanup stops
  // scheduling further pages when readiness changes (a page that already started loading finishes in the module cache).
  useEffect(() => {
    if (ctx.locked) return undefined;

    return preloadLazyPagesOnIdle(ctx.ready ? READY_PAGES_PRELOAD_ORDER : NOT_READY_PAGES_PRELOAD_ORDER);
  }, [ctx.ready, ctx.locked]);

  return useMemo(() => {
    const routedElement = Woozie.resolve(ROUTE_MAP, pathname, ctx);

    return ctx.ready ? <WithDataLoading>{routedElement}</WithDataLoading> : routedElement;
  }, [pathname, ctx]);
};

function onlyReady(factory: RouteFactory): RouteFactory {
  return (params, ctx) => (ctx.ready ? factory(params, ctx) : Woozie.SKIP);
}

function onlyNotReady(factory: RouteFactory): RouteFactory {
  return (params, ctx) => (ctx.ready ? Woozie.SKIP : factory(params, ctx));
}

function onlyInFullPage(factory: RouteFactory): RouteFactory {
  return (params, ctx) => (!ctx.fullPage ? <OpenInFullPage /> : factory(params, ctx));
}
