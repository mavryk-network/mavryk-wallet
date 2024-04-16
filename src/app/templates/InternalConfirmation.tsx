import React, { FC, useCallback, useEffect, useMemo } from 'react';

import { localForger } from '@mavrykdynamics/taquito-local-forging';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { useDispatch } from 'react-redux';

import { Alert, FormSubmitButton } from 'app/atoms';
import { AlertWithCollapse } from 'app/atoms/Alert';
import ConfirmLedgerOverlay from 'app/atoms/ConfirmLedgerOverlay';
import { useAppEnv } from 'app/env';
import { ReactComponent as CodeAltIcon } from 'app/icons/code-alt.svg';
import { ReactComponent as EyeIcon } from 'app/icons/eye.svg';
import { ReactComponent as HashIcon } from 'app/icons/hash.svg';
import { ContentPaper, Toolbar } from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { setOnRampPossibilityAction } from 'app/store/settings/actions';
import AccountBanner from 'app/templates/AccountBanner';
import ExpensesView, { ModifyFeeAndLimit } from 'app/templates/ExpensesView/ExpensesView';
import NetworkBanner from 'app/templates/NetworkBanner';
import OperationsBanner from 'app/templates/OperationsBanner/OperationsBanner';
import RawPayloadView from 'app/templates/RawPayloadView';
import { ViewsSwitcherItemProps } from 'app/templates/ViewsSwitcher/ViewsSwitcherItem';
import { MAV_TOKEN_SLUG, toTokenSlug } from 'lib/assets';
import { useBalance } from 'lib/balances';
import { T, t } from 'lib/i18n';
import { useRetryableSWR } from 'lib/swr';
import { useChainIdValue, useNetwork, useRelevantAccounts, tryParseExpenses } from 'lib/temple/front';
import { MAV_RPC_NETWORK } from 'lib/temple/networks';
import { TempleAccountType, TempleChainId, TempleConfirmationPayload } from 'lib/temple/types';
import { useSafeState } from 'lib/ui/hooks';
import { isTruthy } from 'lib/utils';

import { InternalConfirmationSelectors } from './InternalConfirmation.selectors';
import { ModifyFeeAndLimitComponent } from './ModifyFeeAndLimit';
import TabsSwitcher from './TabsSwicther/TabsSwitcher';

type InternalConfiramtionProps = {
  payload: TempleConfirmationPayload;
  onConfirm: (confirmed: boolean, modifiedTotalFee?: number, modifiedStorageLimit?: number) => Promise<void>;
  error?: any;
};

const MIN_GAS_FEE = 0;
const bytesStyle = { height: 112, background: '#171717', border: 'none' };

