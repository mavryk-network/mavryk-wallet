import React, { FC, useMemo } from 'react';

import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { T } from 'lib/i18n';

export const ManageAccounts: FC = () => {
  const { popup } = useAppEnv();

  const memoizedContentContainerStyle = useMemo(() => (popup ? { padding: 0 } : {}), [popup]);

  return (
    <PageLayout
      pageTitle={
        <>
          <T id={'manageAccounts'} />
        </>
      }
      isTopbarVisible={false}
      contentContainerStyle={memoizedContentContainerStyle}
    >
      Manage Accounts
    </PageLayout>
  );
};
