/**
 * Tests for UIStore — privacyMode state and togglePrivacyMode action.
 */

import { uiStore } from '../ui.store';

beforeEach(() => {
  uiStore.setState({ privacyMode: false });
});

describe('UIStore — privacyMode', () => {
  it('defaults to false', () => {
    expect(uiStore.getState().privacyMode).toBe(false);
  });

  it('toggles to true after one call', () => {
    uiStore.getState().togglePrivacyMode();
    expect(uiStore.getState().privacyMode).toBe(true);
  });

  it('toggles back to false after two calls', () => {
    uiStore.getState().togglePrivacyMode();
    uiStore.getState().togglePrivacyMode();
    expect(uiStore.getState().privacyMode).toBe(false);
  });
});
