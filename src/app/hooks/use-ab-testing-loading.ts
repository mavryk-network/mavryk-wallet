import { useEffect } from 'react';

import { fetchABGroup, ABTestGroup } from 'lib/apis/temple';
import { uiStore } from 'lib/store/zustand/ui.store';

export const useABTestingLoading = () => {
  useEffect(() => {
    const currentGroup = uiStore.getState().abTestGroupName;
    if (currentGroup !== ABTestGroup.Unknown) return;

    fetchABGroup().then(group => {
      uiStore.getState().setAbTestGroupName(group);
    });
  }, []);
};
