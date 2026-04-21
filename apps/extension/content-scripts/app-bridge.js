/**
 * Freelancer OS Connector — App Bridge Content Script
 *
 * Injected into the Freelancer OS web app pages. Creates a two-way bridge
 * between the web page and the extension background service worker using
 * custom DOM events. The web app never needs to know the extension's ID.
 *
 * Web page  →  (CustomEvent FOS_SCRAPE_REQUEST)  →  bridge  →  background.js
 * background.js  →  (chrome.runtime.onMessage)  →  bridge  →  (CustomEvent FOS_SCRAPE_EVENT)  →  web page
 */

'use strict';

// ── Signal presence to the web page ──────────────────────────────────────────
// Scraper.tsx checks window.__FOS_EXTENSION_INSTALLED__ to know the extension exists.
// We set it on `window` but content scripts have their own JS context, so we use
// a custom element in the document as the cross-context signal.

const marker = document.createElement('meta');
marker.setAttribute('name', 'fos-extension-installed');
marker.setAttribute('content', chrome.runtime.id);
(document.head || document.documentElement).appendChild(marker);

// Also inject a tiny inline script to set the global on the page's window
const injectScript = document.createElement('script');
injectScript.textContent = `
  window.__FOS_EXTENSION_INSTALLED__ = true;
  window.__FOS_EXTENSION_ID__ = "${chrome.runtime.id}";
`;
(document.head || document.documentElement).appendChild(injectScript);
injectScript.remove(); // Clean up after execution

// ── Web page → Extension ──────────────────────────────────────────────────────
// Listen for scrape requests dispatched by the web app's React code.
window.addEventListener('FOS_SCRAPE_REQUEST', (event) => {
  const detail = event.detail || {};
  chrome.runtime.sendMessage({
    type:     'SCRAPE',
    query:    detail.query    || '',
    platform: detail.platform || 'both',
    // apiUrl and authToken are NOT passed from the page — background.js reads
    // them from chrome.storage.local (stored there by popup.js). This keeps
    // sensitive tokens off the page DOM.
  }, (response) => {
    if (chrome.runtime.lastError) return; // Extension not ready
    window.dispatchEvent(new CustomEvent('FOS_SCRAPE_RESPONSE', { detail: response }));
  });
});

// Also support direct AUTO_SCRAPE toggle from the page
window.addEventListener('FOS_AUTO_SCRAPE', (event) => {
  const detail = event.detail || {};
  chrome.runtime.sendMessage({
    type: detail.enabled ? 'AUTO_SCRAPE_ON' : 'AUTO_SCRAPE_OFF',
  }).catch(() => {});
});

// ── Extension → Web page ──────────────────────────────────────────────────────
// Forward all SCRAPE_STATUS and SCRAPE_DONE messages from background.js to
// the web page as custom DOM events that React can listen to.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SCRAPE_STATUS' || msg.type === 'SCRAPE_DONE') {
    window.dispatchEvent(new CustomEvent('FOS_SCRAPE_EVENT', { detail: msg }));
  }
  // Return false = no async response needed
  return false;
});
