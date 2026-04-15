import React, { FC, useLayoutEffect, useMemo } from 'react';

import RootSuspenseFallback from 'app/a11y/RootSuspenseFallback';
import { OpenInFullPage, useAppEnv } from 'app/env';
import Home from 'app/pages/Home/Home';
import { CreateWallet } from 'app/pages/NewWallet/CreateWallet';
import { ImportWallet } from 'app/pages/NewWallet/ImportWallet';
import Unlock from 'app/pages/Unlock/Unlock';
import Welcome from 'app/pages/Welcome/Welcome';
import { usePageRouterAnalytics } from 'lib/analytics';
import { useWalletReady, useWalletLocked } from 'lib/temple/front';
import * as Woozie from 'lib/woozie';

import { WithDataLoading } from './WithDataLoading';

// Lazy-loaded pages — split into separate chunks, loaded on demand.
// Existing <Suspense> boundaries in PageLayout handle the loading fallback.
const AddAsset = React.lazy(() => import('app/pages/AddAsset/AddAsset'));
const NFTsPage = React.lazy(() => import('app/pages/Collectibles/CollectiblePage'));
const ConnectLedger = React.lazy(() => import('app/pages/ConnectLedger/ConnectLedger'));
const CreateAccount = React.lazy(() => import('app/pages/CreateAccount/CreateAccount'));
const DApps = React.lazy(() => import('app/pages/DApps'));
const ImportAccount = React.lazy(() => import('app/pages/ImportAccount'));
const ManageAssets = React.lazy(() => import('app/pages/ManageAssets/ManageAssets'));
const Receive = React.lazy(() => import('app/pages/Receive/Receive'));
const Send = React.lazy(() => import('app/pages/Send'));
const Settings = React.lazy(() => import('app/pages/Settings/Settings'));
const AddNetworkScreen = React.lazy(() =>
  import('./pages/AddNetwork/AddNetwork').then(m => ({ default: m.AddNetworkScreen }))
);
const AddOrImportAccount = React.lazy(() =>
  import('./pages/AddOrImportAccount').then(m => ({ default: m.AddOrImportAccount }))
);
const CoStake = React.lazy(() => import('./pages/CoStake/CoStake').then(m => ({ default: m.CoStake })));
const EditAccount = React.lazy(() => import('./pages/EditAccount').then(m => ({ default: m.EditAccount })));
const ManageAccounts = React.lazy(() =>
  import('./pages/ManageAccounts/ManageAccounts').then(m => ({ default: m.ManageAccounts }))
);
const ManageStake = React.lazy(() => import('./pages/ManageStake/ManageStake').then(m => ({ default: m.ManageStake })));
const Onboarding = React.lazy(() => import('./pages/Onboarding/Onboarding'));
const ProVersion = React.lazy(() => import('./pages/ProVersion/ProVersion').then(m => ({ default: m.ProVersion })));
const RWAPage = React.lazy(() => import('./pages/RWAs/RWAPage'));
const Stake = React.lazy(() => import('./pages/Stake/Stake').then(m => ({ default: m.Stake })));
const SuccessScreen = React.lazy(() =>
  import('./pages/SuccessScreen/SuccessScreen').then(m => ({ default: m.SuccessScreen }))
);

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
  const ready = useWalletReady();
  const locked = useWalletLocked();

  const ctx = useMemo<RouteContext>(
    () => ({
      popup: appEnv.popup,
      fullPage: appEnv.fullPage,
      ready,
      locked
    }),
    [appEnv.popup, appEnv.fullPage, ready, locked]
  );

  usePageRouterAnalytics(pathname, search, ctx.ready);

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
