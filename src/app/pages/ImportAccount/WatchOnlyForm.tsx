import React, { FC, ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';
import { useForm, Controller } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton, NoSpaceField } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useTempleClient, useTezos, useTezosDomainsClient, validateDelegate } from 'lib/temple/front';
import { useTezosAddressByDomainName } from 'lib/temple/front/tzdns';
import { isAddressValid, isKTAddress } from 'lib/temple/helpers';
import { clearClipboard } from 'lib/ui/utils';
import { delay } from 'lib/utils';

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

  const { watch, handleSubmit, errors, control, formState, setValue, triggerValidation } = useForm<WatchOnlyFormData>({
    mode: 'onChange'
  });

  const [error, setError] = useState<ReactNode>(null);

  const addressFieldRef = useRef<HTMLTextAreaElement>(null);

  const addressValue = watch('address') ?? '';

  const { data: resolvedAddress } = useTezosAddressByDomainName(addressValue);

  const finalAddress = useMemo(
    () => (resolvedAddress && resolvedAddress !== null ? resolvedAddress : addressValue),
    [resolvedAddress, addressValue]
  );

  const accName = watch('accName') ?? '';
  const finalAccName = accName?.trim() !== '' ? accName : undefined;

  const cleanAddressField = useCallback(() => {
    setValue('address', '');
    triggerValidation('address');
  }, [setValue, triggerValidation]);

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
    } catch (err: any) {
      formAnalytics.trackSubmitFail();

      console.error(err);

      // Human delay
      await delay();
      setError(err.message);
    }
  }, [
    formState.isSubmitting,
    formAnalytics,
    finalAddress,
    finalAccName,
    importWatchOnlyAccount,
    tezos.rpc,
    tezos.contract
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
        as={<NoSpaceField ref={addressFieldRef} />}
        control={control}
        rules={{
          required: true,
          validate: (value: any) => validateDelegate(value, domainsClient)
        }}
        onChange={([v]) => v}
        onFocus={() => addressFieldRef.current?.focus()}
        textarea
        rows={2}
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

      <Controller
        name="accName"
        as={<FormField />}
        control={control}
        onPaste={clearClipboard}
        defaultValue={''}
        id="acc-name"
        label={`${t('accountName')} ${t('optionalComment')}`}
        labelDescription={<T id="accountNameAlternativeInputDescription" />}
        placeholder={t('enterAccountName')}
        errorCaption={errors.accName?.message}
        containerClassName="mb-4 flex-grow"
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
