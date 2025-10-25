import { PREDEFINED_BAKERS_NAMES_MAINNET, PredefinedBakerData } from 'lib/temple/front/baking/const';

export * from './capacities';
export * from './delegateTime';
export * from './label';

type BakerProperty = keyof PredefinedBakerData;

export function getPredefinedBakerProperty<K extends BakerProperty = 'name'>(
  address?: string | null,
  key: K = 'name' as K
): PredefinedBakerData[K] | string | null {
  if (!address) return null;

  const predefinedBakerData = PREDEFINED_BAKERS_NAMES_MAINNET[address];
  if (predefinedBakerData) return predefinedBakerData[key];

  // If address not predefined, return it (string)
  return address;
}

export const getPredefinedBaker = (address: string) => {
  return PREDEFINED_BAKERS_NAMES_MAINNET[address] || null;
};
