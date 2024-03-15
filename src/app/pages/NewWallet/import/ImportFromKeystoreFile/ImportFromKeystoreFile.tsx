import React, { FC, useCallback } from 'react';

import classNames from 'clsx';
import { Controller, FieldError, NestDataObject, useForm } from 'react-hook-form';

import { FileInputProps, FileInput, FormField, FormSubmitButton } from 'app/atoms';
import { ToggleButton, Toggle, ToggleOn, useToggle } from 'app/compound/Toggle';
import { useAppEnv } from 'app/env';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import { ReactComponent as FileIcon } from 'app/icons/file.svg';
import { T, t } from 'lib/i18n';
import { decryptKukaiSeedPhrase } from 'lib/temple/front';
import { AlertFn, useAlert } from 'lib/ui';

import { ImportPartialFormCheckboxes } from '../importPartialFormCheckboxes/ImportPartialFormCheckboxes';
import { useCreareOrRestorePassword } from '../useCreareOrRestorePassword';
import { ImportFromKeystoreFileSelectors } from './ImportFromKeystoreFile.selectors';

interface FormData {
  keystoreFile?: FileList;
  keystorePassword?: string;
}

interface ImportFromKeystoreFileProps {
  setSeedPhrase: (seed: string) => void;
  setKeystorePassword: (password: string) => void;
  setIsSeedEntered: (value: boolean) => void;
  seedPhrase: string;
  keystorePassword: string;
  isSeedEntered?: boolean;
  isFromKeystoreFileWithUpdatedPassword: boolean;
  setIsFromKeystoreFileWithUpdatedPassword: (value: boolean) => void;
}

export const ImportFromKeystoreFileComponent: FC<ImportFromKeystoreFileProps> = ({
  setSeedPhrase,
  setKeystorePassword,
  setIsSeedEntered,
  setIsFromKeystoreFileWithUpdatedPassword,
  seedPhrase,
  keystorePassword,
  isFromKeystoreFileWithUpdatedPassword,
  isSeedEntered = false
}) => {
  const { on } = useToggle();

  const {
    register: secondaryRegister,
    control: secondaryControl,
    errors: secondaryErrors,
    onSubmit: secondarySubmit,
    handleSubmit: secondaryHandleSubmit,
    submitting: secondarySubmitting
  } = useCreareOrRestorePassword(true, seedPhrase, keystorePassword);

  const { fullPage } = useAppEnv();

  const customAlert = useAlert();
  const { setValue, control, register, watch, handleSubmit, errors, triggerValidation, formState } = useForm<FormData>({
    mode: 'onChange'
  });
  const submitting = formState.isSubmitting || secondarySubmitting;

  const clearKeystoreFileInput = (event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
    event.stopPropagation();
    setValue('keystoreFile', undefined);
    triggerValidation('keystoreFile');
  };

  const watchedKeystoreFile = watch('keystoreFile');
  const watchedKeystorePassword = watch('keystorePassword');

  const isNextButtonDisabled = watchedKeystorePassword?.trim().length === 0 || !watchedKeystoreFile?.item(0);

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (submitting) return;
      try {
        const mnemonic = await decryptKukaiSeedPhrase(await data.keystoreFile!.item(0)!.text(), data.keystorePassword!);
        setSeedPhrase(mnemonic);
        setKeystorePassword(data.keystorePassword!);
        setIsSeedEntered(true);
      } catch (err: any) {
        handleKukaiWalletError(err, customAlert);
      }
    },
    [setSeedPhrase, setKeystorePassword, setIsSeedEntered, submitting, customAlert]
  );

  const handleUpdateKeystorePasswordSubmit = () => {
    setIsFromKeystoreFileWithUpdatedPassword(true);
  };

  const handleFinalSubmit = isSeedEntered
    ? on
      ? secondaryHandleSubmit(secondarySubmit)
      : handleUpdateKeystorePasswordSubmit
    : handleSubmit(onSubmit);

  return (
    <form
      className={classNames('w-full h-auto mx-auto flex flex-col no-scrollbar', fullPage ? 'pt-8 pb-11' : 'pt-4 pb-8')}
      style={{ height: 'calc(100% - 48px)' }}
      onSubmit={handleFinalSubmit}
    >
      <label className="mb-4 leading-tight flex flex-col">
        <span className="text-base-plus text-white">
          <T id="uploadFile" />
        </span>
      </label>

      <div className={classNames('w-full', fullPage ? 'mb-8' : 'mb-4')}>
        <Controller
          control={control}
          name="keystoreFile"
          as={KeystoreFileInput}
          rules={{
            required: t('required'),
            validate: validateKeystoreFile
          }}
          clearKeystoreFileInput={clearKeystoreFileInput}
        />
        <ErrorKeystoreComponent errors={errors} />
      </div>

      <FormField
        ref={register({
          required: t('required')
        })}
        label={t('filePassword')}
        placeholder={t('filePasswordInputPlaceholder')}
        id="keystore-password"
        type="password"
        name="keystorePassword"
        fieldWrapperBottomMargin={false}
        errorCaption={errors.keystorePassword?.message}
        testID={ImportFromKeystoreFileSelectors.filePasswordInput}
      />
      {isSeedEntered && !isFromKeystoreFileWithUpdatedPassword && (
        <>
          <div className=" w-full flex justify-between items-center mb-2 mt-4">
            <div className="text-base-plus text-white">
              <T id="useSamePassword" />
            </div>
            <ToggleButton />
          </div>
          <>
            <ToggleOn>
              <div className={classNames(fullPage && 'mt-6')}>
                <ImportPartialFormCheckboxes
                  control={secondaryControl}
                  errors={secondaryErrors}
                  register={secondaryRegister}
                />
              </div>
            </ToggleOn>
          </>
        </>
      )}

      <div className="flex-grow" />

      <FormSubmitButton
        loading={submitting}
        disabled={isNextButtonDisabled}
        className="w-full mt-8 mx-auto"
        testID={ImportFromKeystoreFileSelectors.nextButton}
      >
        <T id="next" />
      </FormSubmitButton>
    </form>
  );
};

