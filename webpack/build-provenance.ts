/*
  Records what a packed build was made from, so `yarn source:firefox` can prove the archive it packs
  rebuilds the exact package being uploaded. Written next to the package, never inside it.

  Production builds collect the build inputs when webpack.config.ts loads and save them only once every
  compilation succeeds. zip-script.ts collects them again after packing and writes the record only if nothing
  changed in between, so the record describes this compile.
*/

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import type { Compiler, WebpackPluginInstance } from 'webpack';

import { PATHS } from './paths';

export const BUILD_PROVENANCE_PATH = `${PATHS.OUTPUT_PACKED}.build-info.json`;
export const BUILD_START_PATH = `${PATHS.OUTPUT_PACKED}.build-start.json`;

/** Top-level entries reviewers may receive. Anything else must be export-ignored (.gitattributes) or added here. */
export const SOURCE_TOP_LEVEL_ENTRIES = [
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
];

/** Webpack inputs that may be gitignored but are still bundled; anything ignored here must block a release. */
const BUNDLED_SOURCE_DIRS = ['src', 'public'];

/**
  Build inputs read from the shell, not from .env files: webpack/env.ts, plus Babel and Browserslist, which
  pick their config by these ahead of NODE_ENV. A reviewer rebuild leaves them unset.
*/
const SHELL_BUILD_INPUT_NAMES = [
  'PRODUCTION_EXTENSION_ID',
  'LOAD_PERF_MARKS',
  'IMAGE_INLINE_SIZE_LIMIT',
  'SOURCE_MAP',
  'BABEL_ENV',
  'BROWSERSLIST',
  'BROWSERSLIST_CONFIG',
  'BROWSERSLIST_ENV'
];

export interface BuildInputs {
  /** `null` outside a git checkout, e.g. a reviewer building from the source archive. */
  commit: string | null;
  /** `git status --porcelain` lines for source inputs: uncommitted, untracked and gitignored-but-bundled files. */
  dirtySourcePaths: string[];
  nodeEnv: string;
  targetBrowser: string;
  shellBuildInputs: Record<string, string>;
  publicEnvSha256: string;
  /** webpack/manifest.ts writes _MANIFEST_KEY_ into manifest.json, but the archive .env leaves it out. */
  manifestKeySet: boolean;
}

export interface BuildProvenance extends BuildInputs {
  packedSha256: string;
}

interface CurrentState {
  commit: string;
  nodeEnv: string;
  targetBrowser: string;
  publicEnvSha256: string;
  packedSha256: string;
}

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

export const sha256File = (filePath: string) => sha256(fs.readFileSync(filePath));

export const hashPublicEnv = (data: Record<string, string>) =>
  sha256(JSON.stringify(Object.entries(data).sort(([a], [b]) => a.localeCompare(b))));

