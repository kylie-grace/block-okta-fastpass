function updateStatus(enabled, domain) {
  const badge = document.getElementById('statusBadge');
  const activeDomain = document.getElementById('activeDomain');
  if (!badge) return;

  badge.textContent = '';
  const dot = document.createElement('span');
  const label = document.createElement('span');
  dot.className = 'dot';
  badge.appendChild(dot);
  badge.appendChild(label);

  if (!domain) {
    dot.classList.add('dot-warn');
    label.className = 'text-warn';
    label.textContent = 'Setup required';
    if (activeDomain) activeDomain.textContent = 'your configured domain';
    return;
  }

  if (activeDomain) activeDomain.textContent = domain;

  if (!enabled) {
    dot.classList.add('dot-inactive');
    label.className = 'text-inactive';
    label.textContent = 'Disabled';
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0];
    const url = tab && tab.url;
    let onDomain = false;
    try { onDomain = url && new URL(url).hostname === domain; } catch (e) {}

    if (onDomain) {
      dot.classList.add('dot-active');
      label.className = 'text-active';
      label.textContent = 'Active';
    } else {
      dot.classList.add('dot-inactive');
      label.className = 'text-inactive';
      label.textContent = 'Standby';
    }
  });
}

function sanitizeDomain(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
}

chrome.storage.local.get({ enabled: true, domain: '' }, function (cfg) {
  const toggle = document.getElementById('enabledToggle');
  const input = document.getElementById('domainInput');

  toggle.checked = cfg.enabled;
  input.value = cfg.domain;
  updateStatus(cfg.enabled, cfg.domain);

  toggle.addEventListener('change', function () {
    const enabled = toggle.checked;
    chrome.storage.local.set({ enabled }, function () {
      chrome.storage.local.get({ domain: '' }, function (c) {
        updateStatus(enabled, c.domain);
      });
    });
  });

  function saveDomain() {
    const domain = sanitizeDomain(input.value);
    input.value = domain;
    chrome.storage.local.set({ domain }, function () {
      chrome.storage.local.get({ enabled: true }, function (c) {
        updateStatus(c.enabled, domain);
      });
    });
  }

  input.addEventListener('blur', saveDomain);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { input.blur(); }
  });
});
