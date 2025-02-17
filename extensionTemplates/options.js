document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const saveButton = document.getElementById('saveButton');
  const status = document.getElementById('status');

  // Load the saved URL.
  chrome.storage.sync.get('targetUrl', (data) => {
    if (data.targetUrl) {
      urlInput.value = data.targetUrl;
    }
  });

  saveButton.addEventListener('click', () => {
    const url = urlInput.value;
    if (!url) {
      status.textContent = 'Please enter a URL.';
      status.style.color = 'red';
      return;
    }
    // Validate the URL.
    try {
      new URL(url);
    } catch (e) {
      status.textContent = 'Invalid URL.';
      status.style.color = 'red';
      return;
    }
    chrome.storage.sync.set({ targetUrl: url }, () => {
      status.textContent = 'URL saved!';
      status.style.color = 'green';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });
});
