import React, { useCallback } from 'react';

import { useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { t, T } from 'lib/i18n';
import { isDomainNameValid, useTezosDomainsClient, useContactsActions } from 'lib/temple/front';
import { isAddressValid } from 'lib/temple/helpers';
import { delay } from 'lib/utils';
import { navigate } from 'lib/woozie';

import { AddressBookSelectors } from './AddressBook.selectors';

export const AddContact: React.FC = () => {
  return (
    <div className="w-full h-full max-w-sm pb-8 mx-auto">
      <AddNewContactForm className="h-full flex flex-col justify-between" />
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

  const {
    register,
    reset: resetForm,
    handleSubmit,
    formState,
    clearError,
    setError,
    errors
  } = useForm<ContactFormData>();
  const submitting = formState.isSubmitting;

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

      <FormSubmitButton loading={submitting} testID={AddressBookSelectors.addContactButton}>
        <T id="addContact" />
      </FormSubmitButton>
    </form>
  );
};
