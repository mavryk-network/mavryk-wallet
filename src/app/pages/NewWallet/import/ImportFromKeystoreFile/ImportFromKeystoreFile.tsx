import React, { FC, useCallback } from 'react';

import classNames from 'clsx';
import { Controller, FieldError, NestDataObject, useForm } from 'react-hook-form';

import { FileInputProps, FileInput, FormField, FormSubmitButton } from 'app/atoms';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import { ReactComponent as FileIcon } from 'app/icons/file.svg';
import { T, t } from 'lib/i18n';
import { decryptKukaiSeedPhrase } from 'lib/temple/front';
import { AlertFn, useAlert } from 'lib/ui';

import { ImportFromKeystoreFileSelectors } from './ImportFromKeystoreFile.selectors';

interface FormData {
  keystoreFile?: FileList;
  keystorePassword?: string;
}

interface ImportFromKeystoreFileProps {
  setSeedPhrase: (seed: string) => void;
  setKeystorePassword: (password: string) => void;
  setIsSeedEntered: (value: boolean) => void;
}

export const ImportFromKeystoreFile: FC<ImportFromKeystoreFileProps> = ({
  setSeedPhrase,
  setKeystorePassword,
  setIsSeedEntered
}) => {
  const customAlert = useAlert();
  const { setValue, control, register, handleSubmit, errors, triggerValidation, formState } = useForm<FormData>({
    mode: 'onChange'
  });
  const submitting = formState.isSubmitting;

  const clearKeystoreFileInput = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    event.stopPropagation();
    setValue('keystoreFile', undefined);
    triggerValidation('keystoreFile');
  };

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

  return (
    <form
      className="w-full max-w-sm mx-auto my-4 pb-8 flex flex-col"
      style={{ height: 'calc(100% - 46px)' }}
      onSubmit={handleSubmit(onSubmit)}
    >
      <label className="mb-4 leading-tight flex flex-col">
        <span className="text-base-plus font-semibold text-white">
          <T id="uploadFile" />
        </span>
      </label>

      <div className="w-full mb-4">
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
        errorCaption={errors.keystorePassword?.message}
        testID={ImportFromKeystoreFileSelectors.filePasswordInput}
      />
      <FormSubmitButton
        loading={submitting}
        className="w-full mt-auto mx-auto"
        testID={ImportFromKeystoreFileSelectors.nextButton}
      >
        <T id="next" />
      </FormSubmitButton>
    </form>
  );
};

type KeystoreFileInputProps = Pick<FileInputProps, 'value' | 'onChange' | 'name'> & {
  clearKeystoreFileInput: (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => void;
};

const KeystoreFileInput: React.FC<KeystoreFileInputProps> = ({ value, name, clearKeystoreFileInput, onChange }) => {
  const keystoreFile = value?.item?.(0);

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
          keystoreFile ? 'border-none rounded-md' : 'border-2 border-dashed border-divider rounded-md',
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
  errors.keystoreFile ? <div className="text-xs text-red-500 mt-1">{errors.keystoreFile.message}</div> : null;
