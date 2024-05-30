import React, { FC, Fragment, Suspense, useCallback, useMemo, useState } from 'react';

import clsx from 'clsx';

import { Alert, FormSubmitButton } from 'app/atoms';
import { AlertWithCollapse } from 'app/atoms/Alert';
import ConfirmLedgerOverlay from 'app/atoms/ConfirmLedgerOverlay';
import Spinner from 'app/atoms/Spinner/Spinner';
import ErrorBoundary from 'app/ErrorBoundary';
import { useWindowDimensions } from 'app/hooks/use-window-dimensions';
import ContentContainer from 'app/layouts/ContentContainer';
import Unlock from 'app/pages/Unlock/Unlock';
import AccountBanner from 'app/templates/AccountBanner';
import { ModifyFeeAndLimit } from 'app/templates/ExpensesView/ExpensesView';
import NetworkBanner from 'app/templates/NetworkBanner';
import OperationsBanner from 'app/templates/OperationsBanner/OperationsBanner';
import OperationView from 'app/templates/OperationView';
import { CustomRpcContext } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useRetryableSWR } from 'lib/swr';
import { useTempleClient, useAccount, useRelevantAccounts, useChainIdValue } from 'lib/temple/front';
import { TempleAccountType, TempleDAppPayload, TempleChainId } from 'lib/temple/types';
import { useSafeState } from 'lib/ui/hooks';
import { delay } from 'lib/utils';
import { Link, useLocation } from 'lib/woozie';

import Divider from '../atoms/Divider';
import { ButtonRounded } from '../molecules/ButtonRounded';

import { AccountDropdown } from './components/AccountDropdown';
import { ConfirmPageSelectors } from './ConfirmPage.selectors';

const APP_POPUP_LIMIT = 604;
const APP_POPUP_WIDTH_LIMIT = 400;
const APP_POPUP_VALUE_WITH_TOPBAR = 576;

const ConfirmPage: FC = () => {
  const { ready } = useTempleClient();

  if (ready)
    return (
      <ContentContainer
        padding={false}
        className="min-h-screen flex flex-col items-center justify-center max-w-screen-xs overflow-x-hidden"
      >
        <ErrorBoundary whileMessage={t('fetchingConfirmationDetails')}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-screen">
                <div>
                  <Spinner theme="primary" className="w-20" />
                </div>
              </div>
            }
          >
            <ConfirmDAppForm />
          </Suspense>
        </ErrorBoundary>
      </ContentContainer>
    );

  return <Unlock canImportNew={false} />;
};

interface PayloadContentProps {
  accountPkhToConnect: string;
  setAccountPkhToConnect: (item: string) => void;
  payload: TempleDAppPayload;
  error?: any;
  modifyFeeAndLimit: ModifyFeeAndLimit;
}

const PayloadContent: React.FC<PayloadContentProps> = ({
  accountPkhToConnect,
  setAccountPkhToConnect,
  payload,
  error,
  modifyFeeAndLimit
}) => {
  const chainId = useChainIdValue(payload.networkRpc, true)!;
  const mainnet = chainId === TempleChainId.Atlas;

  return payload.type === 'connect' ? (
    <div className="w-full flex flex-col">
      <h2 className="mb-3 flex flex-col">
        <span className="mt-px text-base-plus text-white max-w-9/10">
          <T id="chooseAccToConnectMsg" />
        </span>
      </h2>

      <AccountDropdown accountPkhToConnect={accountPkhToConnect} setAccountPkhToConnect={setAccountPkhToConnect} />
    </div>
  ) : (
    <OperationView
      payload={payload}
      error={error}
      networkRpc={payload.networkRpc}
      mainnet={mainnet}
      modifyFeeAndLimit={modifyFeeAndLimit}
    />
  );
};

export default ConfirmPage;

