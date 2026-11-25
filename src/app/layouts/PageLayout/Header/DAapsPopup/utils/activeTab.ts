export function getActiveTabUrl(cb: (url?: string) => void) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      const url = activeTab.url;

      cb(url);
    }
  });
}

const getUrlHost = (url?: string) => {
  if (!url) return null;

  try {
    return new URL(url).host.trim();
  } catch {
    return null;
  }
};

export function areUrlsContainSameHost(url1?: string, url2?: string) {
  const host1 = getUrlHost(url1);
  const host2 = getUrlHost(url2);

  if (!host1 || !host2) return false;

  return host1 === host2;
}
