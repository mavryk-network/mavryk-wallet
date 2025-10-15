import { PREDEFINED_BAKERS_NAMES_MAINNET } from 'lib/temple/front/baking/const';

export * from './capacities';
export * from './delegateTime';
export * from './label';

export const getPredefinedBakerName = (address?: string | null) => {
  if (!address) return address;
  // @ts-expect-error // random address as key
  const predefineedBakerData = PREDEFINED_BAKERS_NAMES_MAINNET[address];
  if (predefineedBakerData) return predefineedBakerData.name;

  return address;
};
