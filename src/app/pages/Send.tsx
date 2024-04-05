import React, { FC } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import SendForm from 'app/templates/SendForm';
import { t } from 'lib/i18n';

type SendProps = {
  assetSlug?: string | null;
};

const Send: FC<SendProps> = ({ assetSlug }) => {
  const { popup } = useAppEnv();

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<>{t('send')}</>}>
      <div className={clsx('w-full  mx-auto min-h-full flex flex-col', popup ? 'max-w-sm' : 'max-w-screen-xxs')}>
        <SendForm assetSlug={assetSlug} />
      </div>
    </PageLayout>
  );
};

export default Send;
