# Block Okta FastPass — Brave/Chrome Extension

A minimal browser extension for anyone who manages **service account profiles** in Brave or Chrome. It prevents Okta FastPass (Okta Verify on macOS) from automatically signing in with your primary device identity, and shows the standard authenticator picker instead.

Works with any Okta installation — configure your organization's Okta domain after installing.

---

## The Problem

When you visit any Okta-protected app in a browser profile that has your primary account, Okta FastPass silently polls your Mac's Okta Verify app and approves the login automatically. There is no built-in way to disable this per browser profile.

Service account profiles need to log in with *different* credentials — but FastPass hijacks the flow before you can choose.

---

## What This Extension Does

1. **Blocks loopback probes** — Okta's SDK tries to reach the Okta Verify app at `127.0.0.1:*`. Blocking these probes signals to Okta that FastPass is unavailable (the same thing Chrome does via Local Network Access restrictions).

2. **Redirects the poll** — If Okta still tries to poll for FastPass status, the extension intercepts the request and sends a cancellation to Okta's own cancel endpoint (`/idp/idx/authenticators/poll/cancel`), which gracefully exits the FastPass flow.

3. **Shows the authenticator picker** — After cancellation, Okta presents the standard list of sign-in methods (password, Duo, etc.) so you can log in with the correct service account credentials.

The extension only runs on the domain you configure. It does **not** touch any other sites or capture any credentials.

---

## Install Instructions

> **Important:** Install this extension only in **service account profiles**, never in your primary profile.

1. Download or clone this folder to your local disk.

2. Open `brave://extensions` (or `chrome://extensions`).

3. Enable **Developer mode** using the toggle in the top-right corner.

4. Click **Load unpacked** and select the folder containing this `README.md`.

5. The extension should appear as **"Block Okta FastPass"** with a shield icon and no errors.

6. Click the extension icon in the toolbar and enter your organization's Okta domain (e.g. `your-org.okta.com` or `okta.umich.edu`). Press Enter or click away to save.

7. If you previously added a uBlock Origin rule for `idp/idx/authenticators/poll`, **remove it** — it conflicts with this extension and will cause an error screen. This extension handles that path gracefully on its own.

8. Navigate to any Okta-protected app. You should see the authenticator picker instead of being auto-signed in.

9. Repeat steps 2–8 for each additional service account profile.

---

## Configuration

After installing, click the extension icon to open the popup:

- **Okta Domain** — Enter your organization's Okta domain (e.g. `your-org.okta.com`). The `https://` prefix and trailing slash are stripped automatically.
- **Toggle** — Enable or disable the extension without uninstalling. When disabled, FastPass runs normally.

The status badge shows:
- **Active** — Extension is enabled, domain is set, and you're on a matching Okta tab.
- **Standby** — Extension is enabled and configured, but the current tab isn't on your Okta domain.
- **Disabled** — Toggle is off.
- **Setup required** — No domain has been configured yet.

---

## Troubleshooting

**Still seeing "unexpected internal error" or a blank screen?**

- Open DevTools → Application → Extensions and confirm the extension loaded with no errors.
- Open DevTools → Console and look for `[FastPass Blocker] active (main world)`. If you don't see it, check that the domain in the popup matches the hostname you're on, and that the toggle is on.
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

## Security & Public Release Notes

This extension is safe to distribute publicly. Here's why:

**No sensitive data in the code.** The repository contains no credentials, tokens, API keys, hardcoded usernames, or organization-specific identifiers. The Okta domain is entered by the user at runtime and stored only in the local browser profile's `chrome.storage.local` — it never leaves the machine.

**No novel attack surface.** The two Okta endpoints used — `/idp/idx/authenticators/poll/cancel` and `/idp/idx/cancel` — are Okta's own published IDX API. Anyone can observe them by opening DevTools on an Okta login page. The extension calls them the same way Okta's own frontend would.

**This is not an authentication bypass.** The extension cancels the FastPass flow and shows the standard authenticator picker. The user still must authenticate with valid credentials (password, Duo, etc.). It does not grant access to anything.

**Cannot be used remotely.** Installing a Chromium extension requires physical access to the machine, enabling Developer mode, and clicking "Load unpacked." There is no way to deploy this extension to a browser profile without local access.

**Operates only on a user-specified domain.** The extension is completely inert on all pages except the Okta hostname the user explicitly configures. It does not intercept any other network traffic.

---

## Notes

- This extension uses Manifest V2 (not V3). Brave continues to support MV2. MV3's `declarativeNetRequest` API cannot block loopback/localhost URLs in Brave, which is required for this approach.
- The extension captures the Okta `stateHandle` and origin URL at runtime from live Okta responses. No credentials, tokens, or personal data are stored or transmitted.
- The domain you configure is stored locally in `chrome.storage.local` and never leaves your browser.
