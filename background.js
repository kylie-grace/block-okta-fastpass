chrome.webNavigation.onCommitted.addListener(async ({ tabId, frameId, url }) => {
  const cfg = await chrome.storage.local.get({ enabled: true, domain: '' });
  if (!cfg.enabled || !cfg.domain) return;

  let hostname;
  try { hostname = new URL(url).hostname; } catch { return; }
  if (hostname !== cfg.domain) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ['blocker.js'],
      world: 'MAIN',
      injectImmediately: true,
    });
  } catch (e) {
    // Tab navigated away or was closed before injection
  }
});
