export enum AdsProviderTitle {
  Optimal = 'Optimal',
  HypeLab = 'HypeLab',
  Persona = 'Persona',
  Temple = 'Mavryk Wallet'
}

export type AdsProviderName = keyof typeof AdsProviderTitle;
