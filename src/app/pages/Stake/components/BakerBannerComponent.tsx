import React from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { Alert, Anchor, Divider, Money } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ReactComponent as ExternalLinkIcon } from 'app/icons/external-link.svg';
import BakerBanner from 'app/templates/BakerBanner';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useGasToken } from 'lib/assets/hooks';
import { useBalance } from 'lib/balances';
import { T, t } from 'lib/i18n';
import { Baker, useAccount, useKnownBaker } from 'lib/temple/front';
import { atomsToTokens } from 'lib/temple/helpers';
import { ZERO } from 'lib/utils/numbers';

import { DelegateActionsComponent } from './DelegateActionsComponent';

interface BakerBannerComponentProps {
  baker: Baker | null | undefined;
  tzError: any;
  style?: React.CSSProperties;
}

export const BakerBannerComponent: React.FC<BakerBannerComponentProps> = ({ tzError, baker, style }) => {
  const { popup } = useAppEnv();
  const acc = useAccount();

  const accountPkh = acc.publicKeyHash;
  const { rawValue } = useBalance(MAV_TOKEN_SLUG, accountPkh);
  const { metadata } = useGasToken();

  return baker ? (
    <>
      <div className="flex flex-col items-center">
        <BakerBanner bakerPkh={baker.address} style={{ width: undefined, ...style }} />
      </div>
      {!tzError && new BigNumber(rawValue ?? 0).isLessThan(baker.minDelegation ?? 0) && (
        <div className={classNames('pb-6', popup && 'px-4')}>
          <Alert
            type="info"
            title={t('minDelegationAmountTitle')}
            description={
              <T
                id="minDelegationAmountDescription"
                substitutions={[
                  <span className="font-normal" key="minDelegationsAmount">
                    <Money>{atomsToTokens(baker.minDelegation || ZERO, metadata.decimals)}</Money>{' '}
                    <span>{metadata.symbol}</span>
                  </span>
                ]}
              />
            }
            className={classNames('mt-6')}
          />
        </div>
      )}
    </>
  ) : null;
};

export const AdvancedBakerBannerComponent: React.FC<{
  bakerAddress: string;
  activateReDelegation: () => void;
}> = ({ bakerAddress, activateReDelegation }) => {
  const { data: baker } = useKnownBaker(bakerAddress || null);

  return baker ? (
    <div>
      <p className="text-white text-base">My Validator</p>
      <div className="flex items-center py-4">
        <BakerBanner bakerPkh={baker.address} style={{ padding: 0 }} />
        <Anchor href={`${process.env.NODES_URL}/validator/${baker.address}`}>
          <ExternalLinkIcon className="w-6 h-6 text-white fill-current" />
        </Anchor>
      </div>
      <DelegateActionsComponent activateReDelegation={activateReDelegation} />
      <Divider className="my-6" color="bg-divider" ignoreParent />
    </div>
  ) : null;
};
