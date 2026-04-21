/* ── Freelancer OS Connector — Background Service Worker ── */

'use strict';

// ── Keep-alive ────────────────────────────────────────────────────────────────
let _keepAliveInterval = null;

function startKeepAlive() {
  _keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
}

function stopKeepAlive() {
  if (_keepAliveInterval) { clearInterval(_keepAliveInterval); _keepAliveInterval = null; }
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    chrome.storage.local.get(['apiUrl', 'authToken']).then((stored) => {
      const apiUrl    = msg.apiUrl    || stored.apiUrl    || 'http://localhost:3001';
      const authToken = msg.authToken || stored.authToken || '';
      if (!authToken) {
        const errMsg = 'No auth token stored. Open the extension popup, paste your token, and click Save & Test.';
        chrome.storage.local.set({ scrapeStatus: errMsg });
        chrome.runtime.sendMessage({ type: 'SCRAPE_DONE', error: errMsg }).catch(() => {});
        return;
      }
      handleScrape({ query: msg.query, platform: msg.platform, apiUrl, authToken, filters: msg.filters || null }).catch(console.error);
    });
    sendResponse({ started: true });
    return true;
  }

  if (msg.type === 'AUTO_SCRAPE_ON') {
    chrome.storage.local.get(['scheduleInterval']).then((d) => {
      const interval = d.scheduleInterval || 5;
      chrome.alarms.create('autoScrape', { periodInMinutes: interval });
    });
    sendResponse({ ok: true });
  }

  if (msg.type === 'AUTO_SCRAPE_OFF') {
    chrome.alarms.clear('autoScrape');
    sendResponse({ ok: true });
  }
});

// ── Alarm (auto-scrape) ───────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'autoScrape') return;

  const data = await chrome.storage.local.get([
    'lastQuery', 'lastPlatform', 'apiUrl', 'authToken', 'autoScrape',
    'scheduleDays', 'scheduleStartHour', 'scheduleEndHour',
  ]);

  if (!data.autoScrape || !data.lastQuery || !data.authToken) return;

  // Check day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const now        = new Date();
  const todayIndex = now.getDay();
  const activeDays = data.scheduleDays ?? [1, 2, 3, 4, 5]; // Mon–Fri default
  if (!activeDays.includes(todayIndex)) {
    console.log('[auto-scrape] Skipped — today not in scheduled days');
    return;
  }

  // Check hour range
  const startHour = data.scheduleStartHour ?? 9;
  const endHour   = data.scheduleEndHour   ?? 18;
  const curHour   = now.getHours();
  if (curHour < startHour || curHour >= endHour) {
    console.log(`[auto-scrape] Skipped — outside window ${startHour}:00–${endHour}:00`);
    return;
  }

  const apiUrl    = data.apiUrl    || 'http://localhost:3001';
  const authToken = data.authToken;
  const query     = data.lastQuery;
  const platform  = data.lastPlatform || 'both';

  console.log(`[auto-scrape] Running at ${now.toLocaleTimeString()} for "${query}" on ${platform}`);
  await handleScrape({ query, platform, apiUrl, authToken, isAutoScrape: true }).catch(console.error);
});

// ── Main scrape orchestrator ──────────────────────────────────────────────────

