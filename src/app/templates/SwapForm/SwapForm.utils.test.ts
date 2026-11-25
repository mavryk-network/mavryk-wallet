import { isSwapSubmitDisabled } from './SwapForm.utils';

describe('isSwapSubmitDisabled', () => {
  it('disables submit while quote data is fetching in the background', () => {
    expect(isSwapSubmitDisabled(false, false, true)).toBe(true);
  });

  it('allows submit only when the form is ready, not submitting, and quote data is not fetching', () => {
    expect(isSwapSubmitDisabled(false, false, false)).toBe(false);
  });
});
