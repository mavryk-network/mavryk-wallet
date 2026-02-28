import React, { FC, ReactNode, useCallback, useRef, useState } from 'react';

import clsx from 'clsx';
import { useForm, Controller } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton, NoSpaceField } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useTempleClient, useTezos, useTezosDomainsClient, useAddressResolution, validateDelegate } from 'lib/temple/front';
import { isAddressValid, isKTAddress } from 'lib/temple/helpers';
import { clearClipboard } from 'lib/ui/utils';
import { delay } from 'lib/utils';
import { getErrorMessage } from 'lib/utils/get-error-message';

import { ImportAccountSelectors, ImportAccountFormType } from './selectors';
import { ImportformProps } from './types';

interface WatchOnlyFormData {
  address: string;
  accName?: string;
}

export const WatchOnlyForm: FC<ImportformProps> = ({ className }) => {
  const { importWatchOnlyAccount } = useTempleClient();
  const tezos = useTezos();
  const domainsClient = useTezosDomainsClient();
  const canUseDomainNames = domainsClient.isSupported;
  const formAnalytics = useFormAnalytics(ImportAccountFormType.WatchOnly);
  const { popup } = useAppEnv();

  const { watch, handleSubmit, control, formState, setValue, trigger } = useForm<WatchOnlyFormData>({
    mode: 'onChange'
  });
  const { errors } = formState;

  const [error, setError] = useState<ReactNode>(null);

  const addressFieldRef = useRef<HTMLTextAreaElement>(null);

  const addressValue = watch('address') ?? '';
  const { toResolved: finalAddress } = useAddressResolution(addressValue);

  const accName = watch('accName') ?? '';
  const finalAccName = accName?.trim() !== '' ? accName : undefined;

  const cleanAddressField = useCallback(() => {
    setValue('address', '');
    trigger('address');
  }, [setValue, trigger]);

  const onSubmit = useCallback(async () => {
    if (formState.isSubmitting) return;

    setError(null);

    formAnalytics.trackSubmit();
    try {
      if (!isAddressValid(finalAddress)) {
        throw new Error(t('invalidAddress'));
      }

      let chainId: string | undefined;

      if (isKTAddress(finalAddress)) {
        try {
          await tezos.contract.at(finalAddress);
        } catch {
          throw new Error(t('contractNotExistOnNetwork'));
        }

        chainId = await tezos.rpc.getChainId();
      }

      await importWatchOnlyAccount(finalAddress, chainId, finalAccName);

      formAnalytics.trackSubmitSuccess();
    } catch (err: unknown) {
      formAnalytics.trackSubmitFail();

      console.error(err);

      // Human delay
      await delay();
      setError(getErrorMessage(err));
    }
  }, [
    formState.isSubmitting,
    formAnalytics,
    finalAddress,
    importWatchOnlyAccount,
    tezos.rpc,
    tezos.contract,
    finalAccName
  ]);

  return (
    <form
      className={clsx('w-full mx-auto', popup ? 'max-w-sm' : 'max-w-screen-xxs', className)}
      onSubmit={handleSubmit(onSubmit)}
    >
      {error && <Alert type="error" title={t('error')} description={error} autoFocus className="mb-4 self-start" />}

      <Controller
        name="address"
        defaultValue={''}
        control={control}
        rules={{
          required: true,
          validate: (value: any) => validateDelegate(value, domainsClient)
        }}
        render={({ field }) => (
          <NoSpaceField
            {...field}
            ref={(el: HTMLTextAreaElement | null) => {
              field.ref(el);
              (addressFieldRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
            }}
            onFocus={() => addressFieldRef.current?.focus()}
            textarea
            rows={popup ? 2 : 1}
            cleanable={Boolean(addressValue)}
            onClean={cleanAddressField}
            id="watch-address"
            label={t('address')}
            testID={ImportAccountSelectors.watchOnlyInput}
            labelDescription={
              <T id={canUseDomainNames ? 'addressInputDescriptionWithDomain' : 'addressInputDescription'} />
            }
            placeholder={t('enterAddress')}
            errorCaption={errors.address?.message}
            style={{
              resize: 'none'
            }}
            containerClassName="mb-2"
          />
        )}
      />

      <Controller
        name="accName"
        control={control}
        defaultValue={''}
        render={({ field }) => (
          <FormField
            {...field}
            onPaste={clearClipboard}
            id="acc-name"
            label={`${t('accountName')} ${t('optionalComment')}`}
            labelDescription={<T id="accountNameAlternativeInputDescription" />}
            placeholder={t('enterAccountName')}
            errorCaption={errors.accName?.message}
            containerClassName="mb-4 flex-grow"
          />
        )}
      />

      <div>
        <FormSubmitButton
          className="capitalize"
          disabled={!addressValue.length}
          loading={formState.isSubmitting}
          testID={ImportAccountSelectors.watchOnlyImportButton}
        >
          {t('importAccount')}
        </FormSubmitButton>
        <div className="h-8" />
      </div>
    </form>
  );
};
