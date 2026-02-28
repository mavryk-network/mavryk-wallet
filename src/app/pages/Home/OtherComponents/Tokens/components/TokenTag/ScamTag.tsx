import React, { memo, useCallback } from 'react';

import clsx from 'clsx';

import { Button } from 'app/atoms/Button';
import { AssetsSelectors } from 'app/pages/Home/OtherComponents/Assets.selectors';
import { assetsStore } from 'lib/store/zustand/assets.store';
import { t } from 'lib/i18n';
import { useAccount, useChainId } from 'lib/temple/front';
import { useConfirm } from 'lib/ui/dialog';

import modStyles from '../../Tokens.module.css';

interface Props {
  assetSlug: string;
}

export const ScamTag = memo<Props>(({ assetSlug }) => {
  const chainId = useChainId(true)!;
  const { publicKeyHash } = useAccount();

  const confirm = useConfirm();

  const removeToken = useCallback(
    async (slug: string) => {
      try {
        const confirmed = await confirm({
          title: 'deleteScamTokenConfirmTitle',
          children: 'deleteScamTokenConfirmDescription',
          comfirmButtonText: t('delete')
        });

        if (confirmed)
          assetsStore.getState().setTokenStatus({
            account: publicKeyHash,
            chainId,
            slug,
            status: 'removed'
          });
      } catch (err: unknown) {
        console.error(err);
      }
    },
    [chainId, publicKeyHash, confirm]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      removeToken(assetSlug);
    },
    [assetSlug, removeToken]
  );

  return (
    <Button
      onClick={handleClick}
      className={clsx('uppercase ml-2 px-2 py-1', modStyles.tagBase, modStyles.scamTag)}
      testID={AssetsSelectors.assetItemScamButton}
    >
      Scam
    </Button>
  );
});
