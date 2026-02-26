import { FormState, FieldValues } from 'react-hook-form';

import { isTruthy } from 'lib/utils';

export const shouldShowFieldError = <T extends FieldValues>(field: keyof T, formState: FormState<T>) =>
  isTruthy((formState.touchedFields as Record<string, boolean>)[field as string]) || formState.submitCount > 0;
