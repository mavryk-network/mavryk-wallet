// rename-packages.js
import fs from 'fs';
import path from 'path';

const replacements = {
  '@mavrykdynamics/taquito': '@mavrykdynamics/webmavryk',
  '@mavrykdynamics/taquito-ledger-signer': '@mavrykdynamics/webmavryk-ledger-signer',
  '@mavrykdynamics/taquito-local-forging': '@mavrykdynamics/webmavryk-local-forging',
  '@mavrykdynamics/taquito-michel-codec': '@mavrykdynamics/webmavryk-michel-codec',
  '@mavrykdynamics/taquito-michelson-encoder': '@mavrykdynamics/webmavryk-michelson-encoder',
  '@mavrykdynamics/taquito-rpc': '@mavrykdynamics/webmavryk-rpc',
  '@mavrykdynamics/taquito-signer': '@mavrykdynamics/webmavryk-signer',
  '@mavrykdynamics/taquito-tzip12': '@mavrykdynamics/webmavryk-tzip12',
  '@mavrykdynamics/taquito-tzip16': '@mavrykdynamics/webmavryk-tzip16',
  '@mavrykdynamics/taquito-utils': '@mavrykdynamics/webmavryk-utils'
};
const exts = ['.ts', '.tsx', '.js', '.jsx'];

// Sort: longest keys first (prevents partial matches)
const ordered = Object.entries(replacements).sort(([a], [b]) => b.length - a.length);

function safeReplace(content) {
  for (const [oldPkg, newPkg] of ordered) {
    // Match only exact strings, NOT substrings
    const regex = new RegExp(`(['"])${oldPkg}\\1`, 'g');
    content = content.replace(regex, `$1${newPkg}$1`);
  }
  return content;
}

function walk(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fp = path.join(dir, file);
    const stat = fs.statSync(fp);

    if (stat.isDirectory()) {
      walk(fp);
    } else if (exts.some(ext => fp.endsWith(ext))) {
      const original = fs.readFileSync(fp, 'utf8');
      const updated = safeReplace(original);

      if (updated !== original) {
        fs.writeFileSync(fp, updated, 'utf8');
        console.log('Updated:', fp);
      }
    }
  }
}

walk('./src');

console.log('Done!');
