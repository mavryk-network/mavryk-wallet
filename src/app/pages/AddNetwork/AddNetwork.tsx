import React, { useCallback, FC } from 'react';

import { useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { URL_PATTERN } from 'app/defaults';
import PageLayout from 'app/layouts/PageLayout';
import { T, t } from 'lib/i18n';
import { BLOCK_EXPLORERS, useBlockExplorer, useSetNetworkId, useSettings, useTempleClient } from 'lib/temple/front';
import { loadChainId } from 'lib/temple/helpers';
import { NETWORK_IDS, NETWORKS } from 'lib/temple/networks';
import { TempleChainId } from 'lib/temple/types';
import { COLORS } from 'lib/ui/colors';
import { delay } from 'lib/utils';
import { navigate } from 'lib/woozie';

import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import { CustomNetworkSettingsSelectors } from './AddNetwork.selectors';

interface NetworkFormData {
  name: string;
  rpcBaseURL: string;
}

const SUBMIT_ERROR_TYPE = 'submit-error';

export const AddNetworkScreen: FC = () => {
  const { updateSettings, defaultNetworks } = useTempleClient();
  const { customNetworks = [] } = useSettings();
  const { setExplorerId } = useBlockExplorer();
  const setNetworkId = useSetNetworkId();

  const {
    register,
    reset: resetForm,
    handleSubmit,
    formState,
    clearError,
    setError,
    errors,
    watch
  } = useForm<NetworkFormData>();
  const submitting = formState.isSubmitting;

  const name = watch('name');
  const rpcBaseURL = watch('rpcBaseURL');

  const allowSubmission = (name?.length > 0 && rpcBaseURL?.length > 0) ?? false;

  const rpcURLIsUnique = useCallback(
    (url: string) =>
      ![...defaultNetworks, ...customNetworks].filter(n => !n.hidden).some(({ rpcBaseURL }) => rpcBaseURL === url),
    [customNetworks, defaultNetworks]
  );

  const onNetworkFormSubmit = useCallback(
    async ({ rpcBaseURL, name }: NetworkFormData) => {
      if (submitting) return;

      if (NETWORKS.findIndex(n => n.rpcBaseURL === rpcBaseURL) === -1) {
        setError('rpcBaseURL', SUBMIT_ERROR_TYPE, t('invalidRpcNotSupported'));
        return;
      }

      clearError();

      let chainId: string = '';
      try {
        chainId = (await loadChainId(rpcBaseURL)) as string;

        if (chainId) {
          const currentBlockExplorerId =
            BLOCK_EXPLORERS.find(explorer => explorer.baseUrls.get(chainId as TempleChainId))?.id ?? 'tzkt';

          setExplorerId(currentBlockExplorerId);
        } else {
          setExplorerId('tzkt');
        }
      } catch (err: any) {
        console.error(err);

        await delay();

        setError('rpcBaseURL', SUBMIT_ERROR_TYPE, t('invalidRpcCantGetChainId'));

        return;
      }

      try {
        const networkId = NETWORK_IDS.get(chainId) ?? rpcBaseURL;

        await updateSettings({
          customNetworks: [
            ...customNetworks,
            {
              rpcBaseURL,
              name,
              description: name,
              type: networkId === 'mainnet' ? 'main' : 'test',
              disabled: false,
              color: COLORS[Math.floor(Math.random() * COLORS.length)],
              id: rpcBaseURL
            }
          ]
        });

        await delay();

        setNetworkId(rpcBaseURL);
        resetForm();

        navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'addNetwork',
          btnText: 'goToMain',
          description: 'addNetworkSuccessMsg',
          subHeader: 'success'
        });
      } catch (err: any) {
        console.error(err);

        await delay();

        setError('rpcBaseURL', SUBMIT_ERROR_TYPE, err.message);
      }
    },
    [submitting, clearError, setExplorerId, setError, setNetworkId, updateSettings, customNetworks, resetForm]
  );

  return (
    <PageLayout
      pageTitle={
        <>
          <T id={'addNetwork'} />
        </>
      }
      isTopbarVisible={false}
      contentContainerStyle={{ padding: 0 }}
    >
      {' '}
      <form onSubmit={handleSubmit(onNetworkFormSubmit)} className="h-full px-4 flex flex-col pt-4 flex-1">
        <FormField
          ref={register({ required: t('required'), maxLength: 35 })}
          label={t('name')}
          id="name"
          name="name"
          placeholder={t('networkNamePlaceholder')}
          errorCaption={errors.name?.message}
          containerClassName="mb-2"
          maxLength={35}
          testIDs={{
            input: CustomNetworkSettingsSelectors.nameInput,
            inputSection: CustomNetworkSettingsSelectors.nameInputSection
          }}
        />

        <FormField
          ref={register({
            required: t('required'),
            pattern: {
              value: URL_PATTERN,
              message: t('mustBeValidURL')
            },
            validate: {
              unique: rpcURLIsUnique
            }
          })}
          label={t('rpcBaseURL')}
          id="rpc-base-url"
          name="rpcBaseURL"
          placeholder={t('baseUrlPlaceholder')}
          errorCaption={
            errors.rpcBaseURL?.message || (errors.rpcBaseURL?.type === 'unique' ? t('networkMustBeUnique') : '')
          }
          containerClassName="mb-2shrink-1"
          testIDs={{
            input: CustomNetworkSettingsSelectors.RPCbaseURLinput,
            inputSection: CustomNetworkSettingsSelectors.RPCbaseURLinputSection
          }}
        />

        <FormSubmitButton
          className="mt-auto mb-8"
          loading={submitting}
          testID={CustomNetworkSettingsSelectors.addNetworkButton}
          disabled={!allowSubmission}
        >
          <T id="addNetwork" />
        </FormSubmitButton>
      </form>
    </PageLayout>
  );
};
