/*
  There is no WebPack-based solution to zip output of multiple configurations.
*/

import * as fs from 'fs';
import * as path from 'path';
import { zip } from 'zip-a-folder';

import {
  BUILD_PROVENANCE_PATH,
  BUILD_START_PATH,
  buildProvenanceRecord,
  collectBuildInputs,
  serializeJson,
  sha256File
} from './build-provenance';
import { envFilesData, publicEnvFilesData } from './dotenv';
import { PATHS } from './paths';

const fileName = path.basename(PATHS.OUTPUT_PACKED);

console.log(`Will zip as: ${fileName}`);

// A stale record must never vouch for a new package.
fs.rmSync(BUILD_PROVENANCE_PATH, { force: true });

const consumeStartSnapshot = () => {
  const snapshot = fs.existsSync(BUILD_START_PATH) ? fs.readFileSync(BUILD_START_PATH, 'utf-8') : null;
  fs.rmSync(BUILD_START_PATH, { force: true });

  return snapshot;
};

zip(PATHS.OUTPUT, PATHS.OUTPUT_PACKED)
  .then(() => {
    try {
      const startSnapshot = consumeStartSnapshot();
      const inputs = collectBuildInputs(publicEnvFilesData, envFilesData);
      const provenance = buildProvenanceRecord(startSnapshot, inputs, sha256File(PATHS.OUTPUT_PACKED));
      fs.writeFileSync(BUILD_PROVENANCE_PATH, serializeJson(provenance));
    } catch (error) {
      // The package itself is fine; `yarn source:firefox` refuses to run without this record.
      console.warn(`Could not record build provenance: ${error instanceof Error ? error.message : error}`);
    }
  })
  .catch(error => {
    fs.rmSync(BUILD_START_PATH, { force: true });
    throw error;
  });
