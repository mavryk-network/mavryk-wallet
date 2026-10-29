import React, { useCallback, useLayoutEffect, useState } from 'react';

import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';

import { PASSWORD_ERROR_CAPTION } from 'app/atoms';
import { formatMnemonic, getPasswordValidation, isPasswordValid } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { shouldShowNewsletterModalAction } from 'app/store/newsletter/newsletter-actions';
import { togglePartnersPromotionAction } from 'app/store/partners-promotion/actions';
import { setIsAnalyticsEnabledAction, setOnRampPossibilityAction } from 'app/store/settings/actions';
import { AnalyticsEventCategory, TestIDProps, useAnalytics } from 'lib/analytics';
import { WEBSITES_ANALYTICS_ENABLED } from 'lib/constants';
import { putToStorage } from 'lib/storage';
import { useTempleClient } from 'lib/temple/front';
import { delay } from 'lib/utils';
import { navigate } from 'lib/woozie';

import { useOnboardingProgress } from '../../Onboarding/hooks/useOnboardingProgress.hook';

type PasswordOptions =
  | { shouldUseKeystorePassword: true; keystorePassword: string }
  | { shouldUseKeystorePassword: false };

export interface FormData extends TestIDProps {
  password?: string;
  repeatPassword?: string;
  termsAccepted: boolean;
  betaAgreement: boolean;
  analytics?: boolean;
  viewAds: boolean;
  skipOnboarding?: boolean;
  testID?: string;
}

export const useCreareOrRestorePassword = (
  ownMnemonic: boolean,
  seedPhrase: string,
  options: PasswordOptions = { shouldUseKeystorePassword: false }
) => {
  const { registerWallet } = useTempleClient();
  const { popup } = useAppEnv();
  const { trackEvent } = useAnalytics();

  const dispatch = useDispatch();

  const setAnalyticsEnabled = useCallback(
    (analyticsEnabled: boolean) => dispatch(setIsAnalyticsEnabledAction(analyticsEnabled)),
    [dispatch]
  );

  const setAdsViewEnabled = useCallback(
    (adsViewEnabled: boolean) => {
      if (adsViewEnabled) {
        // dispatch(setAdsBannerVisibilityAction(false));
        dispatch(togglePartnersPromotionAction(true));
      } else {
        // dispatch(setAdsBannerVisibilityAction(true));
        dispatch(togglePartnersPromotionAction(false));
      }
    },
    [dispatch]
  );

  const { setOnboardingCompleted } = useOnboardingProgress();

  const { shouldUseKeystorePassword } = options;
  const keystorePassword = options.shouldUseKeystorePassword ? options.keystorePassword : '';
  const isKeystorePasswordWeak = shouldUseKeystorePassword && !isPasswordValid(keystorePassword);

  const { control, watch, register, handleSubmit, errors, setError, triggerValidation, formState } = useForm<FormData>({
    defaultValues: {
      analytics: true,
      viewAds: false,
      skipOnboarding: false
    },
    mode: 'onChange'
  });

  const submitting = formState.isSubmitting;

  const passwordValue = watch('password');
  const repeatPasswordValue = watch('repeatPassword');

  const isTermsAccepted: boolean = watch('termsAccepted');
  const isBetaAccepted: boolean = watch('betaAgreement');

  const isPasswordError = errors.password?.message === PASSWORD_ERROR_CAPTION;

  const [passwordValidation, setPasswordValidation] = useState(() => getPasswordValidation(''));

  // Revalidate confirmation when its source password changes; no external resource needs cleanup.
  useLayoutEffect(() => {
    if (formState.dirtyFields.has('repeatPassword')) {
      triggerValidation('repeatPassword');
    }
  }, [triggerValidation, formState.dirtyFields, passwordValue]);

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
      setPasswordValidation(getPasswordValidation(e.target.value));
    },
    []
  );

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (submitting) return;
      const password = shouldUseKeystorePassword ? keystorePassword : data.password ?? '';
      if (!isPasswordValid(password)) {
        setError('password', 'validate', PASSWORD_ERROR_CAPTION);
        setPasswordValidation(getPasswordValidation(password));
        return;
      }
      try {
        const shouldEnableAnalytics = Boolean(data.analytics);
        setAdsViewEnabled(data.viewAds);
        setAnalyticsEnabled(shouldEnableAnalytics);
        const shouldEnableWebsiteAnalytics = data.viewAds && shouldEnableAnalytics;
        await putToStorage(WEBSITES_ANALYTICS_ENABLED, shouldEnableWebsiteAnalytics);

        setOnboardingCompleted(data.skipOnboarding!);
        const accountPkh = await registerWallet(password, formatMnemonic(seedPhrase));
        trackEvent(
          data.skipOnboarding ? 'OnboardingSkipped' : 'OnboardingNotSkipped',
          AnalyticsEventCategory.General,
          undefined,
          data.analytics
        );
        if (shouldEnableWebsiteAnalytics) {
          trackEvent('AnalyticsAndAdsEnabled', AnalyticsEventCategory.General, { accountPkh }, data.analytics);
        }

        if (popup) {
          await delay();

          navigate<SuccessStateType>('/success', undefined, {
            pageTitle: 'restoreAccount',
            btnText: 'goToMain',
            description: 'restoreAccountSuccess',
            subHeader: 'success'
          });
        } else {
          navigate('/loading');
        }
        !ownMnemonic && dispatch(setOnRampPossibilityAction(true));
        dispatch(shouldShowNewsletterModalAction(true));
      } catch (err: any) {
        console.error(err);

        alert(err.message);
      }
    },
    [
      submitting,
      shouldUseKeystorePassword,
      setError,
      ownMnemonic,
      keystorePassword,
      setAdsViewEnabled,
      setAnalyticsEnabled,
      setOnboardingCompleted,
      registerWallet,
      seedPhrase,
      trackEvent,
      popup,
      dispatch
    ]
  );

  return {
    control,
    register,
    errors,
    submitting,
    handleSubmit,
    isPasswordError,
    isKeystorePasswordWeak,
    shouldUseKeystorePassword,
    passwordValidation,
    setPasswordValidation,
    passwordValue,
    repeatPasswordValue,
    handlePasswordChange,
    onSubmit,
    disabled: !isTermsAccepted || !isBetaAccepted
  };
};
