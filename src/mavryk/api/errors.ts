import axios from 'axios';

const REFRESH_TOKEN_REUSE_ERROR = 'REFRESH_TOKEN_REUSE';
const TOKEN_REVOKED_ERROR = 'Token has been revoked';

export function extractMavrykApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (responseData && typeof responseData === 'object') {
      const values = Object.values(responseData).filter((value): value is string => typeof value === 'string');
      if (values.length > 0) return values.join(', ');
    }

    if (typeof error.response?.status === 'number') {
      return `Mavryk API request failed with status ${error.response.status}`;
    }
  }

  if (error instanceof Error && error.message) return error.message;

  return 'Mavryk API request failed';
}

export function isTerminalMavrykAuthError(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) {
    return false;
  }

  return (
    responseContainsAuthError(error.response.data, REFRESH_TOKEN_REUSE_ERROR) ||
    responseContainsAuthError(error.response.data, TOKEN_REVOKED_ERROR)
  );
}

function responseContainsAuthError(data: unknown, expected: string): boolean {
  if (typeof data === 'string') {
    return data.includes(expected);
  }

  if (Array.isArray(data)) {
    return data.some(item => responseContainsAuthError(item, expected));
  }

  if (data && typeof data === 'object') {
    return Object.values(data).some(value => responseContainsAuthError(value, expected));
  }

  return false;
}
