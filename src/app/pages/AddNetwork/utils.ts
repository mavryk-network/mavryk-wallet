export function addHttps(url: string) {
  let _url = url;
  if (!/^https?:\/\//i.test(_url)) {
    _url = 'https://' + _url;
  }
  return _url;
}
