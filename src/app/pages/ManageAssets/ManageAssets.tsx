import React, { FC, memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { Divider, HashChip } from 'app/atoms';
import Checkbox from 'app/atoms/Checkbox';
import { useBalancesWithDecimals } from 'app/hooks/use-balances-with-decimals.hook';
import { ReactComponent as EyeIcon } from 'app/icons/eye-closed-thin.svg';
import { ReactComponent as SearchIcon } from 'app/icons/search.svg';
import { ReactComponent as TrashIcon } from 'app/icons/trash.svg';
import PageLayout from 'app/layouts/PageLayout';
import { TopbarRightText } from 'app/molecules/TopbarRightText';
import { ManageAssetsSelectors } from 'app/pages/ManageAssets/ManageAssets.selectors';
import { AssetIcon } from 'app/templates/AssetIcon';
import { CounterSelect, CounterSelectOptionType } from 'app/templates/CounterSelect';
import SearchAssetField from 'app/templates/SearchAssetField';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { AssetTypesEnum } from 'lib/assets/types';
import { useFilteredAssetsSlugs } from 'lib/assets/use-filtered';
import { T, t } from 'lib/i18n';
import { useAssetMetadata, getAssetName, getAssetSymbol } from 'lib/metadata';
import { setTokenStatus } from 'lib/temple/assets';
import { useAccount, useChainId, useAvailableAssetsSlugs } from 'lib/temple/front';
import { ITokenStatus } from 'lib/temple/repo';
import { useConfirm } from 'lib/ui/dialog';

import { CryptoBalance } from '../Home/OtherComponents/Tokens/components/Balance';
import { SELECT_ALL_ASSETS, SELECT_HIDDEN_ASSETS } from './manageAssets.const';
import styles from './ManageAssets.module.css';
import { ManageAssetsSelectOptionType } from './manageAssets.types';

interface Props {
  assetType: string;
}

const ManageAssets: FC<Props> = ({ assetType }) => (
  <PageLayout
    isTopbarVisible={false}
    RightSidedComponent={<TopbarRightText linkTo="/add-asset" label={t('add')} />}
    pageTitle={
      <>
        <T id="manageAssets" />
      </>
    }
  >
    <ManageAssetsContent assetType={assetType} />
  </PageLayout>
);

export default ManageAssets;

type SelectedAssetsToUpdate = {
  assetSlug: string;
  ITokenStatus: ITokenStatus;
};

const ManageAssetsContent: FC<Props> = ({ assetType }) => {
  const chainId = useChainId(true)!;
  const account = useAccount();
  const balances = useBalancesWithDecimals();
  const address = account.publicKeyHash;

  const { availableAssets, assetsStatuses, isLoading, mutate } = useAvailableAssetsSlugs(
    assetType === AssetTypesEnum.Collectibles ? AssetTypesEnum.Collectibles : AssetTypesEnum.Tokens
  );
  const { filteredAssets, searchValue, setSearchValue } = useFilteredAssetsSlugs(availableAssets, false);

  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<ManageAssetsSelectOptionType | null>(null);

  const confirm = useConfirm();

  const handleAssetUpdate = useCallback(
    async (assetSlug: string, status: ITokenStatus) => {
      try {
        if (status === ITokenStatus.Removed) {
          const confirmed = await confirm({
            title: t('deleteTokenConfirm')
          });
          if (!confirmed) return;
        }

        await setTokenStatus(chainId, address, assetSlug, status);
        await mutate();
      } catch (err: any) {
        console.error(err);
        alert(err.message);
      }
    },
    [chainId, address, confirm, mutate, assetType]
  );

  const unselectAll = useCallback(() => {
    setSelectedAssets([]);
    setSelectedOption(null);
  }, []);

  const selectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedOption(SELECT_ALL_ASSETS);
        setSelectedAssets(filteredAssets);
      } else {
        unselectAll();
      }
    },
    [filteredAssets, unselectAll]
  );

  const hiddenAssets = useMemo(
    () => filteredAssets.filter(slug => !assetsStatuses[slug]?.displayed),
    [assetsStatuses, filteredAssets]
  );

  const selectAllHidden = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedOption(SELECT_HIDDEN_ASSETS);
        setSelectedAssets(hiddenAssets);
      } else {
        unselectAll();
      }
    },
    [hiddenAssets, unselectAll]
  );

  const options: CounterSelectOptionType[] = useMemo(
    () => [
      {
        checked: selectedOption === SELECT_HIDDEN_ASSETS,
        type: SELECT_HIDDEN_ASSETS,
        content: (
          <>
            <T id="selectHidden" />
            &nbsp; ({hiddenAssets.length})
          </>
        ),
        handleChange: selectAllHidden
      },
      {
        checked: selectedOption === SELECT_ALL_ASSETS,
        type: SELECT_ALL_ASSETS,
        content: (
          <>
            <T id="selectAll" />
            &nbsp; ({filteredAssets.length})
          </>
        ),
        handleChange: selectAll
      }
    ],
    [filteredAssets.length, hiddenAssets.length, selectAll, selectAllHidden, selectedOption]
  );

  return (
    <div className="w-full max-w-sm mx-auto mb-6">
      <div>
        <SearchAssetField
          value={searchValue}
          onValueChange={setSearchValue}
          testID={ManageAssetsSelectors.searchAssetsInput}
        />
        <div className="mt-4 flex items-center justify-between">
          <CounterSelect selectedCount={selectedAssets.length} options={options} unselectAll={unselectAll} />

          <div className="flex items-center gap-1">
            <EyeIcon className="w-6 h-6 fill-white cursor-pointer" />
            <TrashIcon className="w-6 h-6 fill-white cursor-pointer" />
          </div>
        </div>
        <Divider ignoreParent color="bg-divider" className="mt-4" />
      </div>

      {filteredAssets.length > 0 ? (
        <div className="flex flex-col w-full overflow-hidden rounded-md text-white text-base-plus">
          {filteredAssets.map((slug, i, arr) => {
            const last = i === arr.length - 1;

            return (
              <ListItem
                key={slug}
                assetSlug={slug}
                last={last}
                checked={Boolean(selectedAssets.find(asset => asset === slug)) ?? false}
                assetType={assetType}
                balance={balances[assetType] ?? new BigNumber(0)}
                address={address}
                setSelectedAssets={setSelectedAssets}
              />
            );
          })}
        </div>
      ) : (
        <LoadingComponent loading={isLoading} searchValue={searchValue} assetType={assetType} />
      )}
    </div>
  );
};

