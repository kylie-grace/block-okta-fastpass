# Block Okta FastPass — Brave/Chrome Extension

A minimal browser extension for University of Michigan staff who manage **service account profiles** in Brave or Chrome. It prevents Okta FastPass (Okta Verify on macOS) from automatically signing in with your primary device identity, and shows the standard authenticator picker instead.

---

## The Problem

When you visit any U-M Okta-protected app in a browser profile that has your primary U-M account, Okta FastPass silently polls your Mac's Okta Verify app and approves the login automatically. There is no built-in way to disable this per browser profile.

Service account profiles need to log in with *different* credentials — but FastPass hijacks the flow before you can choose.

---

## What This Extension Does

1. **Blocks loopback probes** — Okta's SDK tries to reach the Okta Verify app at `127.0.0.1:*`. Blocking these probes signals to Okta that FastPass is unavailable (the same thing Chrome does via Local Network Access restrictions).

2. **Redirects the poll** — If Okta still tries to poll for FastPass status, the extension intercepts the request and sends a cancellation to Okta's own cancel endpoint (`/idp/idx/authenticators/poll/cancel`), which gracefully exits the FastPass flow.

3. **Shows the authenticator picker** — After cancellation, Okta presents the standard list of sign-in methods (password, Duo, etc.) so you can log in with the correct service account credentials.

The extension only runs on `okta.umich.edu`. It does **not** touch any other sites or capture any credentials.

---

## Install Instructions

> **Important:** Install this extension only in **service account profiles**, never in your primary profile.

1. Download or clone this folder to your local disk.

2. Open `brave://extensions` (or `chrome://extensions`).

3. Enable **Developer mode** using the toggle in the top-right corner.

4. Click **Load unpacked** and select the folder containing this `README.md`.

5. The extension should appear as **"Block Okta FastPass"** with a shield icon and no errors.

6. If you previously added a uBlock Origin rule for `idp/idx/authenticators/poll`, **remove it** — it conflicts with this extension and will cause an error screen. This extension handles that path gracefully on its own.

7. Navigate to any U-M Okta-protected app. You should see the authenticator picker instead of being auto-signed in.

8. Repeat steps 2–7 for each additional service account profile.

---

## Troubleshooting

**Still seeing "unexpected internal error" or a blank screen?**

- Open DevTools → Application → Extensions and confirm the extension loaded with no errors.
- Open DevTools → Console and look for `[FastPass Blocker] active (main world)`. If you don't see it, the extension isn't injecting correctly — try reloading the extension.
- Check uBlock Origin's My Filters list for any rule containing `idp/idx`. Remove any such rules.

**Seeing `[FastPass Blocker] Poll intercepted` but still crashing?**

- The `poll/cancel` and `/idp/idx/cancel` attempts may both be blocked. Check the Network tab for `ERR_BLOCKED_BY_CLIENT` on those URLs — again, this is typically a uBlock rule.

**Poll endpoint moved?**

- Open DevTools → Network on the Okta login page and filter for `poll`. Note the new URL, update `content.js` to match.

---

## How It Works (Technical)

Okta's login widget runs entirely in JavaScript on the page. Content scripts in Chromium run in an isolated JavaScript world — they cannot intercept `window.fetch` calls made by the page.

To work around this, the extension injects a `<script>` tag directly into the page's main world at `document_start` (before Okta's scripts load). This script overrides `window.fetch` globally, intercepting all fetch calls made by the Okta widget.

The fetch override:
- Rejects fetch calls to `127.0.0.1` and `*.authenticatorlocalprod.com` (FastPass local probe)
- Captures the `stateHandle` and Okta origin from passthrough `introspect`/`identify` responses
- On poll intercept, POSTs to `/idp/idx/authenticators/poll/cancel` (graceful Okta cancel)
- Falls back to `/idp/idx/cancel` if the poll/cancel URL is unreachable
- Returns a synthetic IDX error response as a last resort

---

## File Structure

```
block-okta-fastpass/
├── README.md
├── CLAUDE.md          ← AI assistant instructions (ignore)
├── manifest.json
├── content.js
├── popup.html
├── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Notes

- This extension uses Manifest V2 (not V3). Brave continues to support MV2. MV3's `declarativeNetRequest` API cannot block loopback/localhost URLs in Brave, which is required for this approach.
- The extension captures the Okta `stateHandle` and origin URL at runtime from live Okta responses. No credentials, tokens, or personal data are stored or transmitted.