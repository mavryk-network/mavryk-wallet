import { ReactComponent as BasenetSvg } from 'app/icons/basenet.svg';
import { ReactComponent as MainnetSvg } from 'app/icons/mainnet.svg';
import { ReactComponent as SandboxSvg } from 'app/icons/sandbox.svg';

export const networkIcons: { [index: string]: ImportedSVGComponent } = {
  sandbox: SandboxSvg,
  basenet: BasenetSvg,
  mainnet: MainnetSvg
};
