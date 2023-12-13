import { OutputCurrencyInterface } from './exolix.interface';

export const EXOLIX_CONTACT_LINK =
  'https://docs.google.com/forms/d/e/1FAIpQLSdec4jK16R8uQ-05MRk7QgNi7y3PE5l7ojI5dvMYlfrX2LKDQ/viewform';

export const EXOLIX_TERMS_LINK = 'https://exolix.com/terms';
export const EXOLIX_PRIVICY_LINK = 'https://exolix.com/privacy';

export const outputTokensList: OutputCurrencyInterface[] = [
  {
    code: 'MVRK',
    name: 'Mavryk',
    icon: 'https://exolix.com/icons/coins/XTZ.png',
    network: {
      code: 'MVRK',
      fullName: 'Mavryk'
    },
    slug: 'mav'
  },
  {
    code: 'USDT',
    icon: 'https://exolix.com/icons/coins/USDT.png',
    name: 'TetherUS',
    network: {
      code: 'XTZ',
      fullName: 'Tezos Mainnet',
      shortName: 'Tezos'
    },
    slug: 'KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o_0'
  }
];
