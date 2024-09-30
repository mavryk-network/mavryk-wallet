import React, { FC, useCallback } from 'react';

import { useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import HashShortView from 'app/atoms/HashShortView';
import Identicon from 'app/atoms/Identicon';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { T, t } from 'lib/i18n';
import { useContactsActions } from 'lib/temple/front';
import { delay } from 'lib/utils';

import { PopupModalWithTitle } from '../PopupModalWithTitle';

type AddContactModalProps = {
  address: string | null;
  onClose: () => void;
};

const AddContactModal: FC<AddContactModalProps> = ({ address, onClose }) => {
  const { addContact } = useContactsActions();

  const {
    register,
    reset: resetForm,
    handleSubmit,
    formState,
    clearError,
    setError,
    errors
  } = useForm<{ name: string }>();
  const submitting = formState.isSubmitting;

  const onAddContactSubmit = useCallback(
    async ({ name }: { name: string }) => {
      if (submitting) return;

      try {
        clearError();

        await addContact({
          address: address!,
          name,
          addedAt: Date.now()
        });
        resetForm();
        onClose();
      } catch (err: any) {
        console.error(err);

        await delay();

        setError('address', 'submit-error', err.message);
      }
    },
    [submitting, clearError, addContact, address, resetForm, onClose, setError]
  );

  return (
    <PopupModalWithTitle
      isOpen={Boolean(address)}
      title={
        <span className="capitalize">
          <T id="addNewContact" />
        </span>
      }
      onRequestClose={onClose}
    >
      <form className="px-4" onSubmit={handleSubmit(onAddContactSubmit)}>
        <div className="mb-8">
          <div className="text-base-plus text-white mb-3">
            <T id="address" />
          </div>
          <div className="mb-4 flex items-stretch border rounded-md px-4 py-14px">
            <Identicon
              type="bottts"
              hash={address ?? ''}
              size={32}
              className="flex-shrink-0 shadow-xs rounded-full overflow-hidden"
            />

            <div className="ml-3 flex-1 flex items-center">
              <span className="text-base-plus text-white">
                <HashShortView hash={address ?? ''} />
              </span>
            </div>
          </div>

          <FormField
            ref={register({
              required: t('required'),
              maxLength: { value: 50, message: t('maximalAmount', '50') }
            })}
            label={t('name')}
            id="name"
            name="name"
            placeholder={t('newContactPlaceholder')}
            errorCaption={errors.name?.message}
            containerClassName="mb-6"
            maxLength={50}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <ButtonRounded type="button" size="big" fill={false} onClick={onClose}>
            <T id="cancel" />
          </ButtonRounded>

          <FormSubmitButton small loading={submitting}>
            <T id="addContact" />
          </FormSubmitButton>
        </div>
      </form>
    </PopupModalWithTitle>
  );
};

export default AddContactModal;
