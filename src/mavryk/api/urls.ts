import { normalizeNetworkId } from 'lib/temple/network-storage';

export const MAINNET_MAVRYK_API_URL = 'https://wallet.mavryk.network';
const BASENET_MAVRYK_API_URL = 'https://basenet.wallet.mavryk.network';

export const MAVRYK_API_URLS: Record<string, string> = {
  mainnet: MAINNET_MAVRYK_API_URL,
  basenet: BASENET_MAVRYK_API_URL
};

export const getMavrykApiUrl = (networkId?: string | null) => {
  const normalizedNetworkId = normalizeNetworkId(networkId);

  if (!normalizedNetworkId) {
    return MAINNET_MAVRYK_API_URL;
  }

  return MAVRYK_API_URLS[normalizedNetworkId] ?? MAINNET_MAVRYK_API_URL;
};
