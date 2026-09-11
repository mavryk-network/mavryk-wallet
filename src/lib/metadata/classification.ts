/** Preserve the existing artifact-field classification without importing React consumers into store commands. */
export const isCollectible = (metadata: { name?: unknown; symbol?: unknown; artifactUri?: unknown }) =>
  typeof metadata.artifactUri === 'string';

// The API does not currently provide a dynamic RWA discriminator.
const RWA_SYMBOLS = ['ocean', 'mars1', 'ntbm', 'queen', 'xaug', 'khbe', 'mcdx'];

/** Classify fetched metadata using the existing production symbol allowlist. */
export const isRwa = (metadata: { name?: unknown; symbol?: unknown; artifactUri?: unknown }) =>
  typeof metadata.symbol === 'string' && RWA_SYMBOLS.includes(metadata.symbol.toLowerCase());
