/// <reference types="node" />
/// <reference types="react" />
/// <reference types="react-dom" />

// NOTE: this file must remain a GLOBAL declaration script (no top-level import/export),
// or its ambient `*.svg`/`*.css`/`ImportedSVGComponent` declarations stop applying
// project-wide. The axios module augmentation lives in src/axios.d.ts for this reason.

declare type ImportedSVGComponent = React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly PUBLIC_URL: string;
    readonly PRODUCTION_EXTENSION_ID?: string;
  }
}

declare module '*.bmp' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  export const ReactComponent: ImportedSVGComponent;

  const src: string;
  export default src;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