export const ImportFromKeystoreFile: FC<ImportFromKeystoreFileProps> = props => {
  return (
    <Toggle>
      <ImportFromKeystoreFileComponent {...props} />
    </Toggle>
  );
};

type KeystoreFileInputProps = Pick<FileInputProps, 'value' | 'onChange' | 'name'> & {
  clearKeystoreFileInput: (e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => void;
};

const KeystoreFileInput: React.FC<KeystoreFileInputProps> = ({ value, name, clearKeystoreFileInput, onChange }) => {
  const keystoreFile = value?.item?.(0);
  const { fullPage } = useAppEnv();

  const restoreFileInputText = () => (
    <span>
      {t('fileInputPromptPart1')}
      <span className="text-accent-blue">{t('fileInputPromptPart2')}</span>
      {t('fileInputPromptPart3')}
    </span>
  );

  return (
    <FileInput name={name} multiple={false} accept=".tez" onChange={onChange} value={value}>
      <div
        className={classNames(
          'w-full bg-primary-card',
          keystoreFile ? 'p-4 flex items-center' : 'px-8 pt-6 pb-8 flex flex-col items-center',
          keystoreFile ? 'border-none rounded-md' : 'border-2 border-dashed border-divider',
          !keystoreFile && fullPage ? 'rounded-3xl' : 'rounded-2xl-plus',
          'focus:border-accent-blue',
          'transition ease-in-out duration-200',
          'text-white text-base-plus leading-tight',
          'placeholder-secondary-white'
        )}
      >
        <span className={classNames(keystoreFile && 'p-1 bg-gray-710 rounded mr-2')}>
          <FileIcon className={classNames(keystoreFile ? 'w-4 h-auto' : 'w-8 h-auto mb-4')} />
        </span>

        <div className={classNames('flex flex-row justify-center items-center', !keystoreFile && 'mb-2')}>
          <span className="text-base-plus leading-tight text-white text-center" style={{ wordBreak: 'break-word' }}>
            {keystoreFile?.name ?? restoreFileInputText()}
          </span>
        </div>
        {keystoreFile ? (
          <span
            className="border-full ml-auto z-30 cursor-pointer bg-gray-710 rounded-full"
            onClick={clearKeystoreFileInput}
          >
            <CloseIcon className="w-4 h-auto stroke-white" />
          </span>
        ) : (
          <span className="text-xs font-light text-secondary-white max-w-9/10">(*.tez)</span>
        )}
      </div>
    </FileInput>
  );
};

const validateKeystoreFile = (value?: FileList) => {
  const file = value?.item(0);

  if (file && !file.name.endsWith('.tez')) {
    return t('selectedFileFormatNotSupported');
  }
  return true;
};

const handleKukaiWalletError = (err: any, customAlert: AlertFn) => {
  customAlert({
    title: t('errorImportingKukaiWallet'),
    children: err instanceof SyntaxError ? t('fileHasSyntaxError') : err.message
  });
};

interface ErrorKeystoreComponentProps {
  errors: NestDataObject<FormData, FieldError>;
}

const ErrorKeystoreComponent: React.FC<ErrorKeystoreComponentProps> = ({ errors }) =>
  errors.keystoreFile ? <div className="text-xs text-primary-error mt-1">{errors.keystoreFile.message}</div> : null;
