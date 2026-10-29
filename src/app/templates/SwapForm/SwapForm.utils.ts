export const isSwapSubmitDisabled = (isFormBtnDisabled: boolean, isSubmitting: boolean, isQuoteFetching: boolean) =>
  isFormBtnDisabled || isSubmitting || isQuoteFetching;
