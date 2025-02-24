import React, { ComponentProps, FC, Suspense } from 'react';

import 'lib/local-storage/migrations';
import 'lib/lock-up/run-checks';
import 'lib/ledger/proxy/foreground';
import 'lib/keep-bg-worker-alive/script';

import AwaitFonts from 'app/a11y/AwaitFonts';
import AwaitI18N from 'app/a11y/AwaitI18N';
import BootAnimation from 'app/a11y/BootAnimation';
import DisableOutlinesForClick from 'app/a11y/DisableOutlinesForClick';
import RootSuspenseFallback from 'app/a11y/RootSuspenseFallback';
import ConfirmPage from 'app/ConfirmPage';
import { AppEnvProvider } from 'app/env';
import ErrorBoundary from 'app/ErrorBoundary';
import Dialogs from 'app/layouts/Dialogs';
import { PageRouter } from 'app/PageRouter';
import { TempleProvider } from 'lib/temple/front';
import { TzktConnectionProvider } from 'lib/temple/front/tzkt-connection';
import { DialogsProvider } from 'lib/ui/dialog';
import * as Woozie from 'lib/woozie';

// import { LoadHypelabScript } from './load-hypelab-script';
import { StoreProvider } from './store/provider';

interface Props extends React.PropsWithChildren {
  env: ComponentProps<typeof AppEnvProvider>;
}

export const App: FC<Props> = ({ env }) => (
  <ErrorBoundary whileMessage="booting a wallet" className="min-h-screen">
    <DialogsProvider>
      <Suspense fallback={<RootSuspenseFallback />}>
        <AppProvider env={env}>
          <Dialogs />

          <DisableOutlinesForClick />

          <AwaitI18N />

          <AwaitFonts name="Aeonik" weights={[300, 400, 500, 600]} className="antialiased font-aeonik">
            <BootAnimation>{env.confirmWindow ? <ConfirmPage /> : <PageRouter />}</BootAnimation>
          </AwaitFonts>
        </AppProvider>
      </Suspense>
    </DialogsProvider>
  </ErrorBoundary>
);

const AppProvider: FC<Props> = ({ children, env }) => (
  <AppEnvProvider {...env}>
    <StoreProvider>
      <Woozie.Provider>
        <TempleProvider>
          <TzktConnectionProvider>{children}</TzktConnectionProvider>
        </TempleProvider>
      </Woozie.Provider>
    </StoreProvider>
  </AppEnvProvider>
);
