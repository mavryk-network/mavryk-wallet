interface AdSourceBase {
  shouldNotUseStrictContainerLimits?: boolean;
}

/** Only covers TKEY ads for now */
interface TempleAdSource extends AdSourceBase {
  providerName: 'Temple';
}
type AdSource = TempleAdSource;

export interface AdDimensions {
  width: number;
  height: number;
  minContainerWidth: number;
  minContainerHeight: number;
  maxContainerWidth: number;
  maxContainerHeight: number;
}

export interface AdMetadata {
  source: AdSource;
  dimensions: AdDimensions;
}

export const BANNER_ADS_META: AdMetadata[] = [
  {
    source: {
      providerName: 'Temple'
    },
    dimensions: {
      width: 728,
      height: 90,
      minContainerWidth: 600,
      minContainerHeight: 60,
      maxContainerWidth: 1440,
      maxContainerHeight: 110
    }
  }
];
