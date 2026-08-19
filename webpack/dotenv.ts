import * as Dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import { NODE_ENV } from './env';
import { isTruthy } from './utils';

const PATH_CWD = fs.realpathSync(process.cwd());

const BLOCKED_PUBLIC_ENV_VAR_NAMES = ['SUPER_ADMIN_PRIVATE_KEY'] as const;

const OPTIONAL_PUBLIC_ENV_VAR_NAMES = [
  'ENABLE_REDUX_DEVTOOLS',
  'REDUX_DEVTOOLS_PORT',
  'LOCAL_METADATA_API_URL',
  'SCROLL_DOCUMENT',
  'GITHUB_ACTION_RUN_ENV'
] as const;

const TESTNET_KYC_SIGNER_PRIVATE_KEY_ENV_NAME = 'TESTNET_KYC_SIGNER_PRIVATE_KEY';

const blockedPublicEnvVarNames = new Set<string>(BLOCKED_PUBLIC_ENV_VAR_NAMES);

const readDotEnvFile = (path: string) => {
  if (!fs.existsSync(path)) return null;
  const contentString = fs.readFileSync(path, { encoding: 'utf-8' });
  return Dotenv.parse(contentString);
};

const omitBlockedPublicEnvVars = (data: Record<string, string>) =>
  Object.fromEntries(Object.entries(data).filter(([name]) => !blockedPublicEnvVarNames.has(name)));

const dotenvDistPath = path.resolve(PATH_CWD, '.env.dist');

const distDotEnvFileData = readDotEnvFile(dotenvDistPath);

const requiredEnvFileVarsNames = Object.keys(distDotEnvFileData!).filter(name => !blockedPublicEnvVarNames.has(name));

const dotenvPath = path.resolve(PATH_CWD, '.env');

// https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
const dotenvFilesPaths = [
  `${dotenvPath}.${NODE_ENV}.local`,
  /*
    Don't include `.env.local` for `test` environment
    since normally you expect tests to produce the same
    results for everyone
  */
  NODE_ENV !== 'test' && `${dotenvPath}.local`,
  `${dotenvPath}.${NODE_ENV}`,
  dotenvPath
].filter(isTruthy);

const rawEnvFilesData: Record<string, string> = dotenvFilesPaths.reduce(
  (data, path) => ({ ...data, ...readDotEnvFile(path) }),
  {}
);

const envFilesData = omitBlockedPublicEnvVars(rawEnvFilesData);

for (const name of requiredEnvFileVarsNames) {
  if (!envFilesData[name]) throw new Error(`[.env] Required \`${name}\` value is not set in .env files`);
}

const publicEnvVarNames = new Set<string>([...requiredEnvFileVarsNames, ...OPTIONAL_PUBLIC_ENV_VAR_NAMES]);

const publicEnvFilesData: Record<string, string> = Object.fromEntries(
  Object.entries(envFilesData).filter(([name]) => publicEnvVarNames.has(name) && !blockedPublicEnvVarNames.has(name))
);

publicEnvFilesData[TESTNET_KYC_SIGNER_PRIVATE_KEY_ENV_NAME] =
  NODE_ENV === 'production' ? '' : envFilesData[TESTNET_KYC_SIGNER_PRIVATE_KEY_ENV_NAME] ?? '';

export { envFilesData, publicEnvFilesData };