type ListItemProps = {
  assetSlug: string;
  last: boolean;
  checked: boolean;
  setSelectedAssets: React.Dispatch<React.SetStateAction<string[]>>;
  assetType: string;
  balance: BigNumber;
  address: string;
};

const ListItem = memo<ListItemProps>(({ assetSlug, last, checked, balance, address, setSelectedAssets }) => {
  const metadata = useAssetMetadata(assetSlug);

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      // onUpdate(assetSlug, checked ? ITokenStatus.Enabled : ITokenStatus.Disabled);

      setSelectedAssets(prev =>
        checked ? [...new Set([...prev, assetSlug])] : prev.filter(asset => asset !== assetSlug)
      );
    },
    [assetSlug, setSelectedAssets]
  );

  return (
    <label
      className={classNames(
        !last && 'border-b border-divider',
        'w-full flex items-center py-2 text-white',
        'focus:outline-none overflow-hidden cursor-pointer',
        'transition ease-in-out duration-200'
      )}
      {...setTestID(ManageAssetsSelectors.assetItem)}
      {...setAnotherSelector('slug', assetSlug)}
    >
      <Checkbox checked={checked} onChange={handleCheckboxChange} />
      <AssetIcon assetSlug={assetSlug} size={44} className="mr-3 ml-4 flex-shrink-0" />

      <div className={classNames('flex items-center', styles.tokenInfoWidth)}>
        <div className="flex flex-col items-start w-full">
          <div className="text-base-plus text-white truncate w-full" style={{ marginBottom: '0.125rem' }}>
            {getAssetName(metadata)}
          </div>

          <div className="text-sm text-secondary-white truncate w-full flex items-center">
            {`${getAssetSymbol(metadata)} |`}&nbsp;
            <HashChip hash={address} small showIcon={false} />
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div
        className={classNames(
          'flex items-center gap-1 mr-2 p-1 rounded-full text-white text-sm flex-wrap',
          'transition ease-in-out duration-200'
        )}
        // onClick={evt => {
        //   evt.preventDefault();
        //   onUpdate(assetSlug, ITokenStatus.Removed);
        // }}
      >
        <CryptoBalance value={balance} testIDProperties={{ assetSlug }} />
        {getAssetSymbol(metadata)}
      </div>
    </label>
  );
});

interface LoadingComponentProps {
  loading: boolean;
  searchValue: string;
  assetType: string;
}

const LoadingComponent: React.FC<LoadingComponentProps> = ({ loading, searchValue, assetType }) => {
  return loading ? null : (
    <div className="my-8 flex flex-col items-center justify-center text-white">
      <p className="mb-2 flex items-center justify-center text-white text-base-plus">
        {Boolean(searchValue) && <SearchIcon className="w-5 h-auto mr-1 stroke-current" />}

        <span {...setTestID(ManageAssetsSelectors.emptyStateText)}>
          <T id="noAssetsFound" />
        </span>
      </p>

      <p className="text-center text-sm text-secondary-white">
        <T id="ifYouDontSeeYourAsset" substitutions={[<RenderAssetComponent assetType={assetType} />]} />
      </p>
    </div>
  );
};

const RenderAssetComponent: React.FC<{ assetType: string }> = ({ assetType }) => (
  <b>{assetType === AssetTypesEnum.Collectibles ? <T id={'addCollectible'} /> : <T id={'addToken'} />}</b>
);
