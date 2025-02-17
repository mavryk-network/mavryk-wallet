export async function handleCallbackWithPossibleAsync(clickHandler: unknown, setIslLoading?: (value: boolean) => void) {
  if (typeof clickHandler === 'function') {
    const callResult = clickHandler();
    if (callResult instanceof Promise) {
      setIslLoading?.(true);
      await callResult;
      setIslLoading?.(false);
    }
  }
}
