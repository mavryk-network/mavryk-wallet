import React, { FC, ReactNode, useMemo } from 'react';

import clsx from 'clsx';

import { HashChip, Identicon, Money } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ReactComponent as ArrowDownSvg } from 'app/icons/arrow-down-v2.svg';
import { AssetIcon } from 'app/templates/AssetIcon';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { T, TID } from 'lib/i18n';
import { useAssetMetadata } from 'lib/metadata';
import { Baker, useKnownBaker } from 'lib/temple/front';

import styles from '../successScreen.module.css';

const ACTIVE_IN = 'ACTIVE_IN';
const ACTIVE_FOR = 'ACTIVE_FOR';

type ActivationLabelType = typeof ACTIVE_IN | typeof ACTIVE_FOR;

type ActivationlabelProps = {
  days: number;
  type: ActivationLabelType;
};

const delegationTextData = {
  delegate: {
    label: 'Delegation',
    descr: (
      <>
        The delegation will become active in&nbsp; <br className="hidden xxs:block" />
        ~21 days (7 network cycles). Once active, your stake will start supporting&nbsp;
        <br className="hidden xxs:block" />
        the validator. The first rewards are expected ~3 days after activation.
      </>
    )
  },
  reDelegate: {
    label: 'Re-Delegation',
    descr: (
      <>
        Your stake will become active and continue earning rewards&nbsp;
        <br className="hidden xxs:block" />
        once confirmed.
      </>
    )
  },
  stake: {
    label: 'Co-Stake',
    descr: <>Your MVRK will start generating rewards after 5 cycles (~15 days).</>
  },
  unlock: {
    label: 'Unlock',
    descr: <>Your stake will be available for finalization after 4 cycles (~12 days).</>
  },
  finalize: {
    label: 'Final Unlock',
    descr: <>Your funds will become available once confirmed.</>
  }
};

type DelegationType = 'delegate' | 'reDelegate' | 'stake' | 'unlock' | 'finalize';

export type DelegationOperationProps = {
  amount: number;
  assetSlug: string;
  validatorAddress: string;
  oldValidatorAddress?: string;
  hash: string;
  activeForXDays?: number;
  activeInYDays?: number;
} & { type: DelegationType };

export const DelegationOperation: FC<DelegationOperationProps> = props => {
  const {
    type,
    hash,
    amount,
    assetSlug,
    validatorAddress,
    activeForXDays = 20,
    activeInYDays = 20,
    oldValidatorAddress
  } = props;
  const { popup } = useAppEnv();
  const assetMetadata = useAssetMetadata(assetSlug ?? MAV_TOKEN_SLUG);

  const { data: baker } = useKnownBaker(validatorAddress ?? null);
  const { data: oldBaker } = useKnownBaker(oldValidatorAddress ?? null);

  const reDelegateAdditionalProps = useMemo(
    () => ({
      ...(activeInYDays && { activeInYDays }),
      ...(activeForXDays && { activeForXDays })
    }),
    [activeInYDays, activeForXDays]
  );

  return (
    <div className="flex flex-col text-center items-center">
      <p className="text-base-plus font-bold mb-2 capitalize">{delegationTextData[type].label} transaction submitted</p>
      <div className="text-xl font-bold flex items-center mb-1">
        <AssetIcon assetSlug={assetSlug} size={24} className="mr-2 flex-shrink-0 self-start" />
        <Money smallFractionFont={false} cryptoDecimals={assetMetadata?.decimals}>
          {amount}
        </Money>
        &nbsp;{assetMetadata?.symbol}
      </div>
      {type !== 'finalize' && type !== 'reDelegate' && (
        <DefaultDelagtionTemplate baker={baker} popup={popup} validatorAddress={validatorAddress} />
      )}

      {type === 'reDelegate' && (
        <ReDelegationTemplate
          baker={baker}
          oldBaker={oldBaker}
          popup={popup}
          validatorAddress={validatorAddress}
          {...reDelegateAdditionalProps}
        />
      )}

      <div className="mt-3 mb-2 flex flex-col gap-2">
        <p>{delegationTextData[type].descr}</p>
        <p>
          You can track this transaction’s status in the History tab or&nbsp;
          <br className="hidden xxs:block" />
          Nexus Block Explorer
        </p>
      </div>
      <div className="flex items-center text-white">
        <T id="operationHash" />:
        <HashChip
          hash={hash}
          firstCharsCount={10}
          lastCharsCount={7}
          showIcon={false}
          key="hash"
          className="ml-2 mr-1 bg-primary-card px-1 rounded text-xs"
          style={{ paddingBlock: 3, fontSize: 12 }}
        />
        <OpenInExplorerChip hash={hash} small />
      </div>
    </div>
  );
};

