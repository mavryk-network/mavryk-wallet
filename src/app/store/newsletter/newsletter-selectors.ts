import { useOwnedUI } from 'lib/store/zustand/ui-client';

export const useShouldShowNewsletterModalSelector = () => useOwnedUI(({ ui }) => ui.shouldShowNewsletterModal);
