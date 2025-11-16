import React, { FC } from 'react';

import { HashChip, Identicon, Money } from 'app/atoms';
import { AssetIcon } from 'app/templates/AssetIcon';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { T } from 'lib/i18n';
import { useAssetMetadata } from 'lib/metadata';
import { useKnownBaker } from 'lib/temple/front';

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
  validatorAddress?: string;
  hash: string;
} & { type: DelegationType };

export const DelegationOperation: FC<DelegationOperationProps> = props => {
  const { type, hash, amount, assetSlug, validatorAddress } = props;
  const assetMetadata = useAssetMetadata(assetSlug ?? MAV_TOKEN_SLUG);
  const { data: baker } = useKnownBaker(validatorAddress ?? null);

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
      {type !== 'finalize' && (
        <div className="bg-primary-card rounded-lg p-3 w-full mt-3">
          <section className="flex items-center justify-between">
            <div className="text-secondary-white">Validator:</div>
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
                        <baker.logo
                          className="flex-shrink-0 bg-transparent rounded-full"
                          style={{ width: 24, height: 24 }}
                        />
                      )}
                    </>
                  ) : (
                    <Identicon type="bottts" hash={validatorAddress ?? ''} size={24} className="rounded-full" />
                  )}

                  <span>{baker?.name ?? <HashChip hash={validatorAddress ?? ''} small />}</span>
                </div>
              ) : (
                <HashChip hash={validatorAddress ?? ''} small />
              )}
            </div>
          </section>
        </div>
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
