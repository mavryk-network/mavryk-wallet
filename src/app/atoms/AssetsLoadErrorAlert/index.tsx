import React, { FC } from 'react';

import { Alert } from 'app/atoms/Alert';
import { t } from 'lib/i18n';

type AssetsLoadErrorAlertProps = {
  className?: string;
};

/** Shown above an asset list whose latest backend request failed, so a missing list isn't mistaken for "no assets". */
export const AssetsLoadErrorAlert: FC<AssetsLoadErrorAlertProps> = ({ className }) => (
  <Alert type="error" description={t('assetsLoadError')} className={className} />
);
