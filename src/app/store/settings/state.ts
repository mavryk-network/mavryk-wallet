import { BalanceMode } from './balance-mode.enum';

export { BalanceMode } from './balance-mode.enum';

export interface SettingsState {
  userId: string;
  isAnalyticsEnabled: boolean;
  balanceMode: BalanceMode;
  isOnRampPossibility: boolean;
}

export const settingsInitialState: SettingsState = {
  // Retired Redux identity slot; the background owner adopts/generates the live ID after successful reads.
  userId: '',
  isAnalyticsEnabled: true,
  balanceMode: BalanceMode.Fiat,
  isOnRampPossibility: false
};
