import { useOwnedUI } from 'lib/store/zustand/ui-client';

export const useUserTestingGroupNameSelector = () => useOwnedUI(({ ui }) => ui.abTestGroupName);
