import { useEffect, useRef } from 'react';

/**
 * turn off animation on initial render
 */
export const useInitialOffAnimation = () => {
  const allowAnimationRef = useRef(false);

  useEffect(() => {
    if (allowAnimationRef.current) allowAnimationRef.current = false;

    const timeout = setTimeout(() => {
      allowAnimationRef.current = true;
    }, 500);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  });

  return allowAnimationRef;
};
