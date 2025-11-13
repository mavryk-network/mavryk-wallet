import React, { FC, Suspense, useCallback, useMemo, useState } from 'react';

import type { WalletOperation } from '@mavrykdynamics/taquito';

import { AnalyticsEventCategory, useAnalytics } from 'lib/analytics';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useEnabledAccountTokensSlugs } from 'lib/assets/hooks';
import { useTokensSortPredicate } from 'lib/assets/use-sorting';
import { useTezos } from 'lib/temple/front';
import { useSafeState } from 'lib/ui/hooks';
import { HistoryAction, navigate } from 'lib/woozie';

import AssetSelect from '../AssetSelect';

import AddContactModal from './AddContactModal';
import { Form } from './Form';
import { SendFormSelectors } from './selectors';
import { SpinnerSection } from './SpinnerSection';

type SendFormProps = {
  assetSlug?: string | null;
};

const SendForm: FC<SendFormProps> = ({ assetSlug = MAV_TOKEN_SLUG }) => {
  const tokensSlugs = useEnabledAccountTokensSlugs();
  const assetsSortPredicate = useTokensSortPredicate();

  const assets = useMemo<string[]>(
    () => [MAV_TOKEN_SLUG, ...tokensSlugs].sort((a, b) => assetsSortPredicate(a, b)),
    [tokensSlugs, assetsSortPredicate]
  );
  const selectedAsset = useMemo(() => assets.find(a => a === assetSlug) ?? MAV_TOKEN_SLUG, [assets, assetSlug]);

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

  return (
    <>
      {/* {operation && <OperationStatus typeTitle={t('transaction')} operation={operation} className="mb-8" />} */}

      <AssetSelect value={selectedAsset} slugs={assets} onChange={handleAssetChange} className="mb-4 no-scrollbar" />

      <Suspense fallback={<SpinnerSection />}>
        <Form
          assetSlug={selectedAsset}
          operation={operation}
          setOperation={setOperation}
          onAddContactRequested={handleAddContactRequested}
        />
      </Suspense>

      <AddContactModal address={addContactModalAddress} onClose={closeContactModal} />
    </>
  );
};

export default SendForm;
