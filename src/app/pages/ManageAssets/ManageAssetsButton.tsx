import React, { FC } from 'react';

import { ReactComponent as SettingsIcon } from 'app/icons/settings-dots.svg';
import { AssetTypesEnum } from 'lib/assets/types';
import { Link } from 'lib/woozie';

type ManageAssetsButtonProps = {
  assetSlug?: string | null;
};

//*
//  assetSlug -  enum(Tokens | NFTs),  by default redirects to tokens asset page
//
export const ManageAssetsButton: FC<ManageAssetsButtonProps> = ({ assetSlug = AssetTypesEnum.Tokens }) => {
  return (
    <Link to={`/manage-assets/${assetSlug}`} className="w-6 h-6">
      <SettingsIcon className="w-6 h-6 cursor-pointer" />;
    </Link>
  );
};
