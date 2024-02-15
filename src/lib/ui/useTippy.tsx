import { useCallback, useEffect, useRef } from 'react';

import tippy, { Props, Instance } from 'tippy.js';

export type TippyInstance = Instance<Props>;

export type UseTippyOptions = Partial<Props>;

export const useTippyById = (parentId: string, props: UseTippyOptions) => {
  const onMouseEnter = useCallback(() => {
    const _props = { theme: 'maven', ...props };

    tippy(parentId, _props);
  }, [parentId, props]);

  return onMouseEnter;
};

export default function useTippy<T extends HTMLElement>(props: UseTippyOptions) {
  const targetRef = useRef<T>(null);
  const instanceRef = useRef<Instance<Props>>();

  useEffect(() => {
    const _props = { theme: 'maven', ...props };

    if (instanceRef.current) {
      instanceRef.current.setProps(_props);
    } else if (targetRef.current) {
      instanceRef.current = tippy(targetRef.current, _props);
    }
  }, [props]);

  useEffect(
    () => () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
      }
    },
    []
  );

  return targetRef;
}
