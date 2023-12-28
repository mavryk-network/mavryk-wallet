import React, { useEffect, useMemo, useRef } from 'react';

/**
 * turn off animation on initial load
 */
export const useInitialOffAnimation = () => {
  const animationRef = useRef<string | null>('none');

  useEffect(() => {
    const timeout = setTimeout(() => {
      animationRef.current = null;
    }, 500);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const memoizedStyles = useMemo(() => (animationRef.current ? { animation: 'none' } : {}), [animationRef.current]);

  return memoizedStyles;
};
