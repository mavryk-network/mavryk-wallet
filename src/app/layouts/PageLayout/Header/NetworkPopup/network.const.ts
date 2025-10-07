import { ReactComponent as AtlasnetSvg } from 'app/icons/atlasnet.svg';
import { ReactComponent as MainnetSvg } from 'app/icons/mainnet.svg';
import { ReactComponent as SandboxSvg } from 'app/icons/sandbox.svg';

export const networkIcons: { [index: string]: ImportedSVGComponent } = {
  sandbox: SandboxSvg,
  atlasnet: AtlasnetSvg,
  mainnet: MainnetSvg
};
