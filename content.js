// Inject into main page world so window.fetch override actually intercepts Okta's calls.
(function () {
  const script = document.createElement('script');
  script.textContent = `(function () {
  'use strict';

  let capturedStateHandle = null;
  let capturedIdxOrigin = null;  // e.g. "https://okta.umich.edu"

  function tryCapture(json, urlStr) {
    if (json && json.stateHandle) {
      capturedStateHandle = json.stateHandle;
    }
    if (urlStr && !capturedIdxOrigin) {
      try { capturedIdxOrigin = new URL(urlStr).origin; } catch (e) {}
    }
  }

  async function passThroughCapturing(realResponse, urlStr) {
    const ct = realResponse.headers.get('Content-Type') || '';
    if (realResponse.ok && (ct.includes('json') || ct.includes('ion'))) {
      const text = await realResponse.text();
      try { tryCapture(JSON.parse(text), urlStr); } catch (e) {}
      return new Response(text, {
        status: realResponse.status,
        statusText: realResponse.statusText,
        headers: new Headers(realResponse.headers),
      });
    }
    return realResponse;
  }

  const _fetch = window.fetch;

  window.fetch = async function (url, options) {
    const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : String(url));

    // Block loopback probes to localhost/Okta Verify ports.
    // This simulates Chrome LNA restriction — Okta has graceful handling for this path.
    if (
      urlStr.startsWith('http://127.0.0.1') ||
      urlStr.startsWith('https://127.0.0.1') ||
      urlStr.includes('.authenticatorlocalprod.com')
    ) {
      console.log('[FastPass Blocker] Blocking loopback probe:', urlStr.substring(0, 80));
      return Promise.reject(new TypeError('Failed to fetch'));
    }

    // Pass introspect and identify through unchanged — capture stateHandle & origin.
    if (urlStr.includes('/idp/idx/introspect') || urlStr.includes('/idp/idx/identify')) {
      console.log('[FastPass Blocker] Passthrough+capture:', urlStr.split('/').pop());
      tryCapture(null, urlStr);
      const real = await _fetch.apply(this, arguments);
      return passThroughCapturing(real, urlStr);
    }

    // Intercept poll — try cancel-polling first, fall back to main cancel.
    if (urlStr.includes('/idp/idx/authenticators/poll') && !urlStr.includes('/cancel')) {
      console.log('[FastPass Blocker] Poll intercepted');
      if (!capturedStateHandle || !capturedIdxOrigin) {
        console.warn('[FastPass Blocker] Missing stateHandle/origin — passing poll through');
        return _fetch.apply(this, arguments);
      }

      const body = JSON.stringify({ stateHandle: capturedStateHandle });
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/ion+json; okta-version=1.0.0',
      };

      // Attempt 1: poll/cancel (Okta's graceful FastPass exit — may be blocked by Shields)
      try {
        const cancelUrl = capturedIdxOrigin + '/idp/idx/authenticators/poll/cancel';
        console.log('[FastPass Blocker] Trying poll/cancel:', cancelUrl);
        const resp = await _fetch.call(window, cancelUrl, {
          method: 'POST', headers, body, credentials: 'same-origin',
        });
        console.log('[FastPass Blocker] poll/cancel succeeded, status:', resp.status);
        return resp;
      } catch (e) {
        console.warn('[FastPass Blocker] poll/cancel blocked/failed:', e.message, '— trying main cancel');
      }

      // Attempt 2: /idp/idx/cancel (resets the IDX transaction — URL has no "poll" so less likely to be blocked)
      try {
        const mainCancelUrl = capturedIdxOrigin + '/idp/idx/cancel';
        console.log('[FastPass Blocker] Trying main cancel:', mainCancelUrl);
        const resp = await _fetch.call(window, mainCancelUrl, {
          method: 'POST', headers, body, credentials: 'same-origin',
        });
        console.log('[FastPass Blocker] main cancel succeeded, status:', resp.status);
        return resp;
      } catch (e) {
        console.warn('[FastPass Blocker] main cancel also failed:', e.message);
      }

      // Both failed — return a synthetic IDX response that triggers Okta's error UI
      // (safer than crashing the state machine)
      console.error('[FastPass Blocker] All cancel attempts failed — returning synthetic error state');
      return new Response(
        JSON.stringify({
          version: '1.0.0',
          stateHandle: capturedStateHandle,
          messages: {
            type: 'array',
            value: [{
              message: 'FastPass not available on this profile. Please use a different sign-in method.',
              i18n: { key: 'errors.E0000095' },
              class: 'ERROR',
            }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/ion+json; okta-version=1.0.0' } }
      );
    }

    return _fetch.apply(this, arguments);
  };

  console.log('[FastPass Blocker] active (main world)');
})();`;

  (document.head || document.documentElement).appendChild(script);
  script.remove();
})();
