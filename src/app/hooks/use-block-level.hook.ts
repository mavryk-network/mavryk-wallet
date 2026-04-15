import { useEffect, useState } from 'react';

import { useMavryk } from 'lib/temple/front';

export const useBlockLevel = () => {
  const mavryk = useMavryk();

  const [blockLevel, setBlockLevel] = useState<number>();

  useEffect(() => {
    const subscription = mavryk.stream.subscribeBlock('head');

    subscription.on('data', block => setBlockLevel(block.header.level));

    return () => subscription.close();
  }, [mavryk]);

  return blockLevel;
};
