import React, { FC } from 'react';

import { T, TID } from 'lib/i18n';

export const AddBanner: FC<{ text: TID }> = ({ text }) => (
  <div className={'font-normal text-xs px-2 py-1 bg-indigo-add text-white ml-2 rounded'}>
    <T id={text} />
  </div>
);
