const DEFAULT_PRODUCTION_EXTENSION_ID = 'cgddkajmbckbjbnondgfcbcojjjdnmji';

const customProductionExtensionId = process.env.PRODUCTION_EXTENSION_ID?.trim();

/** DApp-facing extension identity used by injected/content-script handshakes. */
export const PUBLIC_EXTENSION_ID = customProductionExtensionId || DEFAULT_PRODUCTION_EXTENSION_ID;
