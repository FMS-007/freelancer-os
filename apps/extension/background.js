/* ── Freelancer OS Connector — Background Service Worker ── */
'use strict';

// Load platform scrapers before anything else (synchronous, runs in global scope)
importScripts('scrapers/upwork.js', 'scrapers/freelancer.js');

// ── Keep-alive ────────────────────────────────────────────────────────────────

let _keepAliveInterval = null;
function startKeepAlive() {
  _keepAliveInterval = setInterval(() => { chrome.runtime.getPlatformInfo(() => {}); }, 20000);
}
function stopKeepAlive() {
  if (_keepAliveInterval) { clearInterval(_keepAliveInterval); _keepAliveInterval = null; }
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'SCRAPE') {
    chrome.storage.local.get(
      ['apiUrl', 'authToken', 'selectedKeywords', 'lastPlatform', 'scrapeFilters'],
    ).then((stored) => {
      const apiUrl    = msg.apiUrl    || stored.apiUrl    || 'http://localhost:3001';
      const authToken = msg.authToken || stored.authToken || '';
      if (!authToken) {
        const err = 'No auth token. Open the extension popup, paste your token, and click Save & Test.';
        chrome.storage.local.set({ scrapeStatus: err });
        chrome.runtime.sendMessage({ type: 'SCRAPE_DONE', error: err }).catch(() => {});
        return;
      }
      const query    = msg.query    || (stored.selectedKeywords || []).join(', ') || stored.lastQuery || '';
      const platform = msg.platform || stored.lastPlatform || 'both';
      if (!query) {
        chrome.runtime.sendMessage({ type: 'SCRAPE_DONE', error: 'No keywords configured.' }).catch(() => {});
        return;
      }
      // Use caller-supplied filters first, then stored filters as fallback
      const filters  = msg.filters  || stored.scrapeFilters || null;
      handleScrape({ query, platform, apiUrl, authToken, filters }).catch(console.error);
    });
    sendResponse({ started: true });
    return true;
  }

  if (msg.type === 'AUTO_SCRAPE_ON') {
    chrome.storage.local.get(['scheduleInterval']).then((d) => {
      const interval = d.scheduleInterval || 15;
      chrome.alarms.clear('autoScrape', () => {
        chrome.alarms.create('autoScrape', { periodInMinutes: interval });
        console.log(`[extension] Auto-scrape enabled with ${interval} min interval`);
      });
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'AUTO_SCRAPE_OFF') {
    chrome.alarms.clear('autoScrape', () => {
      console.log('[extension] Auto-scrape disabled');
    });
    sendResponse({ ok: true });
    return true;
  }

  // Restart alarm with updated interval (called when schedule config changes from web app)
  if (msg.type === 'RESCHEDULE_IF_ACTIVE') {
    chrome.storage.local.get(['autoScrape', 'scheduleInterval'], (d) => {
      if (d.autoScrape) {
        const interval = d.scheduleInterval || 15;
        chrome.alarms.clear('autoScrape', () => {
          chrome.alarms.create('autoScrape', { periodInMinutes: interval });
          console.log(`[extension] Auto-scrape rescheduled to ${interval} min interval`);
        });
      }
    });
    sendResponse({ ok: true });
    return true;
  }
});

