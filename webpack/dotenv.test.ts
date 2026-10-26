import * as path from 'path';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: (filePath: string) => ['.env.dist', '.env'].includes(path.basename(filePath)),
  readFileSync: (filePath: string) =>
    path.basename(filePath) === '.env.dist'
      ? 'KYC_CONTRACT=placeholder'
      : 'KYC_CONTRACT=test-contract\nTESTNET_KYC_SIGNER_PRIVATE_KEY=test-only-key\nSUPER_ADMIN_PRIVATE_KEY=blocked-key'
}));

const originalEnvironment = process.env;

afterEach(() => {
  process.env = originalEnvironment;
});

it.each(['development', 'production'] as const)(
  'includes the explicit Basenet test key but excludes the admin key in %s builds',
  nodeEnv => {
    process.env = { ...originalEnvironment, NODE_ENV: nodeEnv };
    jest.isolateModules(() => {
      const { publicEnvFilesData } = require('./dotenv') as typeof import('./dotenv');
      expect(publicEnvFilesData).toEqual({
        KYC_CONTRACT: 'test-contract',
        TESTNET_KYC_SIGNER_PRIVATE_KEY: 'test-only-key'
      });
    });
  }
);
