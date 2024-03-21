import React, { FC, useEffect, useMemo, useState } from 'react';

import { format, isToday } from 'date-fns';

type HistoryTimeProps = {
  addedAt?: string;
  showFullDate?: boolean;
};

export const HistoryTime: FC<HistoryTimeProps> = ({ addedAt = Date.now(), showFullDate = false }) => {
  const dateFormatType = useMemo(() => (showFullDate ? 'd MMMM yyyy, h:mm aaa' : 'd MMMM yyyy'), [showFullDate]);

  const dateToreturn = useMemo(
    () =>
      isToday(new Date(addedAt))
        ? `Today at ${format(new Date(addedAt), 'h:mm aaa')}`
        : format(new Date(addedAt), dateFormatType),
    [addedAt, dateFormatType]
  );

  if (!addedAt) return null;

  return <Time children={() => <span className="text-sm text-secondary-white">{dateToreturn}</span>} />;
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
