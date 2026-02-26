import React, { memo } from 'react';

import { SyncSpinner } from 'app/atoms';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { T, TID } from 'lib/i18n';

const buttonStyle = { maxHeight: 27, display: 'flex', alignItems: 'center' };

interface AssetListEmptySectionProps {
  isSyncing: boolean;
  /** i18n key for the empty-state message text */
  messageI18nKey: TID;
  /** i18n key for the disabled action button label */
  buttonI18nKey: TID;
}

/**
 * Shared empty-state section for asset listing tabs (Collectibles, RWAs).
 * Shows a spinner while syncing, or an empty-state message with a disabled button.
 */
export const AssetListEmptySection = memo<AssetListEmptySectionProps>(
  ({ isSyncing, messageI18nKey, buttonI18nKey }) =>
    isSyncing ? (
      <SyncSpinner className="pt-4" />
    ) : (
      <div className="w-full py-23 flex flex-col items-center gap-y-4">
        <p className={'text-white text-base-plus text-center'}>
          <T id={messageI18nKey} />
        </p>
        <ButtonRounded type="button" size="small" fill style={buttonStyle} disabled>
          <T id={buttonI18nKey} />
        </ButtonRounded>
      </div>
    )
);
