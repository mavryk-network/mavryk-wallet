import PackageJSON from '../../package.json';

export const APP_VERSION = PackageJSON.version;

export const IS_DEV_ENV = process.env.NODE_ENV === 'development';

const IS_DEV_GITHUB_ACTION_RUN_ENV = process.env.GITHUB_ACTION_RUN_ENV === 'development';

export const IS_STAGE_ENV = IS_DEV_ENV || IS_DEV_GITHUB_ACTION_RUN_ENV;

export const BACKGROUND_IS_WORKER = process.env.BACKGROUND_IS_WORKER === 'true';

export const EnvVars = {
  EXTERNAL_API: process.env.EXTERNAL_API!,
  TEMPLE_WALLET_API_URL: process.env.TEMPLE_WALLET_API_URL!,
  TEMPLE_WALLET_DEVELOPMENT_BRANCH_NAME: process.env.TEMPLE_WALLET_DEVELOPMENT_BRANCH_NAME!,
  NODES_URL: process.env.NODES_URL!,
  SUPER_ADMIN_PRIVATE_KEY: process.env.SUPER_ADMIN_PRIVATE_KEY!,
  KYC_CONTRACT: process.env.KYC_CONTRACT!,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY!,
  COINGECKO_API: process.env.COINGECKO_API!
} as const;
