import React from 'react';

import { ReactComponent as SettingsIcon } from 'app/icons/settings-dots.svg';
import { Link } from 'lib/woozie';

export const ManageAssetsButton = () => {
  return (
    <Link to="/manage-assets" className="w-6 h-6">
      <SettingsIcon className="w-6 h-6 cursor-pointer" />;
    </Link>
  );
};
