import { useEffect } from 'react';

import { ANALYTICS_USER_ID_STORAGE_KEY } from 'lib/constants';
import { useUserId } from 'lib/store/zustand/ui.store';
import { usePassiveStorage } from 'lib/temple/front/storage';

export const useUserIdSync = () => {
  const [storedUserId, setStoredUserId] = usePassiveStorage<string | null>(ANALYTICS_USER_ID_STORAGE_KEY, null);
  const userId = useUserId();

  useEffect(() => {
    if (userId !== storedUserId) {
      setStoredUserId(userId);
    }
  }, [setStoredUserId, storedUserId, userId]);
};
