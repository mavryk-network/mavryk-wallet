import React, { FC } from 'react';

import PageLayout from 'app/layouts/PageLayout';
import SendForm from 'app/templates/SendForm';
import { t } from 'lib/i18n';

type SendProps = {
  assetSlug?: string | null;
};

const Send: FC<SendProps> = ({ assetSlug }) => (
  <PageLayout isTopbarVisible={false} pageTitle={<>{t('send')}</>}>
    <div className="w-full max-w-sm mx-auto min-h-full flex flex-col">
      <SendForm assetSlug={assetSlug} />
    </div>
  </PageLayout>
);

export default Send;