type DefaultDelagtionTemplateProps = {
  baker: Baker | null | undefined;
  validatorAddress?: string;
  popup: boolean;
};

const DefaultDelagtionTemplate: FC<DefaultDelagtionTemplateProps> = ({ baker, validatorAddress, popup }) => {
  return (
    <div className="bg-primary-card rounded-2xl-plus p-3 w-full mt-3">
      <section className="flex items-center justify-between">
        <div className="text-secondary-white">Validator:</div>
        <BakerDataSection baker={baker} popup={popup} validatorAddress={validatorAddress} />
      </section>
    </div>
  );
};

type RetDelagtionTemplateProps = DefaultDelagtionTemplateProps & {
  oldBaker: Baker | null | undefined;
  activeForXDays?: number;
  activeInYDays?: number;
};

const ReDelegationTemplate: FC<RetDelagtionTemplateProps> = ({
  baker,
  oldBaker,
  validatorAddress,
  popup,
  activeForXDays,
  activeInYDays
}) => {
  return (
    <section className="bg-primary-card rounded-2xl-plus p-3 w-full mt-3">
      <section className="flex items-start flex-col justify-between">
        <div className="text-secondary-white mb-2">Old Validator</div>
        <BakerDataSection
          baker={oldBaker}
          popup={popup}
          validatorAddress={validatorAddress}
          labelChild={activeForXDays ? <Activationlabel days={activeForXDays} type={ACTIVE_FOR} /> : undefined}
        />

        <div className="my-3 flex items-center gap-1 text-white">
          <ArrowDownSvg className="w-4 h-4 fill-current" />
          <p className="text-sm">Re-delegation</p>
        </div>

        <div className="text-secondary-white mb-2">New Validator</div>
        <BakerDataSection
          baker={baker}
          popup={popup}
          validatorAddress={oldBaker?.address}
          labelChild={activeInYDays ? <Activationlabel days={activeInYDays} type={ACTIVE_IN} /> : undefined}
        />
      </section>
    </section>
  );
};

// ------------------ HELPER UI SECTIONS FOR DELEGATION FLOW --------------------------
const BakerDataSection: FC<DefaultDelagtionTemplateProps & { labelChild?: ReactNode }> = ({
  baker,
  validatorAddress,
  popup,
  labelChild
}) => {
  return (
    <div className="flex items-center">
      {baker ? (
        <div className="flex items-center gap-2">
          {baker.logo ? (
            <>
              {typeof baker.logo === 'string' ? (
                <img
                  src={baker.logo}
                  alt={baker.address}
                  className="flex-shrink-0 bg-white rounded-full"
                  style={{ width: 24, height: 24 }}
                />
              ) : (
                // @ts-expect-error // hardcoded svg logos for the time being
                <baker.logo className="flex-shrink-0 bg-transparent rounded-full" style={{ width: 24, height: 24 }} />
              )}
            </>
          ) : (
            <Identicon type="bottts" hash={validatorAddress ?? ''} size={24} className="rounded-full" />
          )}

          <span>
            {baker?.name ?? (
              <HashChip
                hash={validatorAddress ?? ''}
                className={clsx(popup && styles.breakHash)}
                showIcon={false}
                small
              />
            )}
          </span>
        </div>
      ) : (
        <HashChip hash={validatorAddress ?? ''} className={clsx(popup && styles.breakHash)} showIcon={false} small />
      )}

      {labelChild ? <span className="ml-1">{labelChild}</span> : null}
    </div>
  );
};

const labelColors = {
  ACTIVE_IN: '#F8641280',
  ACTIVE_FOR: '#AAAAAA80'
};

function getPluralForm(value: number, key: string) {
  if (value === 1) return `${key}_one`;
  if (value === 0) return `${key}_zero`;
  if (value >= 2 && value <= 4) return `${key}_few`;

  return `${key}_many`;
}
const Activationlabel: FC<ActivationlabelProps> = ({ type, days }) => {
  const daysKey = useMemo(() => {
    return getPluralForm(days, 'days');
  }, [days]) as TID;

  const labelKey: TID | null = useMemo(() => {
    switch (type) {
      case ACTIVE_IN:
        return 'active_in_days';
      case ACTIVE_FOR:
        return 'active_for_days';
      default:
        return null;
    }
  }, [type]);

  if (!labelKey) return null;

  return (
    <span
      style={{ backgroundColor: labelColors[type] }}
      className="px-2 pb-1 text-white text-sm leading-normal rounded"
    >
      <T id={labelKey} substitutions={[<T key="days" id={daysKey} substitutions={[days]} />]} />
    </span>
  );
};
