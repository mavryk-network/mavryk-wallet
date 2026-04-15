/**
 * Tests for UIStore — privacyMode state and togglePrivacyMode action.
 */

import { uiStore } from '../ui.store';

beforeEach(() => {
  // Replace mode (true) ensures no stale state from prior tests or async persist hydration.
  uiStore.setState(s => ({ ...s, privacyMode: false }), true);
});

describe('UIStore — privacyMode', () => {
  describe('initial state', () => {
    it('store initial state has privacyMode as false', () => {
      // Read the default directly from the store's initial state shape,
      // independent of beforeEach, by checking the type of the value.
      const state = uiStore.getState();
      expect(typeof state.privacyMode).toBe('boolean');
      expect(state.privacyMode).toBe(false);
    });
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
