import { useCallback, useState } from 'react';

import { isEqual } from 'lodash';

import { useDidUpdate, useMemoWithCompare } from 'lib/ui/hooks';

/** Keep image progress across equivalent owner snapshots; changed source URLs start a new stack. */
export const useImagesStackLoading = (sources: string[]) => {
  const stack = useMemoWithCompare(() => sources, [sources], isEqual);
  const emptyStack = stack.length < 1;

  const [isLoading, setIsLoading] = useState(emptyStack === false);
  const [isStackFailed, setIsStackFailed] = useState(emptyStack);

  // Reset browser image loading only for changed URLs; no subscription or cleanup is needed.
  useDidUpdate(() => {
    const emptyStack = stack.length < 1;

    setIndex(emptyStack ? -1 : 0);
    setIsLoading(emptyStack === false);
    setIsStackFailed(emptyStack);
  }, [stack]);

  const [index, setIndex] = useState(emptyStack ? -1 : 0);

  const src = stack[index] as string | undefined;

  const onSuccess = useCallback(() => void setIsLoading(false), []);

  const onFail = useCallback(() => {
    if (isStackFailed) {
      return;
    }

    if (index + 1 === stack.length) {
      setIndex(-1);
      setIsLoading(false);
      setIsStackFailed(true);

      return;
    }

    setIndex(index + 1);
  }, [isStackFailed, stack.length, index]);

  return {
    src,
    isLoading,
    isStackFailed,
    onSuccess,
    onFail
  };
};
