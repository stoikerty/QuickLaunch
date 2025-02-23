const DEFAULT_URL = '__DEFAULT_URL__';

chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    // Define new tab URL prefixes for Chromium-based browsers.
    const newTabUrls = ['chrome://newtab', 'about:newtab', 'chrome://vivaldi-webui/startpage'];

    if (currentTab && newTabUrls.some((prefix) => currentTab.url.startsWith(prefix))) {
      // If current tab is a new tab, update it with the target URL.
      chrome.tabs.update(currentTab.id, { url: DEFAULT_URL });
    } else {
      // Otherwise, open the target URL in a new tab.
      chrome.tabs.create({ url: DEFAULT_URL });
    }
  });
});
