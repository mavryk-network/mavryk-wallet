import PackageJSON from '../../package.json';

export const APP_VERSION = PackageJSON.version;

export const IS_DEV_ENV = process.env.NODE_ENV === 'development';

const IS_DEV_GITHUB_ACTION_RUN_ENV = process.env.GITHUB_ACTION_RUN_ENV === 'development';

export const IS_STAGE_ENV = IS_DEV_ENV || IS_DEV_GITHUB_ACTION_RUN_ENV;

export const BACKGROUND_IS_WORKER = process.env.BACKGROUND_IS_WORKER === 'true';

export const EnvVars = {
  TEMPLE_WALLET_API_URL: process.env.TEMPLE_WALLET_API_URL!,
  TEMPLE_WALLET_DEXES_API_URL: process.env.TEMPLE_WALLET_DEXES_API_URL!,
  TEMPLE_WALLET_JITSU_TRACKING_HOST: process.env.TEMPLE_WALLET_JITSU_TRACKING_HOST!,
  TEMPLE_WALLET_JITSU_WRITE_KEY: process.env.TEMPLE_WALLET_JITSU_WRITE_KEY!,
  TEMPLE_WALLET_EXOLIX_API_KEY: process.env.TEMPLE_WALLET_EXOLIX_API_KEY!,
  TEMPLE_WALLET_EVERSTAKE_API_KEY: process.env.TEMPLE_WALLET_EVERSTAKE_API_KEY!,
  TEMPLE_WALLET_EVERSTAKE_LINK_ID: process.env.TEMPLE_WALLET_EVERSTAKE_LINK_ID!,
  TEMPLE_WALLET_UTORG_SID: process.env.TEMPLE_WALLET_UTORG_SID!,
  TEMPLE_WALLET_ROUTE3_AUTH_TOKEN: process.env.TEMPLE_WALLET_ROUTE3_AUTH_TOKEN!,
  TEMPLE_WALLET_MOONPAY_API_KEY: process.env.TEMPLE_WALLET_MOONPAY_API_KEY!,
  TEMPLE_FIREBASE_CONFIG: process.env.TEMPLE_FIREBASE_CONFIG!,
  TEMPLE_FIREBASE_MESSAGING_VAPID_KEY: process.env.TEMPLE_FIREBASE_MESSAGING_VAPID_KEY!,
  TEMPLE_WALLET_DEVELOPMENT_BRANCH_NAME: process.env.TEMPLE_WALLET_DEVELOPMENT_BRANCH_NAME!,
  HYPELAB_API_URL: process.env.HYPELAB_API_URL!,
  HYPELAB_SMALL_PLACEMENT_SLUG: process.env.HYPELAB_SMALL_PLACEMENT_SLUG!,
  HYPELAB_HIGH_PLACEMENT_SLUG: process.env.HYPELAB_HIGH_PLACEMENT_SLUG!,
  HYPELAB_WIDE_PLACEMENT_SLUG: process.env.HYPELAB_WIDE_PLACEMENT_SLUG!,
  HYPELAB_NATIVE_PLACEMENT_SLUG: process.env.HYPELAB_NATIVE_PLACEMENT_SLUG!,
  HYPELAB_PROPERTY_SLUG: process.env.HYPELAB_PROPERTY_SLUG!,
  HYPELAB_ADS_WINDOW_URL: process.env.HYPELAB_ADS_WINDOW_URL!,
  PERSONA_ADS_API_KEY: process.env.PERSONA_ADS_API_KEY!,
  PERSONA_ADS_BANNER_UNIT_ID: process.env.PERSONA_ADS_BANNER_UNIT_ID!,
  PERSONA_ADS_WIDE_BANNER_UNIT_ID: process.env.PERSONA_ADS_WIDE_BANNER_UNIT_ID!,
  PERSONA_ADS_MEDIUM_BANNER_UNIT_ID: process.env.PERSONA_ADS_MEDIUM_BANNER_UNIT_ID!,
  PERSONA_ADS_SQUARISH_BANNER_UNIT_ID: process.env.PERSONA_ADS_SQUARISH_BANNER_UNIT_ID!,
  NODES_URL: process.env.NODES_URL!
} as const;
