import { MAVEN_METADATA } from 'lib/metadata';

interface AssetBase {
  code: string;
  codeToDisplay?: string;
}

export const getAssetSymbolToDisplay = (asset: AssetBase) => {
  if (asset.code.toLowerCase() === 'xtz') {
    return MAVEN_METADATA.symbol;
  }

  return asset.codeToDisplay ?? asset.code;
};
