// Check if the active tab is on an Okta page and show a contextual warning if not.
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const tab = tabs && tabs[0];
  const url = tab && tab.url;
  const onOkta = url && url.includes('okta.umich.edu');

  if (!onOkta) {
    const warning = document.getElementById('warning');
    if (warning) warning.classList.add('visible');

    const badge = document.getElementById('statusBadge');
    if (badge) {
      badge.textContent = '';
      const dot = document.createElement('span');
      dot.className = 'dot dot-inactive';
      const label = document.createElement('span');
      label.className = 'text-inactive';
      label.textContent = 'Standby';
      badge.appendChild(dot);
      badge.appendChild(label);
    }
  }
});
