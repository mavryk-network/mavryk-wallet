import React, {
  ComponentProps,
  FC,
  ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import classNames from 'clsx';

import DocBg from 'app/a11y/DocBg';
import { Button } from 'app/atoms/Button';
import Spinner from 'app/atoms/Spinner/Spinner';
import { useAppEnv } from 'app/env';
import ErrorBoundary from 'app/ErrorBoundary';
import { ReactComponent as ChevronLeftIcon } from 'app/icons/chevron-left.svg';
import ContentContainer from 'app/layouts/ContentContainer';
import { ReactComponent as LogoDesktopIcon } from 'app/misc/logo-desktop.svg';
import { T } from 'lib/i18n';
import { useTempleClient } from 'lib/temple/front';
import { delay } from 'lib/utils';
import { goBack, HistoryAction, navigate, useLocation } from 'lib/woozie';

import { useOnboardingProgress } from '../pages/Onboarding/hooks/useOnboardingProgress.hook';

import { ChangelogOverlay } from './PageLayout/ChangelogOverlay/ChangelogOverlay';
import ConfirmationOverlay from './PageLayout/ConfirmationOverlay';
import Header from './PageLayout/Header';
import styles from './pageLayout.module.css';
import { PageLayoutSelectors } from './PageLayout.selectors';

interface PageLayoutProps extends PropsWithChildren, ToolbarProps {
  contentContainerStyle?: React.CSSProperties;
  contentPaperStyle?: React.CSSProperties;
  isTopbarVisible?: boolean;
  removePaddings?: boolean;
}

const PageLayout: FC<PageLayoutProps> = ({
  children,
  contentContainerStyle,
  contentPaperStyle,
  isTopbarVisible = true,
  removePaddings = false,
  ...toolbarProps
}) => {
  const { fullPage, popup } = useAppEnv();

  const style = useMemo(
    () =>
      !isTopbarVisible && popup ? { height: 'calc(100vh - 56px)', ...contentContainerStyle } : contentContainerStyle,
    [contentContainerStyle, isTopbarVisible, popup]
  );

  return (
    <div className={classNames(fullPage && 'min-h-screen', fullPage && styles.fullpageBg)}>
      <DocBg bgClassName={classNames(fullPage ? styles.fullpageBg : 'bg-primary-bg')} />

      {fullPage && (
        <div className="py-9 flex justify-center">
          <LogoDesktopIcon />
        </div>
      )}

      <div className={classNames(fullPage && 'pb-16', 'relative')}>
        {isTopbarVisible && <Header />}
        <ContentPaper style={contentPaperStyle}>
          <Toolbar {...toolbarProps} />

          <div
            className={classNames(
              'no-scrollbar overflow-x-hidden',
              !removePaddings ? (fullPage ? 'px-20 pt-8 pb-11 flex-1 flex flex-col' : 'px-4 pt-4') : ''
            )}
            style={style}
          >
            <ErrorBoundary whileMessage="displaying this page">
              <Suspense fallback={<SpinnerSection />}>{children}</Suspense>
            </ErrorBoundary>
          </div>
        </ContentPaper>
      </div>

      {/* <AdvertisingOverlay /> */}
      <ConfirmationOverlay />
      <ChangelogOverlay />
      {/* <OnRampOverlay /> */}
      {/* <NewsletterOverlay /> */}
    </div>
  );
};

export default PageLayout;

type ContentPaparProps = ComponentProps<typeof ContentContainer>;

const fullPageMinHeightScreenWithHeader = 'calc(100vh - 230px)';
const fullPageMinHeightTopbarNavigation = 'calc(100vh - 168px)';

const routesWithheader = ['/'];

export const ContentPaper: FC<ContentPaparProps> = ({ className, style = {}, children, ...rest }) => {
  const { pathname } = useLocation();

  const isMainPage = useMemo(() => routesWithheader.includes(pathname), [pathname]);
  const appEnv = useAppEnv();

  return appEnv.fullPage ? (
    <ContentContainer>
      <div
        className={classNames('bg-primary-bg rounded-md shadow-lg h-full flex flex-col', className)}
        style={{
          minHeight: isMainPage ? fullPageMinHeightScreenWithHeader : fullPageMinHeightTopbarNavigation,
          ...style
        }}
        {...rest}
      >
        {children}
      </div>
    </ContentContainer>
  ) : (
    <ContentContainer padding={false} className={classNames('bg-primary-bg', className)} style={style} {...rest}>
      {children}
    </ContentContainer>
  );
};

const SpinnerSection: FC = () => (
  <div className="flex justify-center mt-24">
    <Spinner className="w-20" />
  </div>
);

type ToolbarProps = {
  pageTitle?: ReactNode;
  hasBackAction?: boolean;
  step?: number;
  setStep?: (step: number) => void;
  adShow?: boolean;
  skip?: boolean;
  attention?: boolean;
  RightSidedComponent?: JSX.Element | null;
};

export let ToolbarElement: HTMLDivElement | null = null;

export const Toolbar: FC<ToolbarProps> = ({
  pageTitle,
  hasBackAction = true,
  step,
  setStep,
  RightSidedComponent = null,
  skip
}) => {
  const { historyPosition, pathname } = useLocation();
  const { fullPage } = useAppEnv();
  const { setOnboardingCompleted } = useOnboardingProgress();
  // hide back icon on the confirm operation screen
  const { confirmation } = useTempleClient();
  const displayed = Boolean(confirmation);

  const onStepBack = () => {
    if (step && setStep && step > 0) {
      setStep(step - 1);
    }
  };

  const inHome = pathname === '/';
  const properHistoryPosition = historyPosition > 0 || !inHome;
  const canBack = hasBackAction && properHistoryPosition;
  const canStepBack = Boolean(step) && step! > 0;
  const isBackButtonAvailable = displayed ? false : canBack || canStepBack;

  const handleBack = () => {
    if (canBack) {
      return goBack();
    }

    navigate('/', HistoryAction.Replace);
  };

  const [sticked, setSticked] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>();

  useEffect(() => {
    const toolbarEl = rootRef.current;
    if ('IntersectionObserver' in window && toolbarEl) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setSticked(entry.boundingClientRect.y < entry.rootBounds!.y);
        },
        { threshold: [1] }
      );

      observer.observe(toolbarEl);
      return () => {
        observer.unobserve(toolbarEl);
      };
    }
    return undefined;
  }, [setSticked]);

  const updateRootRef = useCallback((elem: HTMLDivElement | null) => {
    rootRef.current = elem;
    ToolbarElement = elem;
  }, []);

  const handleSkipClick = () => {
    setOnboardingCompleted(true);

    delay();

    navigate('/');
  };

  return inHome ? null : (
    <div
      ref={updateRootRef}
      className={classNames(
        'z-20 flex items-center justify-center py-4 px-4 relative',
        fullPage && !sticked && 'rounded-t',
        sticked ? 'shadow' : 'shadow-sm',
        'bg-primary-card overflow-hidden transition ease-in-out duration-300'
      )}
      style={{
        // The top value needs to be -1px or the element will never intersect
        // with the top of the browser window
        // (thus never triggering the intersection observer).
        top: -1,
        minHeight: fullPage ? '3.5rem' : '2.75rem'
      }}
    >
      <div className="flex-1">
        {/* {!isBackButtonAvailable && adShow && <DonationBanner />} */}

        {isBackButtonAvailable && (
          <Button
            className={classNames(
              'text-white rounded',
              'flex items-center',
              'hover:bg-list-item-selected',
              'transition duration-300 ease-in-out',
              'opacity-90 hover:opacity-100'
            )}
            onClick={step ? onStepBack : handleBack}
            testID={PageLayoutSelectors.backButton}
          >
            <ChevronLeftIcon className="h-6 w-auto stroke-current stroke-2" />
          </Button>
        )}
      </div>

      {pageTitle && (
        <h2
          className="px-1 flex items-center justify-center text-xl tracking-tight text-white font-normal overflow-hidden absolute top-1/2 left-1/2"
          style={{ transform: 'translate(-50%, -50%)', width: 300 }}
        >
          {pageTitle}
        </h2>
      )}

      <div className="flex-1" />
      {RightSidedComponent && <div className="z-10 relative">{RightSidedComponent}</div>}

      {/* {attention && (
        <div className="flex items-center content-end absolute right-0">
          <AdvertisingBanner />
          <NotificationsBell />
        </div>
      )} */}

      {skip && (
        <div className="flex content-end">
          <Button
            className={classNames('flex items-center px-4 py-2 rounded', 'text-base-plus text-white')}
            onClick={handleSkipClick}
            testID={PageLayoutSelectors.skipButton}
          >
            <T id="skip" />
          </Button>
        </div>
      )}
    </div>
  );
};
