import axiosFetchAdapter from '@vespaiach/axios-fetch-adapter';
import axios from 'axios';

import { EnvVars } from 'lib/env';

// TODO(SEC-03): /dapps (DApps page), /moonpay-sign and /alice-bob/* (Buy with card) still call the Temple backend.
// Waiting on the owner to decide whether to remove these features or re-point them at Mavryk infrastructure.
export const templeWalletApi = axios.create({
  baseURL: new URL('/api', EnvVars.TEMPLE_WALLET_API_URL).href,
  adapter: axiosFetchAdapter
});
