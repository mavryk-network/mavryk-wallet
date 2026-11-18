import { TempleChainId } from 'lib/temple/types';

/** The backend asset catalog includes this fungible token; the exception is chain/contract/token specific. */
export const isRwaTokenException = (slug: string, chainId: string) =>
  chainId === TempleChainId.Basenet && slug === 'KT1Pn5Zpx1bJx5H51btk92pfwvUMCKtp2Q2v_0';
