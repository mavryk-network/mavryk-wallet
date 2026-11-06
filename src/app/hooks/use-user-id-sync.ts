import { useUserIdSelector } from 'app/store/settings/selectors';

/** Identity adoption and durable synchronization belong exclusively to the background owner before this hook mounts. */
export const useUserIdSync = () => {
  useUserIdSelector();
};
