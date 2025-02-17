import { useEffect, useRef } from 'react';

export default function usePrevious<T>(value: T, skipUpdate = false) {
  // create a new reference
  const ref = useRef<T | undefined>();

  // store current value in ref
  useEffect(() => {
    if (!skipUpdate) {
      ref.current = value;
    }
  }, [value, skipUpdate]); // only re-run if value changes

  // return previous value (happens before update in useEffect above)
  return ref.current;
}
