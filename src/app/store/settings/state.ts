import { nanoid } from '@reduxjs/toolkit';

import { BalanceMode } from './balance-mode.enum';

export { BalanceMode } from './balance-mode.enum';

export interface SettingsState {
  userId: string;
  isAnalyticsEnabled: boolean;
  balanceMode: BalanceMode;
  isOnRampPossibility: boolean;
}

export const settingsInitialState: SettingsState = {
  userId: nanoid(),
  isAnalyticsEnabled: true,
  balanceMode: BalanceMode.Fiat,
  isOnRampPossibility: false
};
