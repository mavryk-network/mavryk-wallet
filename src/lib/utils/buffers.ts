/**
 * (!) Apply this method in conjunction with `stringToArrayBuffer`
 * @return Latin-1 decoded string (one byte per char via charCodeAt)
 */
export const arrayBufferToString = (buf: ArrayBuffer) =>
  String.fromCharCode.apply(
    null,
    // @ts-expect-error
    new Uint8Array(buf)
  );

/**
 * @deprecated Use `new TextEncoder().encode(str)` for UTF-8 strings.
 * This function uses Latin-1/charCodeAt encoding and is retained only
 * for the legacy session-store read path. Do not use in new code.
 *
 * See: https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string
 */
export const stringToArrayBuffer = (str: string) => {
  const buf = new ArrayBuffer(str.length); // 1 byte for each char
  const bufView = new Uint8Array(buf);
  const strLength = str.length;
  for (let i = 0; i < strLength; i++) bufView[i] = str.charCodeAt(i);
  return buf;
};

/**
 * (!) Apply this method in conjunction with `stringToUInt8Array`
 */
export const uInt8ArrayToString = (ui8a: Uint8Array) => new TextDecoder('utf-8').decode(ui8a);

export const stringToUInt8Array = (str: string) => new TextEncoder().encode(str);