// ── Alarm (auto-scrape) ───────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'autoScrape') return;

  const data = await chrome.storage.local.get([
    'lastQuery', 'lastPlatform', 'apiUrl', 'authToken', 'autoScrape',
    'scheduleDays', 'scheduleStartHour', 'scheduleEndHour', 'scrapeFilters', 'selectedKeywords',
  ]);

  const resolvedQuery = (data.selectedKeywords || []).join(', ') || data.lastQuery || '';
  if (!data.autoScrape || !resolvedQuery || !data.authToken) {
    console.log('[auto-scrape] Skipped — autoScrape disabled or missing config');
    return;
  }

  // Day-of-week guard
  const now        = new Date();
  const todayIndex = now.getDay();
  const activeDays = data.scheduleDays ?? [1, 2, 3, 4, 5];
  if (!activeDays.includes(todayIndex)) {
    console.log('[auto-scrape] Skipped — today not in scheduled days');
    return;
  }

  // Hour-range guard
  const startHour = data.scheduleStartHour ?? 9;
  const endHour   = data.scheduleEndHour   ?? 18;
  if (now.getHours() < startHour || now.getHours() >= endHour) {
    console.log(`[auto-scrape] Skipped — outside window ${startHour}:00–${endHour}:00`);
    return;
  }

  console.log(`[auto-scrape] Running at ${now.toLocaleTimeString()} for "${resolvedQuery}" on ${data.lastPlatform || 'both'}`);
  await handleScrape({
    query:     resolvedQuery,
    platform:  data.lastPlatform || 'both',
    apiUrl:    data.apiUrl    || 'http://localhost:3001',
    authToken: data.authToken,
    filters:   data.scrapeFilters || null,
  }).catch(console.error);
});

// ── Main scrape orchestrator ──────────────────────────────────────────────────

async function handleScrape({ query, platform, apiUrl, authToken, filters = null }) {
  startKeepAlive();

  const notify = (message) => {
    chrome.storage.local.set({ scrapeStatus: message });
    chrome.runtime.sendMessage({ type: 'SCRAPE_STATUS', message }).catch(() => {});
  };

  try {
    // Split comma-separated query into individual keywords; scrape each separately
    const keywords      = query.split(',').map(k => k.trim()).filter(Boolean);
    const uniqueKws     = [...new Set(keywords)];
    const isMulti       = uniqueKws.length > 1;

    console.log(`[extension] Scraping ${uniqueKws.length} keyword(s): "${uniqueKws.join(', ')}" on ${platform}`);

    const seenIds     = new Set();
    const allProjects = [];

    for (const kw of uniqueKws) {
      if (isMulti) notify(`Searching "${kw}" (${uniqueKws.indexOf(kw) + 1}/${uniqueKws.length})…`);

      if (platform === 'upwork' || platform === 'both') {
        notify(isMulti ? `[${kw}] Scraping Upwork…` : 'Scraping Upwork…');
        const uw = await scrapeUpwork(kw, notify);
        for (const p of uw) { if (!seenIds.has(p.id)) { seenIds.add(p.id); allProjects.push(p); } }
        notify(isMulti ? `[${kw}] Upwork: ${uw.length}` : `Upwork: ${uw.length} found`);
      }

      if (platform === 'freelancer' || platform === 'both') {
        notify(isMulti ? `[${kw}] Scraping Freelancer…` : 'Scraping Freelancer…');
        const fl = await scrapeFreelancer(kw, notify);
        for (const p of fl) { if (!seenIds.has(p.id)) { seenIds.add(p.id); allProjects.push(p); } }
        notify(isMulti ? `[${kw}] Freelancer: ${fl.length}` : `Freelancer: ${fl.length} found`);
      }
    }

    const scrapedCount = allProjects.length;

    // ── 24-hour freshness: REJECT if timestamp is missing or older than 24 h ──
    const now          = Date.now();
    const TWENTY_FOUR  = 24 * 60 * 60 * 1000;
    const freshProjects = allProjects.filter(p => {
      if (!p._postedMs || p._postedMs <= 0) return false; // no timestamp → reject
      return (now - p._postedMs) <= TWENTY_FOUR;
    });

    const staleDropped = scrapedCount - freshProjects.length;
    if (staleDropped > 0) {
      console.log(`[extension] Dropped ${staleDropped} project(s) (no timestamp or older than 24 h)`);
    }

    // ── Criteria filtering (keywords + verification + ratings) ────────────────
    const matchedProjects = applyFilters(freshProjects, filters, uniqueKws);
    const matchedCount    = matchedProjects.length;
    console.log(`[extension] ${scrapedCount} scraped → ${freshProjects.length} fresh → ${matchedCount} matched`);

    // Strip internal _postedMs before sending to API
    const toSend = matchedProjects.map(({ _postedMs, ...rest }) => rest);

    notify(`${scrapedCount} scraped → ${matchedCount} matched — sending to app…`);

    // Send to both endpoints: extension-results (for Find Projects cache)
    // and auto-results (for Automation page display)
    // Both endpoints are critical for data flow — retry if one fails
    try {
      await sendProjectsToApi({ query, platform, projects: toSend, apiUrl, authToken });
    } catch (err) {
      console.warn('[extension] Failed to send to extension-results:', err?.message);
      // Continue anyway — try auto-results
    }
    try {
      await sendResultsToAutomation({ query, platform, projects: toSend, apiUrl, authToken });
    } catch (err) {
      console.warn('[extension] Failed to send to auto-results:', err?.message);
      // Continue anyway — at least one endpoint should have received data
    }

    const statusMsg = scrapedCount !== matchedCount
      ? `Done — ${scrapedCount} scraped → ${matchedCount} matched`
      : `Done — ${matchedCount} projects found`;

    chrome.storage.local.set({
      scrapeStatus:     statusMsg,
      lastScrapeTime:   Date.now(),
      lastScrapeCount:  matchedCount,
      lastScrapedTotal: scrapedCount,
    });
    chrome.runtime.sendMessage({
      type: 'SCRAPE_DONE',
      count: matchedCount,
      scrapedTotal: scrapedCount,
    }).catch(() => {});

  } catch (err) {
    const errMsg = err?.message || String(err);
    console.error('[extension] Scrape error:', errMsg);
    chrome.storage.local.set({ scrapeStatus: `Error: ${errMsg}` });
    chrome.runtime.sendMessage({ type: 'SCRAPE_DONE', error: errMsg }).catch(() => {});
  } finally {
    stopKeepAlive();
  }
}

