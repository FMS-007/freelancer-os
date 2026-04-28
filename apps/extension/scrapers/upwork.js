/**
 * Upwork scraping — service worker module.
 * Loaded by background.js via importScripts('scrapers/upwork.js').
 */

'use strict';

const UW_MAX_PROJECTS = 200;
const UW_PAGE_SIZE    = 50;
// RSS is sorted newest-first; stop paginating once a page has no result
// within this window — all subsequent pages will be even older.
const UW_STOP_AGE_MS  = 12 * 60 * 60 * 1000;

async function scrapeUpwork(query, notify) {
  notify('Fetching Upwork RSS feed…');
  const results = await scrapeUpworkRss(query, notify);
  console.log(`[upwork] ${results.length} projects for "${query}"`);
  return results;
}

async function scrapeUpworkRss(query, notify) {
  const projects = [];
  const seenIds  = new Set();
  const now      = Date.now();

  for (let offset = 0; offset < UW_MAX_PROJECTS; offset += UW_PAGE_SIZE) {
    const pageNo = Math.floor(offset / UW_PAGE_SIZE) + 1;
    notify(`Upwork RSS: page ${pageNo}…`);

    let pageResults = await fetchUpworkRssPage(query, offset, false);
    if (pageResults.length === 0) pageResults = await fetchUpworkRssPage(query, offset, true);
    if (pageResults.length === 0) break;

    let pageHasRecent = false;
    for (const p of pageResults) {
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      projects.push(p);
      if (p._postedMs > 0 && now - p._postedMs <= UW_STOP_AGE_MS) pageHasRecent = true;
      if (projects.length >= UW_MAX_PROJECTS) break;
    }

    if (!pageHasRecent && pageResults.length > 0) {
      console.log(`[upwork] Early stop at page ${pageNo} — all results older than 12 h`);
      break;
    }
    if (pageResults.length < UW_PAGE_SIZE || projects.length >= UW_MAX_PROJECTS) break;
  }

  return projects;
}

async function fetchUpworkRssPage(query, offset, useCookies) {
  try {
    const headers = {
      Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.upwork.com/',
    };
    if (useCookies) {
      const cookies   = await chrome.cookies.getAll({ domain: '.upwork.com' });
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      if (cookieStr) headers.Cookie = cookieStr;
    }

    const url  = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(query)}&sort=recency&paging=${offset};${UW_PAGE_SIZE}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      console.warn(`[upwork] RSS HTTP ${resp.status} at offset=${offset} useCookies=${useCookies}`);
      return [];
    }

    const text    = await resp.text();
    const trimmed = text.trim();
    if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<rss')) {
      console.warn(`[upwork] Non-XML response at offset=${offset}: ${trimmed.substring(0, 120)}`);
      return [];
    }

    const parser = new DOMParser();
    const doc    = parser.parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) {
      console.warn(`[upwork] XML parse error at offset=${offset}`);
      return [];
    }

    const items = [...doc.querySelectorAll('item')].map(parseUpworkRssItem).filter(Boolean);
    if (items.length > 0) console.log(`[upwork] offset=${offset} useCookies=${useCookies} → ${items.length} items`);
    return items;
  } catch (e) {
    console.error(`[upwork] Fetch error at offset=${offset}: ${e.message}`);
    return [];
  }
}

function parseUpworkRssItem(item) {
  const title   = item.querySelector('title')?.textContent?.trim()       || '';
  const link    = item.querySelector('link')?.textContent?.trim()        || '';
  const desc    = item.querySelector('description')?.textContent?.trim() || '';
  const pubDate = item.querySelector('pubDate')?.textContent?.trim()     || '';
  if (!title || !link) return null;

  const clean   = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
  const budgetM = desc.match(/(?:Budget|Hourly Range)[:\s]+(\$[\d,./\-]+(?:\s*\/hr)?)/i);
  const skillsM = desc.match(/Skills:\s*([^\n<]+)/i);
  const jobId   = link.includes('~') ? link.split('~')[1].split('?')[0] : crypto.randomUUID();
  const parsed  = pubDate ? new Date(pubDate) : new Date(NaN);

  return {
    id:                `uw_${jobId}`,
    title,
    description:       clean,
    budget:            budgetM?.[1]?.trim() ?? 'Negotiable',
    skills:            skillsM ? skillsM[1].split(',').map(s => s.trim()).filter(Boolean).slice(0, 8) : [],
    clientCountry:     '',
    clientRating:      null,
    clientReviewCount: null,
    paymentVerified:   null,
    identityVerified:  null,
    postedAt:          pubDate || 'Unknown',
    url:               link,
    platform:          'upwork',
    proposalsCount:    null,
    _postedMs:         isNaN(parsed.getTime()) ? 0 : parsed.getTime(),
  };
}