async function handleScrape({ query, platform, apiUrl, authToken, filters = null, isAutoScrape = false }) {
  startKeepAlive();

  const notify = (message) => {
    chrome.storage.local.set({ scrapeStatus: message });
    chrome.runtime.sendMessage({ type: 'SCRAPE_STATUS', message }).catch(() => {});
  };

  try {
    // ── Multi-keyword support: split by comma ────────────────────────────────
    const keywords = query.split(',').map(k => k.trim()).filter(Boolean);
    const uniqueKeywords = [...new Set(keywords)];
    const isMulti = uniqueKeywords.length > 1;

    console.log(`[extension] Starting scrape for ${uniqueKeywords.length} keyword(s): ${uniqueKeywords.join(', ')} on ${platform}`);

    const seenIds   = new Set();
    const allProjects = [];

    for (const keyword of uniqueKeywords) {
      if (isMulti) notify(`Searching "${keyword}" (${uniqueKeywords.indexOf(keyword) + 1}/${uniqueKeywords.length})…`);

      if (platform === 'upwork' || platform === 'both') {
        notify(isMulti ? `[${keyword}] Scraping Upwork…` : 'Scraping Upwork…');
        const uw = await scrapeUpwork(keyword, notify);
        console.log(`[extension] Upwork "${keyword}": ${uw.length} results`);
        for (const p of uw) { if (!seenIds.has(p.id)) { seenIds.add(p.id); allProjects.push(p); } }
        notify(isMulti ? `[${keyword}] Upwork: ${uw.length} found` : `Upwork: ${uw.length} projects found`);
      }

      if (platform === 'freelancer' || platform === 'both') {
        notify(isMulti ? `[${keyword}] Scraping Freelancer…` : 'Scraping Freelancer…');
        const fl = await scrapeFreelancer(keyword, notify);
        console.log(`[extension] Freelancer "${keyword}": ${fl.length} results`);
        for (const p of fl) { if (!seenIds.has(p.id)) { seenIds.add(p.id); allProjects.push(p); } }
        notify(isMulti ? `[${keyword}] Freelancer: ${fl.length} found` : `Freelancer: ${fl.length} projects found`);
      }
    }

    const scrapedCount = allProjects.length;

    // ── 24-hour freshness filter ─────────────────────────────────────────────
    const now = Date.now();
    const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
    const freshProjects = allProjects.filter(p => {
      const ms = p._postedMs;
      if (!ms || ms <= 0) return true; // unknown posting time → keep
      return (now - ms) <= TWENTY_FOUR_H;
    });

    const freshCount = freshProjects.length;
    const staleCount = scrapedCount - freshCount;
    if (staleCount > 0) {
      console.log(`[extension] Filtered out ${staleCount} stale projects (>24h old)`);
    }

    // ── Criteria filters (paymentVerified, minRating, etc.) ──────────────────
    const matchedProjects = applyFilters(freshProjects, filters);
    const matchedCount = matchedProjects.length;
    if (freshCount !== matchedCount) {
      console.log(`[extension] Criteria filtering: ${freshCount} fresh → ${matchedCount} matched`);
    }

    // Strip internal _postedMs field before sending to API
    const toSend = matchedProjects.map(({ _postedMs, ...rest }) => rest);

    notify(`${scrapedCount} scraped → ${matchedCount} matched — sending to app…`);
    console.log(`[extension] Sending ${matchedCount}/${scrapedCount} projects to backend for query "${query}"`);
    await sendProjectsToApi({ query, platform, projects: toSend, apiUrl, authToken });

    // Also send to automation endpoint for auto-scrape runs
    if (isAutoScrape) {
      await sendResultsToAutomation({ query, platform, projects: toSend, apiUrl, authToken }).catch(console.error);
    }

    const statusMsg = scrapedCount !== matchedCount
      ? `Done — ${scrapedCount} scraped → ${matchedCount} matched`
      : `Done — ${matchedCount} projects found`;

    chrome.storage.local.set({
      scrapeStatus: statusMsg,
      lastScrapeTime: Date.now(),
      lastScrapeCount: matchedCount,
      lastScrapedTotal: scrapedCount,
    });
    chrome.runtime.sendMessage({
      type: 'SCRAPE_DONE',
      count: matchedCount,
      scrapedTotal: scrapedCount,
    }).catch(() => {});

  } catch (err) {
    const errMsg = err?.message || String(err);
    console.error(`[extension] Scrape error:`, errMsg);
    chrome.storage.local.set({ scrapeStatus: `Error: ${errMsg}` });
    chrome.runtime.sendMessage({ type: 'SCRAPE_DONE', error: errMsg }).catch(() => {});
  } finally {
    stopKeepAlive();
  }
}

// ── Filter projects by user-configured criteria ───────────────────────────────
// Verification filters: only reject if explicitly false (undefined = unknown = pass).
// Numeric filters: reject if active and value unavailable or below threshold.

function applyFilters(projects, filters) {
  if (!filters) return projects;
  return projects.filter(p => {
    if (filters.paymentVerified && p.paymentVerified === false) return false;
    if (filters.profileVerified && p.identityVerified === false) return false;
    if (filters.depositMade     && p.depositMade === false)      return false;
    if (filters.minReviews > 0) {
      if (p.clientReviewCount == null || p.clientReviewCount < filters.minReviews) return false;
    }
    if (filters.minRating > 0) {
      if (p.clientRating == null || p.clientRating < filters.minRating) return false;
    }
    return true;
  });
}

