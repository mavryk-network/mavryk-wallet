import React, { FC, useEffect, useRef, useState } from 'react';

import ModelViewerElementBase from '@google/model-viewer/lib/model-viewer-base';
import { emptyFn } from '@rnw-community/shared';
import clsx from 'clsx';

function isWebGLSupported() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.AllHTMLAttributes<Partial<globalThis.HTMLElementTagNameMap['model-viewer']>>,
        Partial<globalThis.HTMLElementTagNameMap['model-viewer']>
      >;
    }
  }
}

interface Props {
  uri: string;
  alt?: string;
  className?: string;
  onError?: EmptyFn;
}

export const Model3DViewer: FC<Props> = ({ uri, alt, className, onError = emptyFn }) => {
  const modelViewerRef = useRef<ModelViewerElementBase>(null);
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    if (isWebGLSupported()) {
      import('@google/model-viewer').then(() => setCanRender(true));
    }
  }, []);

  useEffect(() => {
    const modelViewer = modelViewerRef.current;

    if (modelViewer) {
      modelViewer.addEventListener('error', onError);

      return () => modelViewer.removeEventListener('error', onError);
    }

    return undefined;
  }, [onError]);

  if (!canRender) return null;

  return (
    <model-viewer
      ref={modelViewerRef}
      src={uri}
      alt={alt}
      auto-rotate={true}
      camera-controls={true}
      autoPlay
      shadow-intensity="1"
      // @ts-expect-error
      class={clsx('w-full h-full', className)}
    />
  );
};
