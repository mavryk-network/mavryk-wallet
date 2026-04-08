import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import clsx from 'clsx';
import { useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN_STR } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { t, T } from 'lib/i18n';
import {
  isDomainNameValid,
  useContactsActions,
  useKnownBakers,
  useNetwork,
  useTezosDomainsClient
} from 'lib/temple/front';
import { PREDEFINED_BAKERS_NAMES_MAINNET } from 'lib/temple/front/baking/const';
import { isAddressValid } from 'lib/temple/helpers';
import { delay } from 'lib/utils';
import { HistoryAction, goBack, navigate, useLocation } from 'lib/woozie';

import { AddressBookSelectors } from '../Contacts.selectors';

export const AddContact: React.FC = () => {
  const { popup } = useAppEnv();
  return (
    <div className={clsx('w-full h-full mx-auto flex-1 flex flex-col', popup && 'pb-8 max-w-sm')}>
      <AddNewContactForm className="h-full flex flex-col justify-between flex-1" />
    </div>
  );
};

type ContactFormData = {
  address: string;
  name: string;
};

const SUBMIT_ERROR_TYPE = 'submit-error';

const AddNewContactForm: React.FC<{ className?: string }> = ({ className }) => {
  const { addContact } = useContactsActions();
  const network = useNetwork();
  const knownBakers = useKnownBakers(false);
  const domainsClient = useTezosDomainsClient();
  const { historyPosition, pathname } = useLocation();
  const autofilledValidatorNameRef = useRef<string | null>(null);

  const {
    register,
    reset: resetForm,
    handleSubmit,
    formState,
    clearError,
    setError,
    setValue,
    errors,
    watch
  } = useForm<ContactFormData>();

  const submitting = formState.isSubmitting;
  const name = watch('name') ?? '';
  const address = watch('address') ?? '';
  const knownValidatorAddresses = useMemo(
    () => new Set((knownBakers ?? []).map(({ address: bakerAddress }) => bakerAddress)),
    [knownBakers]
  );

  const inHome = pathname === '/';
  const isSubmitDisabled = !name.length || !address.length;
  const properHistoryPosition = historyPosition > 0 || !inHome;

  // Keep the contact name aligned with the entered validator address by resolving domains
  // and applying the predefined validator label. Cleanup only ignores stale async lookups.
  useEffect(() => {
    let cancelled = false;

    const syncValidatorName = async () => {
      const trimmedAddress = address.trim();
      const previousAutofilledName = autofilledValidatorNameRef.current;

      if (!trimmedAddress) {
        if (previousAutofilledName && name === previousAutofilledName) {
          setValue('name', '');
        }

        autofilledValidatorNameRef.current = null;

        return;
      }

      let resolvedAddress = trimmedAddress;

      if (isDomainNameValid(trimmedAddress, domainsClient)) {
        const resolved = await domainsClient.resolver.resolveNameToAddress(trimmedAddress);

        if (cancelled) {
          return;
        }

        if (!resolved) {
          resolvedAddress = '';
        } else {
          resolvedAddress = resolved;
        }
      }

      const validatorName =
        network.type === 'main' && knownValidatorAddresses.has(resolvedAddress)
          ? PREDEFINED_BAKERS_NAMES_MAINNET[resolvedAddress]?.name ?? null
          : null;

      if (cancelled) {
        return;
      }

      if (validatorName) {
        if (!name || name === previousAutofilledName) {
          if (name !== validatorName) {
            setValue('name', validatorName);
          }

          autofilledValidatorNameRef.current = validatorName;
        }

        return;
      }

      if (previousAutofilledName && name === previousAutofilledName) {
        setValue('name', '');
      }

      autofilledValidatorNameRef.current = null;
    };

    syncValidatorName();

    return () => {
      cancelled = true;
    };
  }, [address, domainsClient, knownValidatorAddresses, name, network.type, setValue]);

  const onCancelSubmit = useCallback(() => {
    if (submitting) return;

    clearError();
    resetForm();

    if (properHistoryPosition) {
      return goBack();
    }

    navigate('/', HistoryAction.Replace);
  }, [clearError, properHistoryPosition, resetForm, submitting]);

  const onAddContactSubmit = useCallback(
    async ({ address, name }: ContactFormData) => {
      if (submitting) return;

      try {
        clearError();

        if (isDomainNameValid(address, domainsClient)) {
          const resolved = await domainsClient.resolver.resolveNameToAddress(address);
          if (!resolved) {
            throw new Error(t('domainDoesntResolveToAddress', address));
          }

          address = resolved;
        }

        if (!isAddressValid(address)) {
          throw new Error(t('invalidAddressOrDomain'));
        }

        await addContact({ address, name, addedAt: Date.now() });
        resetForm();

        navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'addContact',
          btnText: 'goToAddressBook',
          btnLink: '/settings/contacts',
          description: 'addContactSuccessDesc',
          subHeader: 'success'
        });
      } catch (err: any) {
        console.error(err);

        await delay();

        setError('address', SUBMIT_ERROR_TYPE, err.message);
      }
    },
    [submitting, clearError, addContact, resetForm, setError, domainsClient]
  );

  const validateAddressField = useCallback(
    async (value: any) => {
      if (!value?.length) {
        return t('required');
      }

      if (isDomainNameValid(value, domainsClient)) {
        const resolved = await domainsClient.resolver.resolveNameToAddress(value);
        if (!resolved) {
          return t('domainDoesntResolveToAddress', value);
        }

        value = resolved;
      }

      return isAddressValid(value) ? true : t('invalidAddressOrDomain');
    },
    [domainsClient]
  );

  return (
    <form className={className} onSubmit={handleSubmit(onAddContactSubmit)}>
      <div>
        <FormField
          ref={register({
            required: t('required'),
            maxLength: { value: 50, message: t('maximalAmount', '50') }
          })}
          label={t('contactName')}
          id="name"
          name="name"
          pattern={ACCOUNT_NAME_PATTERN_STR}
          placeholder={t('newContactPlaceholder')}
          errorCaption={errors.name?.message}
          containerClassName="mb-2"
          maxLength={50}
          testIDs={{
            input: AddressBookSelectors.nameInput,
            inputSection: AddressBookSelectors.nameInputSection
          }}
        />

        <FormField
          ref={register({ validate: validateAddressField })}
          label={t('publicAddress')}
          id="address"
          name="address"
          placeholder={t('enterPublicAddressPlaceholder')}
          errorCaption={errors.address?.message}
          containerClassName="mb-2"
          testIDs={{
            input: AddressBookSelectors.addressInput,
            inputSection: AddressBookSelectors.addressInputSection
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ButtonRounded size="big" fill={false} onClick={onCancelSubmit} disabled={submitting}>
          <T id="cancel" />
        </ButtonRounded>
        <FormSubmitButton
          disabled={isSubmitDisabled}
          loading={submitting}
          testID={AddressBookSelectors.addContactButton}
        >
          <T id="add" />
        </FormSubmitButton>
      </div>
    </form>
  );
};
