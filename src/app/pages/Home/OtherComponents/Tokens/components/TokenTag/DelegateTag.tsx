import React, { FC, useCallback, useMemo } from 'react';

import { DelegateResponse } from '@mavrykdynamics/taquito-rpc';
import classNames from 'clsx';

import { HashChip } from 'app/atoms';
import { AlertWithAction } from 'app/atoms/AlertWithAction';
import { Button } from 'app/atoms/Button';
import { HomeSelectors } from 'app/pages/Home/Home.selectors';
import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useAccount, useDelegate, useKnownBaker } from 'lib/temple/front';
import { navigate } from 'lib/woozie';

import { AssetsSelectors } from '../../../Assets.selectors';
import modStyles from '../../Tokens.module.css';

export const DelegateTezosTag: FC = () => {
  const acc = useAccount();
  const { data: myBakerPkh } = useDelegate(acc.publicKeyHash);
  const { trackEvent } = useAnalytics();

  const handleTagClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      trackEvent(HomeSelectors.delegateButton, AnalyticsEventCategory.ButtonPress);
      navigate('/stake');
    },
    [trackEvent]
  );

  const NotDelegatedButton = useMemo(
    () => (
      <Button
        onClick={handleTagClick}
        className={classNames('uppercase ml-2 px-1.5 py-1', modStyles.tagBase, modStyles.delegateTag)}
        testID={AssetsSelectors.assetItemDelegateButton}
      >
        <T id="notDelegated" />
      </Button>
    ),
    [handleTagClick]
  );

  const TezosDelegated = useMemo(
    () => (
      <Button
        onClick={handleTagClick}
        className={classNames('inline-flex items-center px-1.5 ml-2 py-1', modStyles['apyTag'])}
        testID={AssetsSelectors.assetItemApyButton}
      >
        APY: 5.6%
      </Button>
    ),
    [handleTagClick]
  );

  return myBakerPkh ? TezosDelegated : NotDelegatedButton;
};

export const StakeTezosTag: FC = () => {
  const acc = useAccount();
  const { data: myBakerPkh } = useDelegate(acc.publicKeyHash);
  const { trackEvent } = useAnalytics();

  const handleTagClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      trackEvent(HomeSelectors.delegateButton, AnalyticsEventCategory.ButtonPress);
      navigate('/stake');
    },
    [trackEvent]
  );

  const NotStakedButton = useMemo(
    () => (
      <AlertWithAction btnLabel={t('stake')} onClick={handleTagClick}>
        <T id="stakeToEarn" />
      </AlertWithAction>
    ),
    [handleTagClick]
  );

  const StakedButton = useMemo(
    () => <BakerBanner myBakerPkh={myBakerPkh} handleTagClick={handleTagClick} />,
    [handleTagClick, myBakerPkh]
  );

  return myBakerPkh ? StakedButton : NotStakedButton;
};

type BakerBannerProps = {
  myBakerPkh: DelegateResponse | undefined;
  handleTagClick: (e: React.MouseEvent<HTMLDivElement>) => void;
};

const BakerBanner: FC<BakerBannerProps> = ({ myBakerPkh, handleTagClick }) => {
  const { data: baker } = useKnownBaker(myBakerPkh ?? null);

  const renderBakerData = () => {
    if (myBakerPkh) {
      return (
        <div className="flex items-center gap-3">
          <T id="stakedTo" />
          {baker ? (
            <div className="flex items-center gap-2">
              <img
                src={baker?.logo}
                alt={baker?.name}
                className={classNames('flex-shrink-0', 'bg-white rounded-full')}
                style={{
                  minHeight: '1rem',
                  width: 24,
                  height: 24
                }}
              />
              <span>{baker?.name}</span>
            </div>
          ) : (
            <HashChip hash={myBakerPkh} small />
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <T id="stakedTo" />
        <T id="unknownBakerTitle" />;
      </div>
    );
  };

  return (
    <AlertWithAction
      btnLabel={t('details')}
      onClick={handleTagClick}
      linkTo={`${process.env.NODES_URL}/portfolio/${myBakerPkh ?? ''}`}
    >
      {renderBakerData()}
    </AlertWithAction>
  );
};