// Defined-but-empty values count: webpack/env.ts only applies its defaults to undefined ones.
export const pickShellBuildInputs = (env: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(
    SHELL_BUILD_INPUT_NAMES.flatMap(name => {
      const value = env[name];

      return value === undefined ? [] : [[name, value]];
    })
  );

// stderr is dropped so a reviewer rebuild without .git does not print "fatal: not a git repository".
// GIT_OPTIONAL_LOCKS=0 stops `git status` from taking .git/index.lock while a commit may be running.
const git = (args: string[]) =>
  execFileSync('git', args, {
    cwd: PATHS.CWD,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
  });

const toLines = (output: string) => output.split('\n').filter(Boolean);

/** `null` when git or the repository is unavailable. */
export const readHeadCommit = () => {
  try {
    return git(['rev-parse', 'HEAD']).trim();
  } catch {
    return null;
  }
};

export const listDirtySourcePaths = () => [
  ...toLines(git(['status', '--porcelain', '--untracked-files=all', '--', ...SOURCE_TOP_LEVEL_ENTRIES])),
  // The public/ copy step skips .DS_Store, so only other ignored files can reach the package.
  ...toLines(
    git(['status', '--porcelain', '--ignored=matching', '--untracked-files=all', '--', ...BUNDLED_SOURCE_DIRS])
  ).filter(line => line.startsWith('!!') && !line.endsWith('.DS_Store'))
];

export const collectBuildInputs = (
  publicEnvData: Record<string, string>,
  envData: Record<string, string>
): BuildInputs => {
  const commit = readHeadCommit();

  return {
    commit,
    dirtySourcePaths: commit ? listDirtySourcePaths() : [],
    nodeEnv: process.env.NODE_ENV ?? '',
    targetBrowser: process.env.TARGET_BROWSER ?? '',
    shellBuildInputs: pickShellBuildInputs(process.env),
    publicEnvSha256: hashPublicEnv(publicEnvData),
    manifestKeySet: Boolean(envData._MANIFEST_KEY_)
  };
};

export const serializeJson = (data: object) => `${JSON.stringify(data, null, 2)}\n`;

/** Provenance for a package whose inputs at packing time still match the snapshot saved by its compile. */
export const buildProvenanceRecord = (
  startSnapshot: string | null,
  inputs: BuildInputs,
  packedSha256: string
): BuildProvenance => {
  // No snapshot when the compile failed or webpack.config.ts did not run, e.g. zipping an earlier build on its own.
  if (startSnapshot !== serializeJson(inputs)) {
    throw new Error('the compile did not finish, or its sources, .env or shell settings changed before packing');
  }

  return { ...inputs, packedSha256 };
};

const warnNoSnapshot = (error: unknown) =>
  console.warn(`Could not snapshot build inputs: ${error instanceof Error ? error.message : error}`);

/**
  One instance shared by all `compilationsCount` production configurations. Never fails the build: without the
  snapshot, zip-script simply records nothing and `yarn source:firefox` refuses to pack.
*/
export const createBuildStartSnapshotPlugin = (
  compilationsCount: number,
  publicEnvData: Record<string, string>,
  envData: Record<string, string>
): WebpackPluginInstance => {
  fs.rmSync(BUILD_START_PATH, { force: true });

  let inputs: BuildInputs | null = null;
  try {
    inputs = collectBuildInputs(publicEnvData, envData);
  } catch (error) {
    warnNoSnapshot(error);
  }

  let succeededCount = 0;

  return {
    apply: (compiler: Compiler) =>
      compiler.hooks.done.tap('BuildStartSnapshotPlugin', stats => {
        if (!inputs || stats.hasErrors()) return;

        succeededCount += 1;
        if (succeededCount !== compilationsCount) return;

        try {
          fs.mkdirSync(PATHS.DEST, { recursive: true });
          fs.writeFileSync(BUILD_START_PATH, serializeJson(inputs));
        } catch (error) {
          warnNoSnapshot(error);
        }
      })
  };
};

export const findProvenanceProblems = (provenance: BuildProvenance, current: CurrentState) => {
  const problems: string[] = [];
  const shellInputNames = Object.keys(provenance.shellBuildInputs);

  if (provenance.commit !== current.commit) {
    problems.push(`The package was built from ${provenance.commit ?? 'outside git'}, but HEAD is ${current.commit}.`);
  }
  if (provenance.dirtySourcePaths.length) {
    problems.push(
      `The package was built with uncommitted or untracked source files: ${provenance.dirtySourcePaths.join(', ')}.`
    );
  }
  if (provenance.packedSha256 !== current.packedSha256) {
    problems.push('The package changed after it was built.');
  }
  if (provenance.publicEnvSha256 !== current.publicEnvSha256) {
    problems.push('The .env values compiled into the bundle changed after the build.');
  }
  if (provenance.nodeEnv !== current.nodeEnv) {
    problems.push(`The package was built with NODE_ENV=${provenance.nodeEnv}, expected ${current.nodeEnv}.`);
  }
  if (provenance.targetBrowser !== current.targetBrowser) {
    problems.push(`The package was built for ${provenance.targetBrowser}, expected ${current.targetBrowser}.`);
  }
  if (provenance.manifestKeySet) {
    problems.push('The package was built with _MANIFEST_KEY_ set, which the archive .env leaves out.');
  }
  if (shellInputNames.length) {
    problems.push(
      `Set in the shell during the build, so a reviewer rebuild would differ: ${shellInputNames.join(', ')}.`
    );
  }

  return problems;
};
