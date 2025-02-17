const DEFAULT_URL = '__DEFAULT_URL__';

chrome.browserAction.onClicked.addListener(() => {
  chrome.storage.sync.get('targetUrl', (data) => {
    const url = data.targetUrl || DEFAULT_URL;
    chrome.tabs.create({ url });
  });
});

chrome.browserAction.onClicked.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    // Define common new tab URLs for Chromium-based browsers.
    const newTabUrls = ['chrome://newtab/', 'chrome://newtab', 'about:newtab', 'about:newtab/'];

    if (currentTab && newTabUrls.includes(currentTab.url)) {
      // If current tab is a new tab, update it with the target URL.
      chrome.tabs.update(currentTab.id, { url: DEFAULT_URL });
    } else {
      // Otherwise, open the target URL in a new tab.
      chrome.tabs.create({ url: DEFAULT_URL });
    }
  });
});
