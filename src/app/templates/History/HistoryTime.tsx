import React, { FC, useEffect, useState } from 'react';

import { formatDistanceToNow } from 'date-fns';

import { getDateFnsLocale } from 'lib/i18n';

type HistoryTimeProps = {
  addedAt?: string;
};

export const HistoryTime: FC<HistoryTimeProps> = ({ addedAt }) => {
  if (!addedAt) return null;
  return (
    <Time
      children={() => (
        <span className="text-sm text-secondary-white">
          {formatDistanceToNow(new Date(addedAt), {
            includeSeconds: true,
            addSuffix: true,
            locale: getDateFnsLocale()
          })}
        </span>
      )}
    />
  );
};

type TimeProps = {
  children: () => React.ReactElement;
};

const Time: React.FC<TimeProps> = ({ children }) => {
  const [value, setValue] = useState(children);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(children());
    }, 5_000);

    return () => {
      clearInterval(interval);
    };
  }, [setValue, children]);

  return value;
};
