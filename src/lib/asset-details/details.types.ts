export type DetailCategory = 'collectibles' | 'rwas';

export interface DetailScope {
  account: string;
  chainId: string;
  /** API routing can differ even when two configured networks report the same chain. */
  networkId: string;
}

export type DetailRecord<T> = Record<string, T | null>;
