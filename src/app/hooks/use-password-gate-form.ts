import { useCallback } from 'react';

import { useForm } from 'react-hook-form';

import { delay } from 'lib/utils';
import { toFieldError } from 'lib/utils/get-error-message';

interface PasswordFormValues {
  password: string;
}

interface UsePasswordGateFormOptions {
  /** Called after a successful action — e.g. navigate away or close modal. */
  onSuccess?: () => void;
  /** Called after the error is set — e.g. re-focus the password field. */
  onError?: () => void;
  /** If true, `clearErrors('password')` is also wired to the field's onChange. */
  clearOnChange?: boolean;
}

/**
 * Shared hook for forms that gate a destructive action behind a password prompt.
 *
 * The caller provides `onAction(password)` which performs the protected operation.
 * Error handling (human delay + RHF setError) is handled internally.
 *
 * Returns stable RHF bindings plus a pre-bound `onSubmit` handler.
 */
export function usePasswordGateForm(
  onAction: (password: string) => Promise<void>,
  options: UsePasswordGateFormOptions = {}
) {
  const { onSuccess, onError, clearOnChange = false } = options;

  const {
    register: rhfRegister,
    handleSubmit,
    formState: { errors, isSubmitting: submitting },
    setError,
    clearErrors,
    watch
  } = useForm<PasswordFormValues>();

  const password = watch('password') ?? '';

  /** Wraps `register('password', ...)` so callers don't duplicate the field options. */
  const registerPassword = useCallback(
    (required: string) =>
      rhfRegister('password', {
        required,
        ...(clearOnChange ? { onChange: () => clearErrors() } : {})
      }),
    [rhfRegister, clearErrors, clearOnChange]
  );

  const onSubmit = handleSubmit(async ({ password: pw }) => {
    if (submitting) return;

    clearErrors('password');
    try {
      await onAction(pw);
      onSuccess?.();
    } catch (err: unknown) {
      console.error(err);

      // Human delay to discourage brute-force.
      await delay();
      setError('password', toFieldError(err));
      onError?.();
    }
  });

  return {
    registerPassword,
    handleSubmit,
    errors,
    submitting,
    password,
    onSubmit,
    clearErrors,
    disabled: submitting || !password.length
  };
}
