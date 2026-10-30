/*
  Packs the source code archive required by Firefox Add-ons (AMO) review.
  Reviewers must reproduce the exact `.xpi`, so the archive holds the committed sources plus a `.env`
  restricted to the values webpack compiles into the bundle (see `publicEnvFilesData`).

  Release flow: commit, then `yarn build:firefox` and `yarn source:firefox` with the same .env, and
  upload both files. Build from a checkout with a real `node_modules` — a symlinked one changes
  webpack's module ids and the reviewer's rebuild will not match.
*/

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { zip } from 'zip-a-folder';

import { dotenvFilesPaths, envFilesData, publicEnvFilesData } from './dotenv';
import { PATHS } from './paths';

const README_SOURCE_PATH = path.join(PATHS.CWD, 'docs/firefox-amo-source-readme.md');
const README_ARCHIVE_NAME = 'README-AMO-REVIEW.md';
const STAGING_PATH = path.join(PATHS.DEST, 'firefox-source');
const TAR_PATH = path.join(PATHS.DEST, 'firefox-source.tar');
const ARCHIVE_PATH = path.join(PATHS.DEST, 'firefox-source.zip');

/** Top-level entries reviewers may receive. Anything else must be export-ignored (.gitattributes) or added here. */
const ALLOWED_TOP_LEVEL_ENTRIES = new Set([
  '.babelrc',
  '.browserslistrc',
  '.editorconfig',
  '.env.dist',
  '.eslintrc',
  '.gitattributes',
  '.gitignore',
  '.prettierignore',
  '.prettierrc',
  'LICENSE',
  'README.md',
  'audit-deps.js',
  'basenet_kyc_onboard.spec.ts',
  'bin',
  'e2e',
  'jest.config.ts',
  'jest.setup.js',
  'package.json',
  'public',
  'src',
  'tailwind.config.js',
  'tsconfig.json',
  'webpack',
  'webpack.config.ts',
  'xcode',
  'yarn.lock'
]);

/** Characters dotenv would treat specially if written unquoted — such values would not round-trip. */
const UNSAFE_ENV_VALUE = /[\n\r#"'`]|^\s|\s$/;

const cleanUp = () => {
  fs.rmSync(STAGING_PATH, { recursive: true, force: true });
  fs.rmSync(TAR_PATH, { force: true });
};

const fail = (message: string): never => {
  cleanUp();
  // A partial or previous-run archive must never be mistaken for a valid one.
  fs.rmSync(ARCHIVE_PATH, { force: true });
  console.error(`[firefox-source] ${message}`);
  process.exit(1);
};

const run = (file: string, args: string[]) => {
  try {
    return execFileSync(file, args, { cwd: PATHS.CWD, encoding: 'utf-8' });
  } catch (error) {
    return fail(`\`${file} ${args.join(' ')}\` failed: ${error instanceof Error ? error.message : error}`);
  }
};

if (run('git', ['status', '--porcelain', '--untracked-files=no']).trim()) {
  fail('Tracked files have uncommitted changes. The archive is built from HEAD — commit first.');
}

// It is written into manifest.json but is not part of the archive's .env, so the reviewer build would differ.
if (envFilesData._MANIFEST_KEY_) {
  fail('_MANIFEST_KEY_ is set in your .env files. Unset it and rebuild before packaging the Firefox source.');
}

if (!fs.existsSync(PATHS.OUTPUT_PACKED)) {
  fail(`${PATHS.OUTPUT_PACKED} not found. Run \`yarn build:firefox\` with the same .env first.`);
}

const xpiMtimeMs = fs.statSync(PATHS.OUTPUT_PACKED).mtimeMs;
const headCommitTimeMs = Number(run('git', ['log', '-1', '--format=%ct', 'HEAD']).trim()) * 1000;
if (xpiMtimeMs < headCommitTimeMs) {
  fail(`${PATHS.OUTPUT_PACKED} is older than the HEAD commit. Run \`yarn build:firefox\` again.`);
}

const changedEnvFiles = dotenvFilesPaths.filter(
  filePath => fs.existsSync(filePath) && fs.statSync(filePath).mtimeMs > xpiMtimeMs
);
if (changedEnvFiles.length) {
  const names = changedEnvFiles.map(filePath => path.basename(filePath)).join(', ');
  fail(`${names} changed after the build. Run \`yarn build:firefox\` again.`);
}

const envEntries = Object.entries(publicEnvFilesData)
  // dotenv.ts defaults this one to '' when unset, so leaving it out reproduces the same build.
  .filter(([name, value]) => !(name === 'TESTNET_KYC_SIGNER_PRIVATE_KEY' && !value))
  .sort(([a], [b]) => a.localeCompare(b));

const unsafeEnvNames = envEntries.filter(([, value]) => UNSAFE_ENV_VALUE.test(value)).map(([name]) => name);
if (unsafeEnvNames.length) {
  fail(`These .env values contain characters that would not round-trip: ${unsafeEnvNames.join(', ')}.`);
}

cleanUp();
fs.rmSync(ARCHIVE_PATH, { force: true });
fs.mkdirSync(STAGING_PATH, { recursive: true });

run('git', ['archive', '--format=tar', '-o', TAR_PATH, 'HEAD']);
run('tar', ['-x', '-f', TAR_PATH, '-C', STAGING_PATH]);

const unexpectedEntries = fs.readdirSync(STAGING_PATH).filter(entry => !ALLOWED_TOP_LEVEL_ENTRIES.has(entry));
if (unexpectedEntries.length) {
  fail(`Not on the source allow-list: ${unexpectedEntries.join(', ')}. Export-ignore them or allow them explicitly.`);
}

try {
  fs.writeFileSync(
    path.join(STAGING_PATH, '.env'),
    `${envEntries.map(([name, value]) => `${name}=${value}`).join('\n')}\n`
  );
  fs.copyFileSync(README_SOURCE_PATH, path.join(STAGING_PATH, README_ARCHIVE_NAME));
} catch (error) {
  fail(`Preparing the archive failed: ${error instanceof Error ? error.message : error}`);
}

zip(STAGING_PATH, ARCHIVE_PATH)
  .then(() => {
    cleanUp();
    console.log(`Source archive: ${ARCHIVE_PATH} (commit ${run('git', ['rev-parse', '--short', 'HEAD']).trim()})`);
  })
  .catch(error => fail(`Zipping failed: ${error}`));
