import React, { FC, memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import { Divider, HashChip, Spinner } from 'app/atoms';
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
import useTippy from 'lib/ui/useTippy';

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
        <T id={assetType === AssetTypesEnum.Collectibles ? 'manageCollectibles' : 'manageAssets'} />
      </>
    }
  >
    <ManageAssetsContent assetType={assetType} />
  </PageLayout>
);

export default ManageAssets;

const tippyPropsDeleteBtn = {
  trigger: 'mouseenter',
  hideOnClick: false,
  content: t('delete'),
  animation: 'shift-away-subtle'
};

const tippyPropsHideBtn = { ...tippyPropsDeleteBtn, content: t('hideUnhide') };

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

  const buttonHideRef = useTippy<HTMLButtonElement>(tippyPropsHideBtn);
  const buttonDeleteRef = useTippy<HTMLButtonElement>(tippyPropsDeleteBtn);

  const handleAssetUpdate = useCallback(
    async (assetSlug: string, status: ITokenStatus) => {
      try {
        await setTokenStatus(chainId, address, assetSlug, status);
        await mutate();
      } catch (err: any) {
        console.error(err);
        alert(err.message);
      }
    },
    [chainId, address, mutate]
  );

  const handleDeleteSelectedTokens = useCallback(async () => {
    const confirmed = await confirm({
      title: assetType === AssetTypesEnum.Collectibles ? t('deleteCollectibleConfirm') : t('deleteAssets'),
      children: (
        <div className="flex flex-col gap-1 mx-auto" style={{ maxWidth: 270 }}>
          <div>
            <T id={'areYousureAssetModalDeleteAction'} />
          </div>
          <T id={'assetsModalDeleteDescr'} />
        </div>
      ),
      comfirmButtonText: t('delete')
    });
    if (!confirmed) return;
    const promises = selectedAssets.map(async slug => {
      return await handleAssetUpdate(slug, ITokenStatus.Removed);
    });

    await Promise.all(promises);
    setSelectedAssets([]);
    setSelectedOption(null);
  }, [confirm, handleAssetUpdate, selectedAssets]);

  const handleHideSelectedTokens = useCallback(async () => {
    const status = selectedAssets.some(slug => assetsStatuses[slug]?.displayed)
      ? ITokenStatus.Disabled
      : ITokenStatus.Enabled;

    const promises = selectedAssets.map(async slug => {
      return await handleAssetUpdate(slug, status);
    });

    await Promise.all(promises);
    setSelectedAssets([]);
    setSelectedOption(null);
  }, [assetsStatuses, handleAssetUpdate, selectedAssets]);

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

  const sortedAssets = useMemo(
    () =>
      filteredAssets.sort((a, b) => {
        if (assetsStatuses[a]?.displayed === assetsStatuses[b]?.displayed) {
          return 0;
        } else if (assetsStatuses[a]?.displayed) {
          return -1;
        } else {
          return 1;
        }
      }),
    [assetsStatuses, filteredAssets]
  );

  const noItemsSelected = !selectedAssets.length;

  return (
    <div className="w-full max-w-sm mx-auto mb-6 h-full">
      <div>
        <SearchAssetField
          value={searchValue}
          onValueChange={setSearchValue}
          testID={ManageAssetsSelectors.searchAssetsInput}
        />
        <div className="mt-4 flex items-center justify-between">
          <CounterSelect selectedCount={selectedAssets.length} options={options} unselectAll={unselectAll} />

          <div
            className={classNames(
              'flex items-center gap-1 transition duration-300 ease-in-out',
              noItemsSelected && 'pointer-events-none opacity-75'
            )}
          >
            <button ref={buttonHideRef}>
              <EyeIcon className="w-6 h-6 fill-white cursor-pointer" onClick={handleHideSelectedTokens} />
            </button>
            <button ref={buttonDeleteRef}>
              <TrashIcon className="w-6 h-6 fill-white cursor-pointer" onClick={handleDeleteSelectedTokens} />
            </button>
          </div>
        </div>
        <Divider ignoreParent color="bg-divider" className="mt-4" />
      </div>

      {sortedAssets.length > 0 ? (
        <div className="flex flex-col w-full overflow-hidden rounded-md text-white text-base-plus">
          {sortedAssets.map((slug, i, arr) => {
            const last = i === arr.length - 1;

            return (
              <ListItem
                key={slug.concat(i.toString())}
                assetSlug={slug}
                last={last}
                checked={Boolean(selectedAssets.find(asset => asset === slug)) ?? false}
                hidden={!assetsStatuses[slug]?.displayed ?? false}
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
  hidden: boolean;
};

const ListItem = memo<ListItemProps>(({ assetSlug, last, checked, balance, hidden, setSelectedAssets }) => {
  const metadata = useAssetMetadata(assetSlug);

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      setSelectedAssets(prev =>
        checked ? [...new Set([...prev, assetSlug])] : prev.filter(asset => asset !== assetSlug)
      );
    },
    [assetSlug, setSelectedAssets]
  );

  return (
    <label
      className={classNames(
        'relative',
        !last && 'border-b border-divider',
        'w-full flex items-center py-2 text-white',
        'focus:outline-none overflow-hidden cursor-pointer',
        'transition ease-in-out duration-200'
      )}
      {...setTestID(ManageAssetsSelectors.assetItem)}
      {...setAnotherSelector('slug', assetSlug)}
    >
      <Checkbox checked={checked} onChange={handleCheckboxChange} overrideClassNames="w-4 h-4 rounded" />
      <div className="relative">
        <AssetIcon
          assetSlug={assetSlug}
          size={44}
          className="mr-3 ml-3 flex-shrink-0 w-11 h-11 rounded-full overflow-hidden"
        />
        {hidden && (
          <div className={classNames('w-11 h-11 bg-primary-bg opacity-75', styles.hiddenAsset)}>
            <EyeIcon className="w-6 h-6 fill-white cursor-pointer" />
          </div>
        )}
      </div>
      <div className={classNames('flex items-center', styles.tokenInfoWidth)}>
        <div className="flex flex-col items-start w-full">
          <div
            className="text-base-plus text-white truncate w-full"
            style={{ marginBottom: '0.125rem', lineHeight: '19px' }}
          >
            {getAssetName(metadata)}
          </div>

          <div className="text-sm text-secondary-white truncate w-full flex items-center">
            {`${getAssetSymbol(metadata)} |`}&nbsp;
            <HashChip
              hash={metadata?.address ?? t('unknown')}
              small
              showIcon={false}
              className="text-sm"
              firstCharsCount={5}
              lastCharsCount={4}
            />
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div
        className={classNames(
          'flex items-center gap-1 p-1 rounded-full text-white text-sm flex-wrap',
          'transition ease-in-out duration-200'
        )}
      >
        <CryptoBalance value={balance} testIDProperties={{ assetSlug }} />
      </div>
    </label>
  );
});

interface LoadingComponentProps {
  loading: boolean;
  searchValue: string;
  assetType: string;
}

const LoadingComponent: React.FC<LoadingComponentProps> = ({ loading, searchValue }) => {
  return loading ? (
    <Spinner theme="primary" className="w-20 mx-auto my-11" />
  ) : (
    <div className="my-8 flex flex-col items-center justify-center text-white">
      <p className="mb-2 flex items-center justify-center text-white text-base-plus">
        {Boolean(searchValue) && <SearchIcon className="w-5 h-auto mr-1 stroke-current" />}

        <span {...setTestID(ManageAssetsSelectors.emptyStateText)}>
          <T id="noAssetsFound" />
        </span>
      </p>

      <p className="text-center text-sm text-secondary-white">
        <T id="ifYouDontSeeYourAsset" substitutions={[<RenderAssetComponent />]} />
      </p>
    </div>
  );
};

const RenderAssetComponent: React.FC = () => (
  <b>
    <T id={'addAsset'} />
  </b>
);