const ConfirmDAppForm: FC = () => {
  const { getDAppPayload, confirmDAppPermission, confirmDAppOperation, confirmDAppSign } = useTempleClient();
  const allAccounts = useRelevantAccounts(false);
  const account = useAccount();

  const { height } = useWindowDimensions();

  const [accountPkhToConnect, setAccountPkhToConnect] = useState(account.publicKeyHash);

  const loc = useLocation();
  const id = useMemo(() => {
    const usp = new URLSearchParams(loc.search);
    const pageId = usp.get('id');
    if (!pageId) {
      throw new Error(t('notIdentified'));
    }
    return pageId;
  }, [loc.search]);

  const { data } = useRetryableSWR<TempleDAppPayload, unknown, string>(id, getDAppPayload, {
    suspense: true,
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const payload = data!;
  const payloadError = data!.error;

  const connectedAccount = useMemo(
    () =>
      allAccounts.find(a => a.publicKeyHash === (payload.type === 'connect' ? accountPkhToConnect : payload.sourcePkh)),
    [payload, allAccounts, accountPkhToConnect]
  );

  const onConfirm = useCallback(
    async (confimed: boolean, modifiedTotalFee?: number, modifiedStorageLimit?: number) => {
      switch (payload.type) {
        case 'connect':
          return confirmDAppPermission(id, confimed, accountPkhToConnect);

        case 'confirm_operations':
          return confirmDAppOperation(id, confimed, modifiedTotalFee, modifiedStorageLimit);

        case 'sign':
          return confirmDAppSign(id, confimed);
      }
    },
    [id, payload.type, confirmDAppPermission, confirmDAppOperation, confirmDAppSign, accountPkhToConnect]
  );

  const [error, setError] = useSafeState<any>(null);
  const [confirming, setConfirming] = useSafeState(false);
  const [declining, setDeclining] = useSafeState(false);

  const revealFee = useMemo(() => {
    if (
      payload.type === 'confirm_operations' &&
      payload.estimates &&
      payload.estimates.length === payload.opParams.length + 1
    ) {
      return payload.estimates[0].suggestedFeeMumav;
    }

    return 0;
  }, [payload]);

  const [modifiedTotalFeeValue, setModifiedTotalFeeValue] = useSafeState(
    (payload.type === 'confirm_operations' &&
      payload.opParams.reduce((sum, op) => sum + (op.fee ? +op.fee : 0), 0) + revealFee) ||
      0
  );
  const [modifiedStorageLimitValue, setModifiedStorageLimitValue] = useSafeState(
    (payload.type === 'confirm_operations' && payload.opParams[0].storageLimit) || 0
  );

  const confirm = useCallback(
    async (confirmed: boolean) => {
      setError(null);
      try {
        await onConfirm(confirmed, modifiedTotalFeeValue - revealFee, modifiedStorageLimitValue);
      } catch (err: any) {
        console.error(err);

        // Human delay.
        await delay();
        setError(err);
      }
    },
    [onConfirm, setError, modifiedTotalFeeValue, modifiedStorageLimitValue, revealFee]
  );

  const handleConfirmClick = useCallback(async () => {
    if (confirming || declining) return;

    setConfirming(true);
    await confirm(true);
    setConfirming(false);
  }, [confirming, declining, setConfirming, confirm]);

  const handleDeclineClick = useCallback(async () => {
    if (confirming || declining) return;

    setDeclining(true);
    await confirm(false);
    setDeclining(false);
  }, [confirming, declining, setDeclining, confirm]);

  const handleErrorAlertClose = useCallback(() => setError(null), [setError]);

  const content = useMemo(() => {
    switch (payload.type) {
      case 'connect':
        return {
          title: t('confirmAction', t('connection').toLowerCase()),
          declineActionTitle: t('cancel'),
          declineActionTestID: ConfirmPageSelectors.ConnectAction_CancelButton,
          confirmActionTitle: error ? t('retry') : t('connect'),
          confirmActionTestID: error
            ? ConfirmPageSelectors.ConnectAction_RetryButton
            : ConfirmPageSelectors.ConnectAction_ConnectButton,
          want: (
            <div className="w-full px-4 pt-4 pb-2 text-base-plus text-center text-white flex flex-col items-center">
              <T
                id="appWouldLikeToConnectToYourWallet"
                substitutions={[
                  <Fragment key="appName">
                    <Link to={payload.origin} className="max-w-80 text-blue-200 overflow-x-auto truncate" key="origin">
                      {payload.origin}
                    </Link>
                  </Fragment>
                ]}
              />
            </div>
          )
        };

      case 'confirm_operations':
        return {
          title: t('confirmAction', t('operation').toLowerCase()),
          declineActionTitle: t('reject'),
          declineActionTestID: ConfirmPageSelectors.ConfirmOperationsAction_RejectButton,
          confirmActionTitle: error ? t('retry') : t('confirm'),
          confirmActionTestID: error
            ? ConfirmPageSelectors.ConfirmOperationsAction_RetryButton
            : ConfirmPageSelectors.ConfirmOperationsAction_ConfirmButton,
          want: (
            <div className="p-4 text-base-plus text-center text-white flex flex-col items-center">
              <T
                id="appRequestOperationToYou"
                substitutions={[
                  <Link to={payload.origin} className="max-w-80 text-blue-200 overflow-x-auto truncate" key="origin">
                    {payload.origin}
                  </Link>
                ]}
              />
            </div>
          )
        };

      case 'sign':
        return {
          title: t('confirmAction', t('signAction').toLowerCase()),
          declineActionTitle: t('reject'),
          declineActionTestID: ConfirmPageSelectors.SignAction_RejectButton,
          confirmActionTitle: t('signAction'),
          confirmActionTestID: ConfirmPageSelectors.SignAction_SignButton,
          want: (
            <div className="p-4 text-base-plus text-center text-white flex flex-col items-center">
              <T
                id="appRequestsToSign"
                substitutions={[
                  <Link to={payload.origin} className="max-w-80 text-blue-200 overflow-x-auto truncate" key="origin">
                    {payload.origin}
                  </Link>
                ]}
              />
            </div>
          )
        };
    }
  }, [payload.type, payload.origin, error]);

  const modifiedStorageLimitDisplayed = useMemo(
    () => payload.type === 'confirm_operations' && payload.opParams.length < 2,
    [payload]
  );

  const modifyFeeAndLimit = useMemo<ModifyFeeAndLimit>(
    () => ({
      totalFee: modifiedTotalFeeValue,
      onTotalFeeChange: v => setModifiedTotalFeeValue(v),
      storageLimit: modifiedStorageLimitDisplayed ? modifiedStorageLimitValue : null,
      onStorageLimitChange: v => setModifiedStorageLimitValue(v)
    }),
    [
      modifiedTotalFeeValue,
      setModifiedTotalFeeValue,
      modifiedStorageLimitValue,
      setModifiedStorageLimitValue,
      modifiedStorageLimitDisplayed
    ]
  );

  return (
    <CustomRpcContext.Provider value={payload.networkRpc}>
      <div
        className={clsx(
          'relative h-full bg-primary-bg shadow-md overflow-y-auto flex flex-col no-scrollbar overflow-x-hidden',
          height > APP_POPUP_LIMIT && 'border border-divider'
        )}
        style={{
          width: APP_POPUP_WIDTH_LIMIT,
          height: height < APP_POPUP_LIMIT ? APP_POPUP_VALUE_WITH_TOPBAR : APP_POPUP_LIMIT
        }}
      >
        <div className="bg-primary-card text-xl leading-6 tracking-tight text-white p-4 flex items-center justify-center w-full capitalize">
          {content.title}
        </div>
        <div className="flex flex-col items-center px-8 w-full relative pb-4">
          {content.want}

          {payload.type === 'connect' && (
            <p className="mb-4 text-sm text-center text-secondary-white max-w-80">
              <T id="viewAccountAddressWarning" />
            </p>
          )}

          {error ? (
            <Alert
              closable
              onClose={handleErrorAlertClose}
              type="error"
              title="Error"
              description={error?.message ?? t('smthWentWrong')}
              className="my-4"
              autoFocus
            />
          ) : (
            <>
              <Divider color="bg-divider" className="mb-4" />
              <NetworkBanner rpc={payload.networkRpc} />
              {payload.type !== 'connect' && connectedAccount && (
                <AccountBanner
                  account={connectedAccount}
                  networkRpc={payload.networkRpc}
                  labelIndent="sm"
                  className="w-full mb-4"
                  restrictAccountSelect
                />
              )}

              {payloadError && (
                <AlertWithCollapse
                  wrapperClassName="w-full mb-4 mt-0"
                  title={
                    <span>
                      <T id="attention" />!
                    </span>
                  }
                  description={
                    <span>
                      <T id="txIsLikelyToFail" />
                    </span>
                  }
                >
                  <OperationsBanner className="mb-0" copyButtonClassName="p-2" opParams={payloadError ?? {}} />
                </AlertWithCollapse>
              )}

              <PayloadContent
                error={payloadError}
                payload={payload}
                accountPkhToConnect={accountPkhToConnect}
                setAccountPkhToConnect={setAccountPkhToConnect}
                modifyFeeAndLimit={modifyFeeAndLimit}
              />
            </>
          )}
        </div>
        <div className="flex-1" />

        <div className="sticky bottom-0 w-full bg-primary-bg shadow-md flex items-stretch py-4 px-8 border-t border-divider">
          <div className="w-1/2 pr-2">
            <ButtonRounded
              type="button"
              size="big"
              className="w-full"
              isLoading={declining}
              disabled={declining}
              fill={false}
              onClick={handleDeclineClick}
              testID={content.declineActionTestID}
              testIDProperties={{ operationType: payload.type }}
            >
              <T id="cancel" />
            </ButtonRounded>
          </div>

          <div className="w-1/2 pl-2">
            <FormSubmitButton
              type="button"
              className="justify-center w-full"
              loading={confirming}
              onClick={handleConfirmClick}
              testID={content.confirmActionTestID}
              testIDProperties={{ operationType: payload.type }}
            >
              <T id={error ? 'retry' : 'confirm'} />
            </FormSubmitButton>
          </div>
        </div>
        <ConfirmLedgerOverlay displayed={confirming && connectedAccount?.type === TempleAccountType.Ledger} />
      </div>
    </CustomRpcContext.Provider>
  );
};
