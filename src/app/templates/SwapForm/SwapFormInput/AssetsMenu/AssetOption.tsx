import React, { FC } from 'react';

import classNames from 'clsx';

import { AssetIcon } from 'app/templates/AssetIcon';
import { AssetItemContent } from 'app/templates/AssetItemContent';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { useAssetMetadata } from 'lib/metadata';
import { isTruthy } from 'lib/utils';

import { AssetsMenuSelectors } from './selectors';

interface Props {
  assetSlug: string;
  selected?: boolean;
}

export const AssetOption: FC<Props> = ({ assetSlug, selected }) => {
  const assetMetadata = useAssetMetadata(assetSlug);

  if (!isTruthy(assetMetadata)) return null;

  return (
    <div
      className={classNames(
        'flex items-center w-full p-4 h-14',
        selected ? 'bg-gray-710' : 'bg-primary-card hover:bg-gray-710'
      )}
      {...setTestID(AssetsMenuSelectors.assetsMenuAssetItem)}
      {...setAnotherSelector('slug', assetSlug)}
    >
      <AssetIcon assetSlug={assetSlug} className="mr-2" size={32} />

      <AssetItemContent slug={assetSlug} />
    </div>
  );
};
