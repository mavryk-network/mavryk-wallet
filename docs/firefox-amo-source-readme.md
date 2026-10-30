# Mavryk Wallet — Firefox source code package

This archive contains the complete source of the Mavryk Wallet Firefox add-on and the exact
build-time configuration used to produce the submitted `.xpi`.

## Build environment

Verified on Ubuntu 24.04 (linux/arm64) with:

- Node.js 22.11.0
- npm 10.9.0
- Yarn 1.22.22 (classic)

The build is deterministic: the same steps on macOS and on Linux produce byte-identical files.

## Build steps

Run from the root of this archive:

```bash
npm install -g yarn@1.22.22   # skip if `yarn --version` already prints 1.22.22
yarn install --frozen-lockfile
yarn build:firefox
```

The output is:

- `dist/firefox_unpacked/` — the unpacked add-on
- `dist/firefox.xpi` — the packed add-on

**Use `yarn build:firefox`.** `yarn build` builds the Chrome target and will not match.

## Build configuration (`.env`)

The `.env` file in this archive is the one used for the submitted build. Do not replace it with
`.env.dist` — the values it contains are compiled into the bundle, so a different `.env` produces
different output. It contains only the values webpack is configured to compile into the add-on bundle,
and no other configuration or secrets.

## Verifying the build

The `.xpi` archive itself differs between builds (zip entry timestamps), so compare the unpacked
contents:

```bash
mkdir submitted && unzip -q /path/to/submitted.xpi -d submitted
diff -r submitted dist/firefox_unpacked && echo "identical"
```

## Notes for reviewers

- Minified code in the add-on is produced by webpack 5 + Terser from `src/`. Third-party code comes
  from the packages pinned in `yarn.lock`.
- `eval` / `Function` warnings from the validator originate in bundled dependencies, not in add-on
  code: webpack's runtime global lookup, `lodash` (`Function("return this")`), `vm-browserify`,
  `get-intrinsic`, `function-bind`, the `setimmediate` polyfill, `es5-ext`, `@redux-devtools/remote`,
  and `core-js` v2 inside a vendored dependency bundle.
- Usage analytics transport is disabled in this version: `src/lib/temple/back/analytics.ts` sends
  nothing.
