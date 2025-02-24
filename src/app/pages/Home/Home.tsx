import React, { FC, FunctionComponent, SVGProps, useEffect, useLayoutEffect, useMemo } from 'react';

import classNames from 'clsx';
import { useDispatch } from 'react-redux';
import { Props as TippyProps } from 'tippy.js';

import { Anchor, Divider } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ReactComponent as BuyIcon } from 'app/icons/buy.svg';
import { ReactComponent as ReceiveIcon } from 'app/icons/m_receive.svg';
import { ReactComponent as SendIcon } from 'app/icons/m_send.svg';
import { ReactComponent as SwapIcon } from 'app/icons/m_swap.svg';
import { ReactComponent as WithdrawIcon } from 'app/icons/m_withdraw.svg';
import PageLayout from 'app/layouts/PageLayout';
import { useShouldShowPartnersPromoSelector } from 'app/store/partners-promotion/selectors';
import { setAnotherSelector, setTestID, TestIDProps } from 'lib/analytics';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { T, t } from 'lib/i18n';
import { useAssetMetadata, getAssetSymbol } from 'lib/metadata';
import { useAccount, useNetwork } from 'lib/temple/front';
import { TempleAccountType, TempleNetworkType } from 'lib/temple/types';
import useTippy from 'lib/ui/useTippy';
import * as Woozie from 'lib/woozie';
import { createUrl, HistoryAction, Link, navigate, To, useLocation } from 'lib/woozie';
import { createLocationState } from 'lib/woozie/location';

import { togglePartnersPromotionAction } from '../../store/partners-promotion/actions';
import { useOnboardingProgress } from '../Onboarding/hooks/useOnboardingProgress.hook';

import { ContentSection } from './ContentSection';
import styles from './Home.module.css';
import { HomeSelectors } from './Home.selectors';
import { useInitialKYC } from './hooks/useInitialKYC';
import MainBanner from './OtherComponents/MainBanner';
import { TokenPageSelectors } from './OtherComponents/TokenPage.selectors';

type ExploreProps = {
  assetSlug?: string | null;
};

export const tippyPropsMock = {
  trigger: 'mouseenter',
  hideOnClick: false,
  content: t('disabledForWatchOnlyAccount'),
  animation: 'shift-away-subtle'
};

export const NETWORK_TYPES_WITH_BUY_BUTTON: TempleNetworkType[] = ['main', 'dcp'];

const Home: FC<ExploreProps> = ({ assetSlug }) => {
  const { fullPage, registerBackHandler } = useAppEnv();
  const { onboardingCompleted } = useOnboardingProgress();
  const account = useAccount();
  const { search } = useLocation();
  const network = useNetwork();
  const dispatch = useDispatch();

  const shouldShowPartnersPromo = useShouldShowPartnersPromoSelector();

  const assetMetadata = useAssetMetadata(assetSlug || MAV_TOKEN_SLUG);
  const assetSymbol = getAssetSymbol(assetMetadata);

  useInitialKYC(account);

  useLayoutEffect(() => {
    const usp = new URLSearchParams(search);
    if (assetSlug && usp.get('after_token_added') === 'true') {
      return registerBackHandler(() => {
        navigate('/', HistoryAction.Replace);
      });
    }
    return undefined;
  }, [registerBackHandler, assetSlug, search]);

  useEffect(() => {
    if (shouldShowPartnersPromo) {
      dispatch(togglePartnersPromotionAction(false));
    }
  }, [shouldShowPartnersPromo, dispatch]);

  const accountPkh = account.publicKeyHash;
  const canSend = account.type !== TempleAccountType.WatchOnly;
  const sendLink = assetSlug ? `/send/${assetSlug}` : '/send';

  return onboardingCompleted ? (
    <PageLayout
      pageTitle={
        <>
          {assetSlug && (
            <>
              <span
                className="font-normal"
                {...setTestID(TokenPageSelectors.pageName)}
                {...setAnotherSelector('symbol', assetSymbol)}
              >
                {assetSymbol}
              </span>
            </>
          )}
        </>
      }
      attention={true}
      adShow
    >
      <div className={classNames(styles.wrapper, 'flex flex-col items-center')}>
        <MainBanner accountPkh={accountPkh} assetSlug={assetSlug} />

        <div className={classNames('flex justify-between mx-auto w-full pb-4', !fullPage ? 'max-w-sm' : 'px-4.5')}>
          <ActionButton
            label={<T id="receive" />}
            Icon={ReceiveIcon}
            to="/receive"
            testID={HomeSelectors.receiveButton}
          />

          <ActionButton
            label={<T id="buyButton" />}
            Icon={BuyIcon}
            to={network.type === 'dcp' ? 'https://buy.chainbits.com' : '/buy'}
            isAnchor={network.type === 'dcp'}
            // disabled={!NETWORK_TYPES_WITH_BUY_BUTTON.includes(network.type)}
            disabled
            testID={HomeSelectors.buyButton}
          />
          <ActionButton
            label={<T id="swap" />}
            Icon={SwapIcon}
            to={{
              pathname: '/swap',
              search: `from=${assetSlug ?? ''}`
            }}
            // disabled={!canSend}
            disabled
            testID={HomeSelectors.swapButton}
          />
          <ActionButton
            label={<T id="withdraw" />}
            Icon={WithdrawIcon}
            to="/withdraw"
            // disabled={!canSend || network.type !== 'main'}
            disabled
            testID={HomeSelectors.withdrawButton}
          />
          <ActionButton
            label={<T id="send" />}
            Icon={SendIcon}
            to={sendLink}
            disabled={!canSend}
            tippyProps={tippyPropsMock}
            testID={HomeSelectors.sendButton}
          />
        </div>
      </div>

      <Divider ignoreParent className="mb-4" />
      <ContentSection assetSlug={assetSlug} />
    </PageLayout>
  ) : (
    <Woozie.Redirect to="/onboarding" />
  );
};

export default Home;

interface ActionButtonProps extends TestIDProps {
  label: React.ReactNode;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  to: To;
  disabled?: boolean;
  isAnchor?: boolean;
  tippyProps?: Partial<TippyProps>;
}

export const ActionButton: FC<ActionButtonProps> = ({
  label,
  Icon,
  to,
  disabled,
  isAnchor,
  tippyProps = {},
  testID,
  testIDProperties
}) => {
  const buttonRef = useTippy<HTMLButtonElement>({
    ...tippyProps,
    content: disabled && !tippyProps.content ? t('disabled') : tippyProps.content
  });
  const commonButtonProps = useMemo(
    () => ({
      className: `flex flex-col items-center`,
      type: 'button' as const,
      children: (
        <>
          <div
            className={classNames(
              disabled && 'opacity-50',
              'bg-primary-card-op',
              'rounded mb-2 flex items-center text-white',
              'border  p-10 h-full'
            )}
          >
            <Icon className={classNames('w-6 h-auto')} />
          </div>
          <span className={classNames('text-center text-xs', disabled && 'opacity-50', 'text-white')}>{label}</span>
        </>
      )
    }),
    [disabled, Icon, label]
  );

  if (disabled) {
    return <button ref={buttonRef} {...commonButtonProps} />;
  }

  if (isAnchor) {
    let href: string;
    if (typeof to === 'string') {
      href = to;
    } else {
      const { pathname, search, hash } = typeof to === 'function' ? to(createLocationState()) : to;
      href = createUrl(pathname, search, hash);
    }

    return <Anchor testID={testID} testIDProperties={testIDProperties} href={href} {...commonButtonProps} />;
  }

  return <Link testID={testID} testIDProperties={testIDProperties} to={to} {...commonButtonProps} />;
};
