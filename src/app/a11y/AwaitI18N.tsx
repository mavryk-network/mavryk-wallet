import { FC } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';

import { onInited } from 'lib/i18n';
import { delay } from 'lib/utils';

const AwaitI18N: FC = () => {
  useSuspenseQuery({
    queryKey: ['i18n'],
    queryFn: awaitI18n,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  return null;
};

export default AwaitI18N;

async function awaitI18n() {
  try {
    await Promise.race([new Promise(r => onInited(() => r(null))), delay(3_000)]);
  } catch (err: any) {
    console.error(err);
  }
  return null;
}