const InternalConfirmation: FC<InternalConfiramtionProps> = ({ payload, onConfirm, error: payloadError }) => {
  const { rpcBaseURL: currentNetworkRpc } = useNetwork();
  const { popup } = useAppEnv();
  const dispatch = useDispatch();

  const getContentToParse = useCallback(async () => {
    switch (payload.type) {
      case 'operations':
        return payload.opParams || [];
      case 'sign':
        const unsignedBytes = payload.bytes.substr(0, payload.bytes.length - 128);
        try {
          return (await localForger.parse(unsignedBytes)) || [];
        } catch (err: any) {
          console.error(err);
          return [];
        }
      default:
        return [];
    }
  }, [payload]);
  const { data: contentToParse } = useRetryableSWR(['content-to-parse'], getContentToParse, { suspense: true });

  const networkRpc = payload.type === 'operations' ? payload.networkRpc : currentNetworkRpc;

  const chainId = useChainIdValue(networkRpc, true)!;
  const mainnet = chainId === TempleChainId.Atlas;

  const allAccounts = useRelevantAccounts();
  const account = useMemo(
    () => allAccounts.find(a => a.publicKeyHash === payload.sourcePkh)!,
    [allAccounts, payload.sourcePkh]
  );
  const rawExpensesData = useMemo(
    () => tryParseExpenses(contentToParse!, account.publicKeyHash),
    [contentToParse, account.publicKeyHash]
  );
  const expensesData = useMemo(() => {
    return rawExpensesData.map(({ expenses, ...restProps }) => ({
      expenses: expenses.map(({ tokenAddress, tokenId, ...restProps }) => ({
        assetSlug: tokenAddress ? toTokenSlug(tokenAddress, tokenId) : 'mav',
        ...restProps
      })),
      ...restProps
    }));
  }, [rawExpensesData]);

  const estimates = payload.type === 'operations' ? payload.estimates : undefined;

  const { value: tezBalanceData } = useBalance(MAV_TOKEN_SLUG, account.publicKeyHash);
  const tezBalance = tezBalanceData!;

  const totalTransactionCost = useMemo(() => {
    if (payload.type === 'operations') {
      return payload.opParams.reduce(
        (accumulator, currentOpParam) => accumulator.plus(currentOpParam.amount),
        new BigNumber(0)
      );
    }

    return new BigNumber(0);
  }, [payload]);

  useEffect(() => {
    if (tezBalance && new BigNumber(tezBalance).isLessThanOrEqualTo(totalTransactionCost)) {
      dispatch(setOnRampPossibilityAction(true));
    }
  }, [dispatch, tezBalance, totalTransactionCost]);

  const isStorageDataHidden = useMemo(
    () =>
      payload.type === 'operations' &&
      payload.opParams[0].kind === 'transaction' &&
      payload.networkRpc === MAV_RPC_NETWORK,
    [payload]
  );

  const signPayloadFormats: ViewsSwitcherItemProps[] = useMemo(() => {
    if (payload.type === 'operations') {
      const previewItem = {
        key: 'preview',
        name: t('preview'),
        Icon: EyeIcon,
        testID: InternalConfirmationSelectors.previewTab
      };

      if (isStorageDataHidden) {
        return [previewItem];
      }
      return [
        previewItem,
        {
          key: 'raw',
          name: t('raw'),
          Icon: CodeAltIcon,
          testID: InternalConfirmationSelectors.rawTab
        },
        payload.bytesToSign && {
          key: 'bytes',
          name: t('bytes'),
          Icon: HashIcon,
          testID: InternalConfirmationSelectors.bytesTab
        }
      ].filter(isTruthy);
    }

    return [
      {
        key: 'preview',
        name: t('preview'),
        Icon: EyeIcon,
        testID: InternalConfirmationSelectors.previewTab
      },
      {
        key: 'bytes',
        name: t('bytes'),
        Icon: HashIcon,
        testID: InternalConfirmationSelectors.bytesTab
      }
    ];
  }, [payload]);

  const [spFormat, setSpFormat] = useSafeState(signPayloadFormats[0]);
  const [error, setError] = useSafeState<any>(null);
  const [confirming, setConfirming] = useSafeState(false);
  const [declining, setDeclining] = useSafeState(false);

  const revealFee = useMemo(() => {
    if (
      payload.type === 'operations' &&
      payload.estimates &&
      payload.estimates.length === payload.opParams.length + 1
    ) {
      return payload.estimates[0].suggestedFeeMumav;
    }

    return 0;
  }, [payload]);

  const [modifiedTotalFeeValue, setModifiedTotalFeeValue] = useSafeState(
    (payload.type === 'operations' &&
      payload.opParams &&
      payload.opParams.reduce((sum, op) => sum + (op.fee ? +op.fee : 0), 0) + revealFee) ||
      0
  );
  const [modifiedStorageLimitValue, setModifiedStorageLimitValue] = useSafeState(
    (payload.type === 'operations' && payload.opParams && payload.opParams[0].storageLimit) || 0
  );

  const gasFeeError = useMemo(() => modifiedTotalFeeValue <= MIN_GAS_FEE, [modifiedTotalFeeValue]);

  const confirm = useCallback(
    async (confirmed: boolean) => {
      setError(null);

      try {
        await onConfirm(confirmed, modifiedTotalFeeValue - revealFee, modifiedStorageLimitValue);
      } catch (err) {
        console.error(err);
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

  const modifiedStorageLimitDisplayed = useMemo(
    () => payload.type === 'operations' && payload.opParams && payload.opParams.length < 2,
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
    <div
      className={classNames(
        'h-full w-full mx-auto flex flex-col relative overflow-x-hidden no-scrollbar flex-1',
        !popup && 'justify-center px-2',
        popup ? 'max-w-sm' : 'w-screen-xs flex-1'
      )}
      style={{ maxHeight: popup ? 'auto' : '664px' }}
    >
      <ContentPaper>
        <Toolbar pageTitle={<T id="confirmOperation" />} />

        <div
          className={classNames(
            'flex flex-col relative bg-primary-bg text-white shadow-md no-scrollbar',
            popup ? 'px-4 pt-4' : 'pt-8 px-20 flex-1'
          )}
          style={{ height: '34rem', maxHeight: popup ? 'auto' : '552px' }}
        >
          <div>
            {error ? (
              <Alert
                closable
                onClose={handleErrorAlertClose}
                type="error"
                title={t('error')}
                description={error?.message ?? t('smthWentWrong')}
                className="my-4"
                autoFocus
              />
            ) : (
              <div>
                <NetworkBanner
                  rpc={payload.type === 'operations' ? payload.networkRpc : currentNetworkRpc}
                  narrow={false}
                />
                <AccountBanner account={account} labelIndent="sm" className="w-full mb-4" restrictAccountSelect />

                {payloadError && (
                  <AlertWithCollapse
                    wrapperClassName="mb-4"
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

                {signPayloadFormats && (
                  <>
                    <div className="w-full flex justify-end mb-3">
                      <span className="mr-2 text-base-plus text-white">
                        <T id="operation" />
                      </span>
                      <div className="flex-1" />
                    </div>
                  </>
                )}

                {signPayloadFormats.length > 1 && (
                  <>
                    <TabsSwitcher activeItem={spFormat} items={signPayloadFormats} onChange={setSpFormat} />
                  </>
                )}

                {payload.type === 'operations' && spFormat.key === 'raw' && (
                  <OperationsBanner
                    opParams={payload.rawToSign ?? payload.opParams}
                    jsonViewStyle={signPayloadFormats.length > 1 ? { height: 'auto' } : undefined}
                    modifiedTotalFee={modifiedTotalFeeValue}
                    modifiedStorageLimit={modifiedStorageLimitValue}
                  />
                )}

                {payload.type === 'sign' && spFormat.key === 'bytes' && (
                  <>
                    <RawPayloadView
                      label={t('payloadToSign')}
                      payload={payload.bytes}
                      className="mb-4 px-4 py-4"
                      style={bytesStyle}
                    />
                  </>
                )}

                {payload.type === 'operations' && payload.bytesToSign && spFormat.key === 'bytes' && (
                  <>
                    <RawPayloadView payload={payload.bytesToSign} className="mb-4 px-4 py-4" style={bytesStyle} />
                  </>
                )}

                {spFormat.key === 'preview' && (
                  <ExpensesView
                    expenses={expensesData}
                    estimates={payload.type === 'operations' ? payload.estimates : undefined}
                    modifyFeeAndLimit={modifyFeeAndLimit}
                    mainnet={mainnet}
                    gasFeeError={gasFeeError}
                  />
                )}

                <ModifyFeeAndLimitComponent
                  expenses={expensesData}
                  estimates={estimates}
                  modifyFeeAndLimit={modifyFeeAndLimit}
                  mainnet={mainnet}
                  gasFeeError={gasFeeError}
                  includeStorageData={!isStorageDataHidden}
                  includeBurnedFee
                />
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div
            className={classNames(
              'sticky bottom-0 bg-primary-bg shadow-md flex items-stretch py-4',
              popup && ' w-full mx-auto',
              !popup && 'px-20 border-t border-divider'
            )}
            style={{ transform: !popup ? 'translateX(-80px)' : 'none', width: popup ? '100%' : '600px' }}
          >
            <div className="w-1/2 pr-2">
              <ButtonRounded
                type="button"
                size="big"
                className="w-full"
                isLoading={declining}
                disabled={declining}
                fill={false}
                onClick={handleDeclineClick}
                testID={InternalConfirmationSelectors.declineButton}
              >
                <T id="cancel" />
              </ButtonRounded>
            </div>

            <div className="w-1/2 pl-2">
              <FormSubmitButton
                type="button"
                className="justify-center w-full"
                disabled={gasFeeError}
                loading={confirming}
                onClick={handleConfirmClick}
                testID={error ? InternalConfirmationSelectors.retryButton : InternalConfirmationSelectors.confirmButton}
              >
                <T id={error ? 'retry' : 'confirm'} />
              </FormSubmitButton>
            </div>
          </div>

          <ConfirmLedgerOverlay displayed={confirming && account.type === TempleAccountType.Ledger} />
        </div>
      </ContentPaper>
    </div>
  );
};

export default InternalConfirmation;
