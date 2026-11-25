import { useCallback, useState } from 'react';

export const usePopupState = (initial = false) => {
  const [opened, setOpened] = useState(initial);
  const open = useCallback(() => setOpened(true), []);
  const close = useCallback(() => setOpened(false), []);
  return { opened, open, close };
};
