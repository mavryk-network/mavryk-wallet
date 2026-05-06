import axios from 'axios';

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