// ── Upwork scraping ───────────────────────────────────────────────────────────

async function scrapeUpwork(query, notify) {
  notify('Fetching Upwork RSS feed…');
  const rssResults = await scrapeUpworkRss(query, notify);
  console.log(`[upwork] RSS strategy: ${rssResults.length} jobs`);
  return rssResults;
}

// ── Upwork: RSS feed ──────────────────────────────────────────────────────────

async function scrapeUpworkRss(query, notify) {
  const MAX_PROJECTS = 500;
  const PAGE_SIZE = 50;
  const projects = [];
  const seenIds = new Set();

  for (let offset = 0; offset < MAX_PROJECTS; offset += PAGE_SIZE) {
    const pageNo = Math.floor(offset / PAGE_SIZE) + 1;
    notify(`Upwork RSS: fetching page ${pageNo} (${offset + 1}-${offset + PAGE_SIZE})…`);

    let pageResults = await fetchUpworkRssPage(query, offset, false);
    if (pageResults.length === 0) {
      // Fallback to cookie-authenticated fetch for stricter edge responses.
      pageResults = await fetchUpworkRssPage(query, offset, true);
    }

    if (pageResults.length === 0) break;

    for (const project of pageResults) {
      if (seenIds.has(project.id)) continue;
      seenIds.add(project.id);
      projects.push(project);
      if (projects.length >= MAX_PROJECTS) break;
    }

    if (pageResults.length < PAGE_SIZE || projects.length >= MAX_PROJECTS) break;
  }

  return projects;
}

