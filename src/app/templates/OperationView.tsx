import React, { FC, useMemo, useState } from 'react';

import { ReactComponent as CodeAltIcon } from 'app/icons/code-alt.svg';
import { ReactComponent as EyeIcon } from 'app/icons/eye.svg';
import { ReactComponent as HashIcon } from 'app/icons/hash.svg';
import ExpensesView, { ModifyFeeAndLimit } from 'app/templates/ExpensesView/ExpensesView';
import OperationsBanner from 'app/templates/OperationsBanner/OperationsBanner';
import RawPayloadView from 'app/templates/RawPayloadView';
import { TEZ_TOKEN_SLUG, toTokenSlug } from 'lib/assets';
import { T, t } from 'lib/i18n';
import { tryParseExpenses, useAccount } from 'lib/temple/front';
import { TempleDAppOperationsPayload, TempleDAppSignPayload } from 'lib/temple/types';

import { ModifyFeeAndLimitComponent } from './ModifyFeeAndLimit';
import TabsSwitcher from './TabsSwicther/TabsSwitcher';

const MIN_GAS_FEE = 0;
const bytesStyle = { height: 112, background: '#171717', border: 'none' };

type OperationViewProps = {
  payload: TempleDAppOperationsPayload | TempleDAppSignPayload;
  networkRpc?: string;
  mainnet?: boolean;
  error?: any;
  modifyFeeAndLimit?: ModifyFeeAndLimit;
};

const OperationView: FC<OperationViewProps> = ({
  payload,
  error: payloadError,
  mainnet = false,
  modifyFeeAndLimit
}) => {
  const contentToParse = useMemo(() => {
    switch (payload.type) {
      case 'confirm_operations':
        return (payload.rawToSign ?? payload.opParams) || [];
      case 'sign':
        return payload.preview || [];
      default:
        return [];
    }
  }, [payload]);

  const rawExpensesData = useMemo(
    () => tryParseExpenses(contentToParse, payload.sourcePkh),
    [contentToParse, payload.sourcePkh]
  );

  const expensesData = useMemo(() => {
    return rawExpensesData.map(({ expenses, ...restRaw }) => ({
      expenses: expenses.map(({ tokenAddress, tokenId, ...restProps }) => ({
        assetSlug: tokenAddress ? toTokenSlug(tokenAddress, tokenId) : TEZ_TOKEN_SLUG,
        tokenAddress,
        tokenId,
        ...restProps
      })),
      ...restRaw
    }));
  }, [rawExpensesData]);

  const signPayloadFormats = useMemo(() => {
    const rawFormat = {
      key: 'raw',
      name: t('raw'),
      Icon: CodeAltIcon
    };
    const prettyViewFormats = [
      {
        key: 'preview',
        name: t('preview'),
        Icon: EyeIcon
      }
    ];

    if (payload.type === 'confirm_operations') {
      return [
        ...prettyViewFormats,
        rawFormat,
        ...(payload.bytesToSign
          ? [
              {
                key: 'bytes',
                name: t('bytes'),
                Icon: HashIcon
              }
            ]
          : [])
      ];
    }

    return [
      ...(rawExpensesData.length > 0 ? prettyViewFormats : []),
      rawFormat,
      {
        key: 'bytes',
        name: t('bytes'),
        Icon: HashIcon
      }
    ];
  }, [payload, rawExpensesData]);

  const [spFormat, setSpFormat] = useState(signPayloadFormats[0]);

  // derived state for confirm_operations data
  const estimates = payload.type === 'confirm_operations' ? payload.estimates : undefined;
  const gasFeeError = useMemo(() => (modifyFeeAndLimit?.totalFee ?? 0) <= MIN_GAS_FEE, [modifyFeeAndLimit]);

  return (
    <div className="w-full flex flex-col">
      {signPayloadFormats.length > 1 && (
        <div className="w-full flex justify-end mb-3">
          <span className="mr-2 text-base-plus text-white">
            <T id="operation" />
          </span>

          <div className="flex-1" />

          <TabsSwitcher activeItem={spFormat} items={signPayloadFormats} onChange={setSpFormat} />
        </div>
      )}

      {payload.type === 'confirm_operations' && spFormat.key === 'raw' && (
        <OperationsBanner
          opParams={payload.rawToSign ?? payload.opParams}
          jsonViewStyle={signPayloadFormats.length > 1 ? { height: 'auto' } : undefined}
          modifiedTotalFee={modifyFeeAndLimit?.totalFee}
          modifiedStorageLimit={modifyFeeAndLimit?.storageLimit ?? 0}
        />
      )}

      {payload.type === 'sign' && spFormat.key === 'bytes' && (
        <>
          <RawPayloadView
            label={t('payloadToSign')}
            payload={payload.payload}
            className="mb-4 px-4 py-4"
            style={bytesStyle}
          />
        </>
      )}

      {payload.type === 'confirm_operations' && payload.bytesToSign && spFormat.key === 'bytes' && (
        <>
          <RawPayloadView payload={payload.bytesToSign} className="mb-4 px-4 py-4" style={bytesStyle} />
        </>
      )}

      {spFormat.key === 'preview' && (
        <ExpensesView
          expenses={expensesData}
          estimates={payload.type === 'confirm_operations' ? payload.estimates : undefined}
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
        includeBurnedFee={true}
        hasStableGasFee={true}
      />
    </div>
  );
};

export default OperationView;
