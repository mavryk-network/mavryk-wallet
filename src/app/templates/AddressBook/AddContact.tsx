import React, { useCallback } from 'react';

import clsx from 'clsx';
import { useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { t, T } from 'lib/i18n';
import { isDomainNameValid, useTezosDomainsClient, useContactsActions } from 'lib/temple/front';
import { isAddressValid } from 'lib/temple/helpers';
import { delay } from 'lib/utils';
import { HistoryAction, goBack, navigate, useLocation } from 'lib/woozie';

import { AddressBookSelectors } from './AddressBook.selectors';

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
  const domainsClient = useTezosDomainsClient();
  const { historyPosition, pathname } = useLocation();

  const {
    register,
    reset: resetForm,
    handleSubmit,
    formState,
    clearError,
    setError,
    errors,
    watch
  } = useForm<ContactFormData>();

  const submitting = formState.isSubmitting;
  const name = watch('name') ?? '';
  const address = watch('address') ?? '';

  const inHome = pathname === '/';
  const isSubmitDisabled = !name.length || !address.length;
  const properHistoryPosition = historyPosition > 0 || !inHome;

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
          btnLink: '/settings/address-book',
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
