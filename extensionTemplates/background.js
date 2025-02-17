const DEFAULT_URL = '__DEFAULT_URL__';

chrome.browserAction.onClicked.addListener(() => {
  chrome.storage.sync.get('targetUrl', (data) => {
    const url = data.targetUrl || DEFAULT_URL;
    chrome.tabs.create({ url });
  });
});
