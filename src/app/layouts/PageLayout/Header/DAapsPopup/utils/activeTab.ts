export function getActiveTabUrl(cb: (url?: string) => void) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      const url = activeTab.url;

      cb(url);
    }
  });
}

export function areUrlsContainSameHost(url1?: string, url2?: string) {
  if (!url1 || !url2) return false;

  const host1 = url1.split('/')[2].trim();
  const host2 = url2.split('/')[2].trim();

  return host1 === host2;
}
