import { execFileSync } from 'child_process';
import * as fs from 'fs';

import {
  BUILD_START_PATH,
  BuildProvenance,
  collectBuildInputs,
  buildProvenanceRecord,
  createBuildStartSnapshotPlugin,
  findProvenanceProblems,
  hashPublicEnv,
  listDirtySourcePaths,
  pickShellBuildInputs,
  serializeJson
} from './build-provenance';

jest.mock('child_process');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  rmSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

const provenance: BuildProvenance = {
  commit: 'abc123',
  dirtySourcePaths: [],
  nodeEnv: 'production',
  targetBrowser: 'firefox',
  shellBuildInputs: {},
  publicEnvSha256: 'env-hash',
  manifestKeySet: false,
  packedSha256: 'xpi-hash'
};

const current = {
  commit: 'abc123',
  nodeEnv: 'production',
  targetBrowser: 'firefox',
  publicEnvSha256: 'env-hash',
  packedSha256: 'xpi-hash'
};

describe('findProvenanceProblems', () => {
  it('accepts a clean build of HEAD with unchanged .env and package', () => {
    expect(findProvenanceProblems(provenance, current)).toEqual([]);
  });

  it('rejects a package built from another commit', () => {
    expect(findProvenanceProblems({ ...provenance, commit: 'def456' }, current)).toEqual([
      expect.stringContaining('def456')
    ]);
  });

  it('rejects a package built outside a git checkout', () => {
    expect(findProvenanceProblems({ ...provenance, commit: null }, current)).toHaveLength(1);
  });

  it('rejects a build that had uncommitted or untracked source files', () => {
    const problems = findProvenanceProblems({ ...provenance, dirtySourcePaths: ['?? src/new.tsx'] }, current);

    expect(problems).toEqual([expect.stringContaining('src/new.tsx')]);
  });

  it('rejects a package that changed after the build', () => {
    expect(findProvenanceProblems(provenance, { ...current, packedSha256: 'other' })).toHaveLength(1);
  });

  it('rejects .env values that changed after the build', () => {
    expect(findProvenanceProblems(provenance, { ...current, publicEnvSha256: 'other' })).toHaveLength(1);
  });

  it('rejects a build for another browser or mode', () => {
    expect(
      findProvenanceProblems({ ...provenance, targetBrowser: 'chrome', nodeEnv: 'development' }, current)
    ).toHaveLength(2);
  });

  it('rejects a build whose manifest carried _MANIFEST_KEY_, which the archive .env leaves out', () => {
    expect(findProvenanceProblems({ ...provenance, manifestKeySet: true }, current)).toEqual([
      expect.stringContaining('_MANIFEST_KEY_')
    ]);
  });

  it('rejects build inputs set in the shell, which a reviewer rebuild would not have', () => {
    const problems = findProvenanceProblems({ ...provenance, shellBuildInputs: { LOAD_PERF_MARKS: 'true' } }, current);

    expect(problems).toEqual([expect.stringContaining('LOAD_PERF_MARKS')]);
  });
});

describe('hashPublicEnv', () => {
  it('does not depend on key order', () => {
    expect(hashPublicEnv({ A: '1', B: '2' })).toBe(hashPublicEnv({ B: '2', A: '1' }));
  });

  it('changes when a value changes', () => {
    expect(hashPublicEnv({ A: '1' })).not.toBe(hashPublicEnv({ A: '2' }));
  });
});

describe('pickShellBuildInputs', () => {
  it('keeps only the shell build inputs that are defined, including empty ones', () => {
    // env.ts only applies its defaults to undefined values, so '' still changes the build.
    expect(
      pickShellBuildInputs({
        PRODUCTION_EXTENSION_ID: 'id',
        IMAGE_INLINE_SIZE_LIMIT: '',
        LOAD_PERF_MARKS: undefined,
        BROWSERSLIST_ENV: 'development',
        PATH: '/bin',
        NODE_ENV: 'production'
      })
    ).toEqual({ PRODUCTION_EXTENSION_ID: 'id', IMAGE_INLINE_SIZE_LIMIT: '', BROWSERSLIST_ENV: 'development' });
  });
});

describe('git-backed inputs', () => {
  const execFileSyncMock = execFileSync as jest.MockedFunction<typeof execFileSync>;
  const statusOutput = (args: readonly string[] = []) =>
    args.includes('--ignored=matching')
      ? '?? src/b.ts\n!! src/x/build/y.ts\n!! public/.DS_Store\n'
      : ' M src/a.ts\n?? src/b.ts\n';

  beforeEach(() => execFileSyncMock.mockReset());

  it('lists uncommitted, untracked and gitignored bundled files, but not .DS_Store', () => {
    execFileSyncMock.mockImplementation((_file, args) => statusOutput(args));

    expect(listDirtySourcePaths()).toEqual([' M src/a.ts', '?? src/b.ts', '!! src/x/build/y.ts']);
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'git',
      expect.anything(),
      expect.objectContaining({ env: expect.objectContaining({ GIT_OPTIONAL_LOCKS: '0' }) })
    );
  });

  it('records no commit and skips git status outside a repository', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('fatal: not a git repository');
    });

    expect(collectBuildInputs({}, {})).toMatchObject({ commit: null, dirtySourcePaths: [], manifestKeySet: false });
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
  });
});

describe('createBuildStartSnapshotPlugin', () => {
  const execFileSyncMock = execFileSync as jest.MockedFunction<typeof execFileSync>;
  const writeFileSyncMock = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;

  const createCompilers = (count: number) =>
    Array.from({ length: count }, () => {
      const handlers: Array<(stats: { hasErrors: () => boolean }) => void> = [];
      const compiler = {
        hooks: { done: { tap: (_name: string, handler: (typeof handlers)[number]) => handlers.push(handler) } }
      };

      return {
        compiler,
        finish: (hasErrors = false) => handlers.forEach(handler => handler({ hasErrors: () => hasErrors }))
      };
    });

  beforeEach(() => {
    execFileSyncMock.mockReset();
    execFileSyncMock.mockImplementation((_file, args) => (args?.[0] === 'rev-parse' ? 'abc123\n' : ''));
    writeFileSyncMock.mockReset();
  });

  it('writes the snapshot only after every compilation succeeds', () => {
    const plugin = createBuildStartSnapshotPlugin(2, {}, {});
    const [first, second] = createCompilers(2);
    plugin.apply(first.compiler as never);
    plugin.apply(second.compiler as never);

    first.finish();
    expect(writeFileSyncMock).not.toHaveBeenCalled();

    second.finish();
    expect(writeFileSyncMock).toHaveBeenCalledWith(BUILD_START_PATH, expect.stringContaining('"commit": "abc123"'));
  });

  it('writes nothing when a compilation fails', () => {
    const plugin = createBuildStartSnapshotPlugin(2, {}, {});
    const [first, second] = createCompilers(2);
    plugin.apply(first.compiler as never);
    plugin.apply(second.compiler as never);

    first.finish();
    second.finish(true);

    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });
});

describe('buildProvenanceRecord', () => {
  const { packedSha256, ...inputs } = provenance;

  it('records the package when the compile snapshot still matches its inputs', () => {
    expect(buildProvenanceRecord(serializeJson(inputs), inputs, packedSha256)).toEqual(provenance);
  });

  it('refuses when the compile left no snapshot', () => {
    expect(() => buildProvenanceRecord(null, inputs, packedSha256)).toThrow();
  });

  it('refuses when the inputs changed after the compile', () => {
    expect(() => buildProvenanceRecord(serializeJson(inputs), { ...inputs, commit: 'def456' }, packedSha256)).toThrow();
  });
});