async function fetchUpworkRssPage(query, offset, useCookies) {
  try {
    const headers = {
      Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
    };

    if (useCookies) {
      const cookies = await chrome.cookies.getAll({ domain: '.upwork.com' });
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      if (cookieStr) headers.Cookie = cookieStr;
    }

    const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(query)}&sort=recency&paging=${offset};50`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return [];

    const text = await resp.text();
    const trimmed = text.trim();
    if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<rss')) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) return [];

    const items = [...doc.querySelectorAll('item')];
    return items.map(parseUpworkRssItem).filter(Boolean);
  } catch {
    return [];
  }
}

function parseUpworkRssItem(item) {
  const title = item.querySelector('title')?.textContent?.trim() || '';
  const link = item.querySelector('link')?.textContent?.trim() || '';
  const desc = item.querySelector('description')?.textContent?.trim() || '';
  const pubDate = item.querySelector('pubDate')?.textContent?.trim() || 'Unknown';
  if (!title || !link) return null;

  const clean = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
  const budgetM = desc.match(/(?:Budget|Hourly Range)[:\s]+(\$[\d,./\-]+(?:\s*\/hr)?)/i);
  const skillsM = desc.match(/Skills:\s*([^\n<]+)/i);
  const jobId = link.includes('~') ? link.split('~')[1].split('?')[0] : crypto.randomUUID();

  const parsedDate = new Date(pubDate);
  return {
    id: `uw_${jobId}`,
    title,
    description: clean,
    budget: budgetM?.[1]?.trim() ?? 'Negotiable',
    skills: skillsM ? skillsM[1].split(',').map(s => s.trim()).filter(Boolean).slice(0, 8) : [],
    clientCountry: '',
    clientRating: null,
    postedAt: pubDate,
    url: link,
    platform: 'upwork',
    proposalsCount: null,
    _postedMs: isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime(),
  };
}

// ── Freelancer scraping — direct API, NO tabs ever ────────────────────────────
// Reads cookies explicitly via chrome.cookies API and sets them as a Cookie
// header, since service workers cannot use credentials:'include'.

const CURRENCY_SYMBOLS = { 1: 'USD', 3: 'GBP', 7: 'EUR', 8: 'AUD', 9: 'CAD' };

async function scrapeFreelancer(query, notify) {
  const MAX_PROJECTS = 1000;
  const PAGE_SIZE    = 100;
  const BATCH_SIZE   = 3;
  const API_BASE     = 'https://www.freelancer.com/api/projects/0.1/projects/active/';
  const BASE_PARAMS  = {
    full_description: 'true', job_details: 'true', user_details: 'true',
    compact: 'false', 'project_statuses[]': 'active',
    sort_field: 'time_updated', reverse_sort: 'true',
  };

  // Get cookies once for the session
  let cookieStr = '';
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.freelancer.com' });
    cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch { /* proceed without cookies — API is partly public */ }

  const seenIds     = new Set();
  const allProjects = [];
  let offset        = 0;
  let batchNum      = 1;

  while (allProjects.length < MAX_PROJECTS) {
    const batchOffsets = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const off = offset + i * PAGE_SIZE;
      if (off < MAX_PROJECTS) batchOffsets.push(off);
    }
    if (batchOffsets.length === 0) break;

    notify(`Freelancer: fetching batch ${batchNum} (${allProjects.length} found so far)…`);

    const settled = await Promise.allSettled(
      batchOffsets.map(off => fetchFreelancerPage(API_BASE, BASE_PARAMS, query, PAGE_SIZE, off, cookieStr)),
    );

    let hitEmpty = false;
    for (const res of settled) {
      if (res.status === 'rejected') { hitEmpty = true; continue; }
      const projects = res.value;
      if (!projects || projects.length === 0) { hitEmpty = true; continue; }
      for (const p of projects) {
        const pid = `fl_${p.id}`;
        if (seenIds.has(pid)) continue;
        seenIds.add(pid);
        const parsed = parseFreelancerProject(p);
        if (parsed) allProjects.push(parsed);
      }
    }

    if (hitEmpty) break;
    offset   += PAGE_SIZE * BATCH_SIZE;
    batchNum += 1;
    await sleep(350 + Math.random() * 100);
  }

  return allProjects;
}

async function fetchFreelancerPage(baseUrl, baseParams, query, limit, offset, cookieStr) {
  const params = new URLSearchParams({
    ...baseParams, query,
    limit: String(limit), offset: String(offset),
    _t: String(Math.floor(Date.now() / 1000)),
  });

  const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  // Chrome extensions CAN set Cookie header from service workers
  if (cookieStr) headers['Cookie'] = cookieStr;

  const resp = await fetch(`${baseUrl}?${params}`, { headers });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data?.result?.projects ?? [];
}

function parseFreelancerProject(p) {
  try {
    const budget    = p.budget || {};
    const currency  = CURRENCY_SYMBOLS[budget.currency_id] || 'USD';
    const bMin      = Math.round(budget.minimum || 0);
    const bMax      = Math.round(budget.maximum || 0);
    const budgetStr = bMax ? `$${bMin}–$${bMax} ${currency}` : `$${bMin}+ ${currency}`;
    const skills    = (p.jobs || []).map(j => j.name).filter(Boolean).slice(0, 8);
    const country   = (typeof p.owner === 'object' ? p.owner?.country : '') || '';
    const bidCount  = p.bid_stats?.bid_count ?? null;
    const submitted = p.time_submitted;
    const postedAt  = submitted
      ? new Date(submitted * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Unknown';
    const seoUrl = p.seo_url || '';
    const pid    = String(p.id || crypto.randomUUID());
    const url    = seoUrl
      ? `https://www.freelancer.com/projects/${seoUrl}`
      : `https://www.freelancer.com/projects/${pid}`;
    return {
      id: `fl_${pid}`, title: p.title || 'Untitled',
      description: (p.description || '').trim().substring(0, 500),
      budget: budgetStr, skills, clientCountry: country,
      clientRating: null, postedAt, url, platform: 'freelancer',
      proposalsCount: bidCount,
      _postedMs: submitted ? submitted * 1000 : 0,
    };
  } catch { return null; }
}

// ── Send results to API ───────────────────────────────────────────────────────

async function sendProjectsToApi({ query, platform, projects, apiUrl, authToken }) {
  const resp = await fetch(`${apiUrl}/api/v1/scraper/extension-results`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, platform, projects }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `API ${resp.status}`);
  }
  return resp.json();
}

async function sendResultsToAutomation({ query, platform, projects, apiUrl, authToken }) {
  const resp = await fetch(`${apiUrl}/api/v1/scraper/auto-results`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, platform, projects, source: 'extension-auto' }),
  });
  if (!resp.ok) return;
  return resp.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
