import React, { FC, Suspense, useCallback, useMemo, useState } from 'react';

import type { WalletOperation } from '@taquito/taquito';

import { useOperationStatus } from 'app/hooks/use-operation-status';
import AssetSelect from 'app/templates/AssetSelect/AssetSelect';
import { IAsset } from 'app/templates/AssetSelect/interfaces';
import { getSlug } from 'app/templates/AssetSelect/utils';
import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { TEZ_TOKEN_SLUG } from 'lib/assets';
import { useAssetsSortPredicate } from 'lib/assets/use-filtered';
import { useAccount, useChainId, useTezos, useNFTTokens, useDisplayedFungibleTokens } from 'lib/temple/front';
import { useSafeState } from 'lib/ui/hooks';
import { HistoryAction, navigate } from 'lib/woozie';

import AddContactModal from './AddContactModal';
import { Form } from './Form';
import { SendFormSelectors } from './selectors';
import { SpinnerSection } from './SpinnerSection';

type SendFormProps = {
  assetSlug?: string | null;
};

const SendForm: FC<SendFormProps> = ({ assetSlug = TEZ_TOKEN_SLUG }) => {
  const chainId = useChainId(true)!;
  const account = useAccount();

  const { data: tokens = [] } = useDisplayedFungibleTokens(chainId, account.publicKeyHash);
  const { data: nfts = [] } = useNFTTokens(chainId, account.publicKeyHash, true);
  const assetsSortPredicate = useAssetsSortPredicate();

  const assets = useMemo<IAsset[]>(
    () => [TEZ_TOKEN_SLUG, ...tokens, ...nfts].sort((a, b) => assetsSortPredicate(getSlug(a), getSlug(b))),
    [tokens, nfts, assetsSortPredicate]
  );
  const selectedAsset = useMemo(
    () => assets.find(a => getSlug(a) === assetSlug) ?? TEZ_TOKEN_SLUG,
    [assets, assetSlug]
  );

  const tezos = useTezos();
  const [operation, setOperation] = useSafeState<WalletOperation | null>(null, tezos.checksum);
  const [addContactModalAddress, setAddContactModalAddress] = useState<string | null>(null);
  const { trackEvent } = useAnalytics();

  const handleAssetChange = useCallback(
    (aSlug: string) => {
      trackEvent(SendFormSelectors.assetItemButton, AnalyticsEventCategory.ButtonPress);
      navigate(`/send/${aSlug}`, HistoryAction.Replace);
    },
    [trackEvent]
  );

  const handleAddContactRequested = useCallback(
    (address: string) => {
      setAddContactModalAddress(address);
    },
    [setAddContactModalAddress]
  );

  const closeContactModal = useCallback(() => {
    setAddContactModalAddress(null);
  }, [setAddContactModalAddress]);

  const navigateProps = useMemo(
    () => ({
      pageTitle: 'send',
      btnText: 'goToMain',
      contentId: 'hash',
      // @ts-expect-error
      contentIdFnProps: { hash: operation?.opHash ?? operation?.hash, i18nKey: 'send' },
      subHeader: 'success'
    }),
    // @ts-expect-error
    [operation?.hash, operation?.opHash]
  );

  // @ts-expect-error
  useOperationStatus(operation, navigateProps);

  return (
    <>
      {/* {operation && <OperationStatus typeTitle={t('transaction')} operation={operation} className="mb-8" />} */}

      <AssetSelect
        value={selectedAsset}
        assets={assets}
        onChange={handleAssetChange}
        className="mb-6 no-scrollbar"
        testIDs={{
          main: SendFormSelectors.assetDropDown,
          searchInput: SendFormSelectors.assetDropDownSearchInput
        }}
      />

      <Suspense fallback={<SpinnerSection />}>
        <Form
          assetSlug={getSlug(selectedAsset)}
          setOperation={setOperation}
          onAddContactRequested={handleAddContactRequested}
        />
      </Suspense>

      <AddContactModal address={addContactModalAddress} onClose={closeContactModal} />
    </>
  );
};

export default SendForm;
