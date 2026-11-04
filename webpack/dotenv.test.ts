import * as path from 'path';

const DEFAULT_ENV_FILE_CONTENT =
  'KYC_CONTRACT=test-contract\nTESTNET_KYC_SIGNER_PRIVATE_KEY=test-only-key\nSUPER_ADMIN_PRIVATE_KEY=blocked-key';

let mockEnvFileContent = DEFAULT_ENV_FILE_CONTENT;

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: (filePath: string) => ['.env.dist', '.env'].includes(path.basename(filePath)),
  readFileSync: (filePath: string) =>
    path.basename(filePath) === '.env.dist' ? 'KYC_CONTRACT=placeholder' : mockEnvFileContent
}));

const originalEnvironment = process.env;

const loadPublicEnvFilesData = () => {
  let data: Record<string, string> | undefined;
  jest.isolateModules(() => {
    data = (require('./dotenv') as typeof import('./dotenv')).publicEnvFilesData;
  });
  return data;
};

const getLoadError = () => {
  try {
    loadPublicEnvFilesData();
  } catch (error) {
    return error instanceof Error ? error : undefined;
  }
  return undefined;
};

afterEach(() => {
  process.env = originalEnvironment;
  mockEnvFileContent = DEFAULT_ENV_FILE_CONTENT;
});

it.each(['development', 'production'] as const)(
  'includes the explicit Basenet test key but excludes the admin key in %s builds',
  nodeEnv => {
    process.env = { ...originalEnvironment, NODE_ENV: nodeEnv };
    expect(loadPublicEnvFilesData()).toEqual({
      KYC_CONTRACT: 'test-contract',
      TESTNET_KYC_SIGNER_PRIVATE_KEY: 'test-only-key'
    });
  }
);

it('fails the build without revealing the value when the Basenet test key reuses the admin key', () => {
  process.env = { ...originalEnvironment, NODE_ENV: 'production' };
  mockEnvFileContent =
    'KYC_CONTRACT=test-contract\nTESTNET_KYC_SIGNER_PRIVATE_KEY=" shared-admin-key "\nSUPER_ADMIN_PRIVATE_KEY=shared-admin-key';

  const error = getLoadError();

  expect(error).toBeInstanceOf(Error);
  expect(error?.message).toContain('TESTNET_KYC_SIGNER_PRIVATE_KEY');
  expect(error?.message).not.toContain('shared-admin-key');
});

it('fails the build when any public variable reuses an admin key supplied through the process environment', () => {
  process.env = { ...originalEnvironment, NODE_ENV: 'production', SUPER_ADMIN_PRIVATE_KEY: 'test-contract' };

  const error = getLoadError();

  expect(error).toBeInstanceOf(Error);
  expect(error?.message).toContain('KYC_CONTRACT');
  expect(error?.message).not.toContain('test-contract');
});
