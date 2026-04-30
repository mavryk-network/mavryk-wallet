import React, { FC, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DerivationType } from '@mavrykdynamics/webmavryk-ledger-signer';
import clsx from 'clsx';
import { Controller, useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import ConfirmLedgerOverlay from 'app/atoms/ConfirmLedgerOverlay';
import { DEFAULT_DERIVATION_PATH } from 'app/defaults';
import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { DerivationTypeFieldSelect } from 'app/templates/DerivationTypeFieldSelect';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { getLedgerTransportType } from 'lib/ledger/helpers';
import { useAllAccounts, useSetAccountPkh, useTempleClient, validateDerivationPath } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { delay } from 'lib/utils';
import { navigate, useLocation } from 'lib/woozie';

import {
  LedgerDerivationPathType,
  buildLedgerAccountPayload,
  resolveLedgerDerivationPath
} from './connect-ledger.helpers';
import { ConnectLedgerSelectors } from './ConnectLedger.selectors';

export type FormData = {
  name: string;
  customDerivationPath: string;
  derivationType?: DerivationType;
  derivationPath: LedgerDerivationPathType;
};

const DERIVATION_PATHS = [
  {
    type: 'default',
    name: t('defaultAccount')
  },
  {
    type: 'custom',
    name: t('customDerivationPath')
  }
];

const DERIVATION_TYPES = [
  {
    type: DerivationType.ED25519,
    name: 'ED25519 (mv1...)'
  },
  {
    type: DerivationType.BIP32_ED25519,
    name: 'BIP32_ED25519 (mv1...)'
  },
  {
    type: DerivationType.SECP256K1,
    name: 'SECP256K1 (mv2...)'
  },
  {
    type: DerivationType.P256,
    name: 'P256 (mv3...)'
  }
];

const LEDGER_USB_VENDOR_ID = '0x2c97';

const ConnectLedger: FC = () => {
  const { createLedgerAccount, getLedgerTezosPk } = useTempleClient();
  const allAccounts = useAllAccounts();
  const setAccountPkh = useSetAccountPkh();
  const formAnalytics = useFormAnalytics('ConnectLedger');
  const { popup } = useAppEnv();
  const { pathname } = useLocation();

  const allLedgers = useMemo(() => allAccounts.filter(acc => acc.type === TempleAccountType.Ledger), [allAccounts]);
  const isStandalonePage = pathname === '/connect-ledger';

  const defaultName = useMemo(() => t('defaultLedgerName', String(allLedgers.length + 1)), [allLedgers.length]);

  const prevAccLengthRef = useRef(allAccounts.length);

  // Select the newly added Ledger account and redirect after the account list changes.
  // No cleanup is needed because this only syncs local selection and navigation state.
  useEffect(() => {
    const accLength = allAccounts.length;
    if (prevAccLengthRef.current < accLength) {
      setAccountPkh(allAccounts[accLength - 1].publicKeyHash);
      navigate('/');
    }
    prevAccLengthRef.current = accLength;
  }, [allAccounts, setAccountPkh]);

  const { control, register, handleSubmit, errors, formState, watch } = useForm<FormData>({
    defaultValues: {
      name: defaultName,
      customDerivationPath: DEFAULT_DERIVATION_PATH,
      derivationType: DerivationType.ED25519,
      derivationPath: DERIVATION_PATHS[0].type
    }
  });
  const submitting = formState.isSubmitting;
  const derivationPathType = watch('derivationPath');

  const [error, setError] = useState<ReactNode>(null);

  const onSubmit = useCallback(
    async ({ name, customDerivationPath, derivationType, derivationPath: derivationPathType }: FormData) => {
      if (submitting) return;

      setError(null);

      formAnalytics.trackSubmit();
      try {
        const webhidTransport = window.navigator.hid;
        if (webhidTransport && getLedgerTransportType()) {
          const devices = await webhidTransport.getDevices();
          const webHidIsConnected = devices.some(device => device.vendorId === Number(LEDGER_USB_VENDOR_ID));
          if (!webHidIsConnected) {
            const connectedDevices = await webhidTransport.requestDevice({
              filters: [{ vendorId: LEDGER_USB_VENDOR_ID as any as number }]
            });
            const userApprovedWebHidConnection = connectedDevices.some(
              device => device.vendorId === Number(LEDGER_USB_VENDOR_ID)
            );
            if (!userApprovedWebHidConnection) {
              throw new Error('No Ledger connected error');
            }
          }
        }
      } catch (err: any) {
        formAnalytics.trackSubmitFail();

        console.error(err);

        // Human delay.
        await delay();
        setError(err.message);
        return;
      }

      try {
        const derivationPath = resolveLedgerDerivationPath(derivationPathType, customDerivationPath);
        const publicKey = await getLedgerTezosPk(derivationType, derivationPath);

        await createLedgerAccount(
          buildLedgerAccountPayload({
            name,
            defaultName,
            publicKey,
            derivationType,
            derivationPath
          })
        );

        formAnalytics.trackSubmitSuccess();
      } catch (err: any) {
        formAnalytics.trackSubmitFail();

        console.error(err);

        // Human delay.
        await delay();
        setError(err.message);
      }
    },
    [submitting, formAnalytics, getLedgerTezosPk, createLedgerAccount, defaultName]
  );

  const content = (
    <section className="relative h-full flex flex-1 flex-col">
      <div
        className={clsx(
          'w-full mx-auto h-full flex flex-1 flex-col justify-start',
          popup ? 'max-w-sm pb-8' : 'max-w-screen-xxs'
        )}
      >
        <form className="flex h-full flex-1 flex-col justify-between" onSubmit={handleSubmit(onSubmit)}>
          <div>
            {error && <Alert type="error" title={t('error')} autoFocus description={error} className="mb-6" />}

            <p className="mb-4 text-sm text-cleanWhite leading-none">
              <T id="connectLedgerDesc" />
            </p>

            <FormField
              ref={register({
                pattern: {
                  value: /^.{0,16}$/,
                  message: t('ledgerNameConstraint')
                }
              })}
              label={t('accountName')}
              labelDescription={t('ledgerNameInputDescription')}
              id="create-ledger-name"
              type="text"
              name="name"
              placeholder={defaultName}
              errorCaption={errors.name?.message}
              containerClassName="mb-4"
              testID={ConnectLedgerSelectors.accountNameInput}
            />

            <Controller
              as={DerivationTypeFieldSelect}
              control={control}
              name="derivationType"
              options={DERIVATION_TYPES}
              i18nKey={t('derivationType')}
            />

            <Controller
              as={DerivationTypeFieldSelect}
              control={control}
              name="derivationPath"
              options={DERIVATION_PATHS}
              i18nKey={t('derivationPath')}
            />

            {derivationPathType === 'custom' && (
              <FormField
                ref={register({
                  required: t('required'),
                  validate: validateDerivationPath
                })}
                name="customDerivationPath"
                id="importacc-cdp"
                label={t('customDerivationPath')}
                placeholder={t('derivationPathExample2')}
                errorCaption={errors.customDerivationPath?.message}
                containerClassName="mb-4"
                testID={ConnectLedgerSelectors.customDerivationPathInput}
              />
            )}
          </div>

          <FormSubmitButton
            className="capitalize"
            loading={submitting}
            testID={ConnectLedgerSelectors.addLedgerAccountButton}
          >
            <T id="connectLedger" />
          </FormSubmitButton>
        </form>
      </div>

      <ConfirmLedgerOverlay displayed={submitting} />
    </section>
  );

  return isStandalonePage ? (
    <PageLayout
      pageTitle={
        <span className="capitalize">
          <T id="connectLedger" />
        </span>
      }
      isTopbarVisible={false}
    >
      {content}
    </PageLayout>
  ) : (
    content
  );
};

export default ConnectLedger;
