// Axios module augmentation. Kept in its own module file (a top-level `import` makes a
// .d.ts a module) so that react-app.d.ts can remain a GLOBAL declaration script — a
// top-level import there would scope its `*.svg`/`*.css`/`ImportedSVGComponent` ambient
// declarations to a module and break `tsc` resolution project-wide.
//
// NOTE: this file must NOT be named `axios.d.ts`. With `baseUrl: "./src"`, a bare
// `import ... from 'axios'` would resolve to `src/axios` and shadow the real package.
import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
    skipAuthRefresh?: boolean;
  }
}