// ── Filter projects ───────────────────────────────────────────────────────────
// keywords : string[] — at least one must appear in title+description (OR)
// filters  : { paymentVerified, profileVerified, depositMade, minReviews, minRating }
// Verification booleans: only reject if the field is explicitly false
//   (null/undefined = platform doesn't expose it = pass through)
// Numeric thresholds: only reject when the platform supplies the value AND it fails

function applyFilters(projects, filters, keywords) {
  return projects.filter(p => {
    // 1. Keyword match — at least one keyword must appear in title or description
    if (keywords && keywords.length > 0) {
      const text = ((p.title || '') + ' ' + (p.description || '')).toLowerCase();
      if (!keywords.some(k => text.includes(k.toLowerCase()))) return false;
    }

    if (!filters) return true;

    // 2. Boolean verification flags
    if (filters.paymentVerified && p.paymentVerified === false) return false;
    if (filters.profileVerified && p.identityVerified === false) return false;
    if (filters.depositMade     && p.depositMade === false)      return false;

    // 3. Numeric thresholds (pass when platform doesn't provide the data)
    if (filters.minReviews > 0 && p.clientReviewCount != null && p.clientReviewCount < filters.minReviews) return false;
    if (filters.minRating  > 0 && p.clientRating      != null && p.clientRating      < filters.minRating)  return false;

    return true;
  });
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function sendProjectsToApi({ query, platform, projects, apiUrl, authToken }) {
  const resp = await fetch(`${apiUrl}/api/v1/scraper/extension-results`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query, platform, projects }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `API ${resp.status}`);
  }
  return resp.json();
}

async function sendResultsToAutomation({ query, platform, projects, apiUrl, authToken }) {
  const resp = await fetch(`${apiUrl}/api/v1/scraper/auto-results`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query, platform, projects, source: 'extension' }),
  });
  if (!resp.ok) return;
  return resp.json();
}
