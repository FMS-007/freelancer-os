/**
 * Automation page
 *
 * Two modes:
 *   1. Test Now  — runs one immediate cycle regardless of time window
 *   2. Automation ON — runs on a configurable interval, respects start/end time window
 *
 * Each cycle:
 *   1. Calls scraperApi.search with the configured query / platform / limit.
 *   2. Applies all client-side match filters (tech stack, keywords, budget,
 *      rating, review count, verification flags).
 *   3. Deduplicates and appends matched projects to the Matched list.
 *   4. Auto-saves every newly matched project via scraperApi.saveProject (DB)
 *      and mirrors it into the shared localStorage key used by Project Search.
 *
 * Config + matched projects are persisted to localStorage so they survive
 * page refreshes (the automation interval itself must be re-enabled after reload).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Play, Square, FlaskConical, CheckCircle2, AlertCircle, Clock,
  SlidersHorizontal, ExternalLink, DollarSign, Globe, Users, Brain,
  Bookmark, BookmarkCheck, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw,
  Link2, Zap, Star,
} from 'lucide-react';
import { scraperApi } from '../lib/api';
import type { ScrapedProject } from '@freelancer-os/shared';
import { TECH_SKILLS } from '@freelancer-os/shared';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AutomationConfig {
  query:            string;
  platform:         'both' | 'upwork' | 'freelancer';
  intervalMinutes:  number;
  fetchLimit:       number;
  startTime:        string;  // "HH:MM"
  endTime:          string;  // "HH:MM"
  techStack:        string[];
  maxProposals:     string;
  minClientRating:  string;
  minClientReviews: string;
  includeKeywords:  string;
  excludeKeywords:  string;
  identityVerified: boolean;
  paymentVerified:  boolean;
  depositMade:      boolean;
  profileCompleted: boolean;
  minBudget:        string;
  maxBudget:        string;
}

interface RunLog {
  ts:      string;
  message: string;
  type:    'info' | 'success' | 'warn' | 'error';
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AutomationConfig = {
  query:            '',
  platform:         'both',
  intervalMinutes:  15,
  fetchLimit:       30,
  startTime:        '05:00',
  endTime:          '17:00',
  techStack:        [],
  maxProposals:     'any',
  minClientRating:  '',
  minClientReviews: '',
  includeKeywords:  '',
  excludeKeywords:  '',
  identityVerified: false,
  paymentVerified:  false,
  depositMade:      false,
  profileCompleted: false,
  minBudget:        '',
  maxBudget:        '',
};

const INTERVALS = [
  { label: 'Every 5 min',  value: 5  },
  { label: 'Every 10 min', value: 10 },
  { label: 'Every 15 min', value: 15 },
  { label: 'Every 30 min', value: 30 },
  { label: 'Every 1 hr',   value: 60 },
];

const AUTO_PAGE_SIZE = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

function parseBudgetMin(budget: string): number {
  const match = (budget ?? '').match(/\$?([\d,]+)/);
  return match ? parseInt(match[1].replace(',', ''), 10) : 0;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isWithinWindow(start: string, end: string): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const s   = timeToMinutes(start);
  const e   = timeToMinutes(end);
  if (s <= e) return cur >= s && cur <= e;
  return cur >= s || cur <= e; // overnight window
}

function matchesConfig(project: ScrapedProject, cfg: AutomationConfig): boolean {
  // Max proposals
  if (cfg.maxProposals !== 'any') {
    const max = parseInt(cfg.maxProposals, 10);
    if ((project.proposalsCount ?? 999) > max) return false;
  }

  // Min client rating
  if (cfg.minClientRating) {
    const min = parseFloat(cfg.minClientRating);
    if ((project.clientRating ?? 0) < min) return false;
  }

  // Min client review count
  if (cfg.minClientReviews) {
    const min = parseInt(cfg.minClientReviews, 10);
    if (!isNaN(min) && project.clientReviewCount != null && project.clientReviewCount < min) return false;
  }

  // Include keywords (title + description)
  const text = (project.title + ' ' + project.description).toLowerCase();
  if (cfg.includeKeywords.trim()) {
    const kws = cfg.includeKeywords.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    if (!kws.every(k => text.includes(k))) return false;
  }

  // Exclude keywords
  if (cfg.excludeKeywords.trim()) {
    const kws = cfg.excludeKeywords.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    if (kws.some(k => text.includes(k))) return false;
  }

  // Tech stack (project skills OR title/desc contains any selected item)
  if (cfg.techStack.length > 0) {
    const skillSet = (project.skills ?? []).map(s => s.toLowerCase());
    const hasStack = cfg.techStack.some(t => {
      const tl = t.toLowerCase();
      return skillSet.some(s => s.includes(tl)) || text.includes(tl);
    });
    if (!hasStack) return false;
  }

  // Budget filters
  if (cfg.minBudget) {
    const min = parseFloat(cfg.minBudget);
    if (!isNaN(min) && parseBudgetMin(project.budget) < min) return false;
  }
  if (cfg.maxBudget) {
    const max = parseFloat(cfg.maxBudget);
    if (!isNaN(max) && parseBudgetMin(project.budget) > max) return false;
  }

  // Verification filters (only check if flag set AND project data is present)
  if (cfg.identityVerified && project.identityVerified === false) return false;
  if (cfg.paymentVerified  && project.paymentVerified  === false) return false;
  if (cfg.depositMade      && project.depositMade      === false) return false;
  if (cfg.profileCompleted && project.profileCompleted === false) return false;

  return true;
}

function fmt(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Automation() {
  const navigate = useNavigate();

  // Persisted config
  const [config, setConfig] = useState<AutomationConfig>(() =>
    loadStorage<AutomationConfig>('fos_autoConfig', DEFAULT_CONFIG),
  );

  // Runtime state
  const [enabled,         setEnabled]         = useState(false);
  const [running,         setRunning]          = useState(false);
  const [matchedProjects, setMatchedProjects]  = useState<ScrapedProject[]>(() =>
    loadStorage<ScrapedProject[]>('fos_autoMatched', []),
  );

  // Saved projects — shared localStorage key with Project Search
  const [savedProjects, setSavedProjects] = useState<ScrapedProject[]>(() =>
    loadStorage<ScrapedProject[]>('fos_savedProjects', []),
  );

  const [logs,           setLogs]           = useState<RunLog[]>([]);
  const [lastRun,        setLastRun]        = useState<string | null>(null);
  const [nextRunIn,      setNextRunIn]      = useState<string>('—');
  const [showFilters,    setShowFilters]    = useState(true);
  const [stackSearch,    setStackSearch]    = useState('');
  const [matchedPage,    setMatchedPage]    = useState(1);
  const [showSavedPanel, setShowSavedPanel] = useState(false);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextFireRef  = useRef<number | null>(null);

  // Scraper online status
  const [scraperOnline, setScraperOnline] = useState<boolean | null>(null);

  useEffect(() => {
    scraperApi.status()
      .then(d => setScraperOnline(d?.status === 'online'))
      .catch(() => setScraperOnline(false));
  }, []);

  // Load saved projects from DB on mount (syncs across sessions)
  useEffect(() => {
    scraperApi.getSaved()
      .then(data => {
        if (!Array.isArray(data.records)) return;
        setSavedProjects(prev => {
          const existingIds = new Set(prev.map((p: ScrapedProject) => p.id));
          const fromDb: ScrapedProject[] = data.records
            .filter((r: { id: string }) => !existingIds.has(r.id))
            .map((r: {
              id: string; title: string; description: string;
              url: string | null; platform: string; techStack: string[];
              clientCountry: string; scrapedAt: string;
            }) => ({
              id:            r.id,
              title:         r.title,
              description:   r.description,
              budget:        '',
              skills:        r.techStack ?? [],
              clientCountry: r.clientCountry ?? '',
              clientRating:  null,
              postedAt:      r.scrapedAt ?? '',
              url:           r.url ?? '',
              platform:      (r.platform ?? 'upwork') as 'upwork' | 'freelancer',
              proposalsCount: null,
            }));
          return fromDb.length > 0 ? [...fromDb, ...prev] : prev;
        });
      })
      .catch(() => { /* offline / not authenticated — localStorage is fine */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist config
  useEffect(() => {
    localStorage.setItem('fos_autoConfig', JSON.stringify(config));
  }, [config]);

  // Persist matched projects
  useEffect(() => {
    localStorage.setItem('fos_autoMatched', JSON.stringify(matchedProjects));
  }, [matchedProjects]);

  // Persist saved projects (shared with Project Search)
  useEffect(() => {
    localStorage.setItem('fos_savedProjects', JSON.stringify(savedProjects));
  }, [savedProjects]);

  // ── Logging ──────────────────────────────────────────────────────────────────

  const addLog = useCallback((message: string, type: RunLog['type'] = 'info') => {
    setLogs(prev => [{ ts: fmt(new Date()), message, type }, ...prev].slice(0, 50));
  }, []);

  // ── Run cycle ────────────────────────────────────────────────────────────────

  const runCycle = useCallback(async (manual = false) => {
    if (running) return;
    if (!manual && !isWithinWindow(config.startTime, config.endTime)) {
      addLog(`Skipped — outside window (${config.startTime}–${config.endTime})`, 'warn');
      return;
    }
    if (!config.query.trim()) {
      addLog('Skipped — no search query configured', 'warn');
      return;
    }

    setRunning(true);
    addLog(`Cycle started: "${config.query}" on ${config.platform}`, 'info');

    try {
      const data = await scraperApi.search({
        query:    config.query,
        platform: config.platform,
        limit:    config.fetchLimit,
      });

      // Log per-platform outcomes so the user knows exactly what happened
      const outcomes = (data.platformOutcomes ?? {}) as Record<string, { status: string; count: number; message: string }>;
      Object.entries(outcomes).forEach(([platform, outcome]) => {
        const cap = platform.charAt(0).toUpperCase() + platform.slice(1);
        if (outcome.status === 'success') {
          addLog(`${cap}: fetched ${outcome.count} project(s)`, 'info');
        } else if (outcome.status === 'platform_blocked') {
          addLog(`${cap}: blocked by platform — ${outcome.message || 'try connecting your account in Profile'}`, 'warn');
        } else if (outcome.status === 'empty') {
          addLog(`${cap}: online but returned 0 results for this query`, 'info');
        } else if (outcome.status === 'error') {
          addLog(`${cap}: error — ${outcome.message || 'unknown error'}`, 'error');
        }
      });

      const fetched: ScrapedProject[] = data.projects ?? [];
      if (Object.keys(outcomes).length === 0) {
        // Fallback if scraper doesn't return outcomes (cached response)
        addLog(`Fetched ${fetched.length} projects`, 'info');
      }

      const newMatches = fetched.filter(p => matchesConfig(p, config));
      addLog(
        `${newMatches.length} matched your criteria`,
        newMatches.length > 0 ? 'success' : 'info',
      );

      if (newMatches.length > 0) {
        // --- Update matched projects list (dedup) ---
        let dedupedCount = 0;
        setMatchedProjects(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const deduped = newMatches.filter(p => !existingIds.has(p.id));
          dedupedCount = deduped.length;
          return deduped.length > 0 ? [...deduped, ...prev] : prev;
        });

        // --- Auto-save matched projects (dedup + DB persist) ---
        setSavedProjects(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const toSave = newMatches.filter(p => !existingIds.has(p.id));

          // Persist each new project to DB (fire-and-forget, errors are non-fatal)
          toSave.forEach(p => {
            scraperApi.saveProject({
              id:           p.id,
              title:        p.title,
              description:  p.description,
              budget:       p.budget,
              skills:       p.skills,
              clientCountry: p.clientCountry,
              url:          p.url,
              platform:     p.platform,
            }).catch(() => { /* ignore save errors — localStorage already has it */ });
          });

          if (toSave.length > 0) {
            // Log outside state updater to avoid side-effect in pure function
            setTimeout(() => addLog(`Auto-saved ${toSave.length} project(s) to Saved`, 'success'), 0);
          }

          return toSave.length > 0 ? [...toSave, ...prev] : prev;
        });

        // Log dedup info after state update queued
        setTimeout(() => {
          if (dedupedCount < newMatches.length) {
            addLog(`${newMatches.length - dedupedCount} duplicate(s) skipped`, 'info');
          }
        }, 0);
      }

      setLastRun(fmt(new Date()));
    } catch (err: unknown) {
      // Only reach here if the scraper service itself is unreachable (connection refused)
      const isOffline =
        err instanceof Error &&
        (err.message.includes('503') || err.message.includes('Network') || err.message.includes('ECONNREFUSED'));
      if (isOffline) {
        addLog('Scraper service is offline — start it with: python api.py', 'error');
      } else {
        addLog(`Cycle error: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    } finally {
      setRunning(false);
    }
  }, [running, config, addLog]);

  // ── Scheduler ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      nextFireRef.current = null;
      setNextRunIn('—');
      return;
    }

    const ms = config.intervalMinutes * 60 * 1000;
    nextFireRef.current = Date.now() + ms;

    intervalRef.current = setInterval(() => {
      nextFireRef.current = Date.now() + ms;
      runCycle(false);
    }, ms);

    countdownRef.current = setInterval(() => {
      if (nextFireRef.current === null) return;
      const remaining = Math.max(0, nextFireRef.current - Date.now());
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setNextRunIn(`${m}:${String(s).padStart(2, '0')}`);
    }, 1000);

    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [enabled, config.intervalMinutes, runCycle]);

  // ── Config helpers ────────────────────────────────────────────────────────────

  function setField<K extends keyof AutomationConfig>(key: K, value: AutomationConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  function toggleStack(s: string) {
    setConfig(prev => ({
      ...prev,
      techStack: prev.techStack.includes(s)
        ? prev.techStack.filter(x => x !== s)
        : [...prev.techStack, s],
    }));
  }

  function handleToggleEnable() {
    if (!enabled && !config.query.trim()) {
      addLog('Set a search query before enabling automation', 'warn');
      return;
    }
    setEnabled(v => !v);
    if (!enabled) addLog('Automation enabled', 'success');
    else          addLog('Automation stopped', 'info');
  }

  function handleTest() {
    runCycle(true);
  }

  function saveProjectManual(p: ScrapedProject) {
    setSavedProjects(prev => {
      if (prev.some(x => x.id === p.id)) return prev;
      scraperApi.saveProject({
        id: p.id, title: p.title, description: p.description,
        budget: p.budget, skills: p.skills, clientCountry: p.clientCountry,
        url: p.url, platform: p.platform,
      }).catch(() => {});
      return [...prev, p];
    });
  }

  function unsaveProject(id: string) {
    setSavedProjects(prev => prev.filter(p => p.id !== id));
    scraperApi.deleteSaved(id).catch(() => {});
  }

  function goToAnalyze(p: ScrapedProject) {
    navigate('/ai-analyze', { state: { project: p } });
  }

  function clearMatched() {
    setMatchedProjects([]);
    setMatchedPage(1);
    addLog('Matched projects cleared', 'info');
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const withinWindow     = isWithinWindow(config.startTime, config.endTime);
  const totalMatchPages  = Math.max(1, Math.ceil(matchedProjects.length / AUTO_PAGE_SIZE));
  const safeMPage        = Math.min(matchedPage, totalMatchPages);
  const visibleMatched   = matchedProjects.slice((safeMPage - 1) * AUTO_PAGE_SIZE, safeMPage * AUTO_PAGE_SIZE);
  const stackSuggestions = stackSearch.trim().length === 0 ? [] :
    TECH_SKILLS
      .filter(s => s.toLowerCase().includes(stackSearch.toLowerCase()) && !config.techStack.includes(s))
      .slice(0, 8);

  const statusLabel = enabled
    ? running
      ? 'Running cycle...'
      : withinWindow
        ? `Active — next in ${nextRunIn}`
        : `Paused — outside window`
    : 'Stopped';

  const statusColor = enabled
    ? running
      ? 'text-primary'
      : withinWindow
        ? 'text-emerald-600'
        : 'text-amber-600'
    : 'text-slate-400';

  const statusDot = enabled
    ? running
      ? 'bg-primary animate-pulse'
      : withinWindow
        ? 'bg-emerald-500'
        : 'bg-amber-400'
    : 'bg-slate-300';

  // Active filter count badge
  const activeFilterCount = [
    config.maxProposals !== 'any',
    !!config.minClientRating,
    !!config.minClientReviews,
    !!config.minBudget,
    !!config.maxBudget,
    !!config.includeKeywords.trim(),
    !!config.excludeKeywords.trim(),
    config.identityVerified,
    config.paymentVerified,
    config.depositMade,
    config.profileCompleted,
  ].filter(Boolean).length;

  return (
    <div className="flex h-full overflow-hidden">
    <div className="flex-1 overflow-y-auto">
    <div className="p-6 max-w-6xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-dark flex items-center gap-2">
            <Bot size={22} className="text-primary" /> Automation
          </h1>
          <p className="text-slate-500 mt-0.5">
            Auto-fetch and save projects that match your criteria on a schedule
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status pill */}
          <span className={clsx('flex items-center gap-1.5 text-sm font-medium', statusColor)}>
            <span className={clsx('w-2 h-2 rounded-full inline-block', statusDot)} />
            {statusLabel}
          </span>

          {/* Saved panel toggle */}
          <button
            onClick={() => setShowSavedPanel(v => !v)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              showSavedPanel
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary',
            )}
          >
            <Bookmark size={11} />
            Saved {savedProjects.length > 0 && `(${savedProjects.length})`}
          </button>

          {/* Scraper status indicator */}
          <span className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            scraperOnline === true
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : scraperOnline === false
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-slate-50 border-slate-200 text-slate-400',
          )}>
            <Zap size={10} />
            {scraperOnline === true
              ? 'Scraper Online'
              : scraperOnline === false
                ? 'Scraper Offline'
                : 'Checking...'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,440px)_1fr] gap-6">

        {/* ── LEFT: Config ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Search query + platform */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-dark flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-primary" /> Search Configuration
            </h2>

            <div>
              <label className="label">Search Query</label>
              <input
                value={config.query}
                onChange={e => setField('query', e.target.value)}
                className="input"
                placeholder="e.g. React developer, Python scraper..."
              />
            </div>

            <div>
              <label className="label">Platform</label>
              <select
                value={config.platform}
                onChange={e => setField('platform', e.target.value as AutomationConfig['platform'])}
                className="input"
              >
                <option value="both">Both Platforms</option>
                <option value="upwork">Upwork Only</option>
                <option value="freelancer">Freelancer Only</option>
              </select>
            </div>
          </div>

          {/* Schedule */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-dark flex items-center gap-2">
              <Clock size={14} className="text-primary" /> Schedule
            </h2>

            <div>
              <label className="label">Run Interval</label>
              <div className="flex flex-wrap gap-2">
                {INTERVALS.map(iv => (
                  <button
                    key={iv.value}
                    type="button"
                    onClick={() => setField('intervalMinutes', iv.value)}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                      config.intervalMinutes === iv.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
                    )}
                  >
                    {iv.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Time</label>
                <input
                  type="time"
                  value={config.startTime}
                  onChange={e => setField('startTime', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">End Time</label>
                <input
                  type="time"
                  value={config.endTime}
                  onChange={e => setField('endTime', e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <p className={clsx(
              'text-xs flex items-center gap-1.5',
              withinWindow ? 'text-emerald-600' : 'text-slate-400',
            )}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', withinWindow ? 'bg-emerald-500' : 'bg-slate-300')} />
              {withinWindow
                ? `Within window (${config.startTime} – ${config.endTime})`
                : `Outside window — fetching paused until ${config.startTime}`}
            </p>
          </div>

          {/* Tech stack filter */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-dark flex items-center gap-2">
              <Link2 size={14} className="text-primary" /> Tech Stack Filter
              {config.techStack.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                  {config.techStack.length}
                </span>
              )}
            </h2>

            {config.techStack.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {config.techStack.map(s => (
                  <span key={s} className="badge badge-blue gap-1 text-xs">
                    {s}
                    <button onClick={() => toggleStack(s)} className="opacity-60 hover:opacity-100">
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <input
                value={stackSearch}
                onChange={e => setStackSearch(e.target.value)}
                className="input text-xs"
                placeholder="Search tech skills to add..."
              />
              {stackSuggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {stackSuggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { toggleStack(s); setStackSearch(''); }}
                      className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {config.techStack.length === 0 && (
              <p className="text-xs text-slate-400">No tech stack filter — all projects will match</p>
            )}
          </div>

          {/* Advanced filters — same fields as Project Search */}
          <div className="card p-5 space-y-3">
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-dark"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-primary" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                    {activeFilterCount} active
                  </span>
                )}
              </span>
              {showFilters
                ? <ChevronUp size={14} className="text-slate-400" />
                : <ChevronDown size={14} className="text-slate-400" />}
            </button>

            {showFilters && (
              <div className="space-y-4 pt-1">

                {/* Row 1: Max Proposals + Min Client Rating */}
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className="label text-[11px]">Max Proposals</label>
                    <select
                      value={config.maxProposals}
                      onChange={e => setField('maxProposals', e.target.value)}
                      className="input w-36 text-xs"
                    >
                      <option value="any">Any</option>
                      <option value="5">5 or fewer</option>
                      <option value="10">10 or fewer</option>
                      <option value="20">20 or fewer</option>
                      <option value="50">50 or fewer</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[11px]">Min Client Rating</label>
                    <select
                      value={config.minClientRating}
                      onChange={e => setField('minClientRating', e.target.value)}
                      className="input w-36 text-xs"
                    >
                      <option value="">Any</option>
                      <option value="3">3+ stars</option>
                      <option value="4">4+ stars</option>
                      <option value="4.5">4.5+ stars</option>
                      <option value="4.8">4.8+ stars</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[11px]">Min Client Reviews</label>
                    <select
                      value={config.minClientReviews}
                      onChange={e => setField('minClientReviews', e.target.value)}
                      className="input w-36 text-xs"
                    >
                      <option value="">Any</option>
                      <option value="1">1+</option>
                      <option value="3">3+</option>
                      <option value="5">5+</option>
                      <option value="10">10+</option>
                      <option value="25">25+</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Budget range */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-28">
                    <label className="label text-[11px]">Min Budget ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.minBudget}
                      onChange={e => setField('minBudget', e.target.value)}
                      className="input text-xs"
                      placeholder="e.g. 100"
                    />
                  </div>
                  <div className="flex-1 min-w-28">
                    <label className="label text-[11px]">Max Budget ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.maxBudget}
                      onChange={e => setField('maxBudget', e.target.value)}
                      className="input text-xs"
                      placeholder="e.g. 5000"
                    />
                  </div>
                </div>

                {/* Row 3: Include / Exclude keywords */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-48">
                    <label className="label text-[11px]">
                      Include Keywords <span className="text-slate-400">(comma-separated)</span>
                    </label>
                    <input
                      value={config.includeKeywords}
                      onChange={e => setField('includeKeywords', e.target.value)}
                      className="input text-xs"
                      placeholder="e.g. API, dashboard"
                    />
                  </div>
                  <div className="flex-1 min-w-48">
                    <label className="label text-[11px]">
                      Exclude Keywords <span className="text-slate-400">(comma-separated)</span>
                    </label>
                    <input
                      value={config.excludeKeywords}
                      onChange={e => setField('excludeKeywords', e.target.value)}
                      className="input text-xs"
                      placeholder="e.g. WordPress, Wix"
                    />
                  </div>
                </div>

                {/* Row 4: Client Verification checkboxes */}
                <div>
                  <label className="label text-[11px] mb-2">Client Verification</label>
                  <div className="flex flex-wrap gap-3">
                    {([
                      ['identityVerified', 'Identity Verified'],
                      ['paymentVerified',  'Payment Verified'],
                      ['depositMade',      'Deposit Made'],
                      ['profileCompleted', 'Profile Completed'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={config[key]}
                          onChange={e => setField(key, e.target.checked)}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-slate-600">{label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Verification flags are matched against project data when available.
                  </p>
                </div>

                {/* Clear filters */}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      maxProposals: 'any', minClientRating: '', minClientReviews: '',
                      minBudget: '', maxBudget: '',
                      includeKeywords: '', excludeKeywords: '',
                      identityVerified: false, paymentVerified: false,
                      depositMade: false, profileCompleted: false,
                    }))}
                    className="text-xs text-slate-400 hover:text-danger flex items-center gap-1"
                  >
                    <X size={11} /> Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="card p-5">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleToggleEnable}
                disabled={scraperOnline === false}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                  enabled
                    ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                    : 'btn-primary',
                  scraperOnline === false && 'opacity-50 cursor-not-allowed',
                )}
              >
                {enabled
                  ? <><Square size={14} /> Stop Automation</>
                  : <><Play size={14} /> Start Automation</>}
              </button>

              <button
                onClick={handleTest}
                disabled={running || scraperOnline === false}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                  'bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary',
                  (running || scraperOnline === false) && 'opacity-50 cursor-not-allowed',
                )}
                title="Run one cycle immediately (ignores time window)"
              >
                {running
                  ? <><RefreshCw size={12} className="animate-spin" /> Running...</>
                  : <><FlaskConical size={12} /> Test Now</>}
              </button>

              {scraperOnline === false && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={11} /> Start the scraper first
                </p>
              )}
            </div>

            {lastRun && (
              <p className="text-xs text-slate-400 mt-2.5">Last run: {lastRun}</p>
            )}
          </div>

          {/* Activity log */}
          {logs.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Activity Log
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {logs.map((l, i) => (
                  <p key={i} className={clsx(
                    'text-[11px] flex gap-2',
                    l.type === 'success' ? 'text-emerald-600'
                      : l.type === 'warn'    ? 'text-amber-600'
                      : l.type === 'error'   ? 'text-red-500'
                      : 'text-slate-500',
                  )}>
                    <span className="text-slate-300 flex-shrink-0">{l.ts}</span>
                    {l.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Matched Projects ───────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-dark flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Matched Projects
              {matchedProjects.length > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded text-[10px] font-medium">
                  {matchedProjects.length}
                </span>
              )}
            </h2>
            {matchedProjects.length > 0 && (
              <button
                onClick={clearMatched}
                className="text-xs text-slate-400 hover:text-danger flex items-center gap-1"
              >
                <X size={11} /> Clear all
              </button>
            )}
          </div>

          {/* Empty state */}
          {matchedProjects.length === 0 && (
            <div className="card p-12 text-center text-slate-400">
              <Bot size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-medium">No matches yet</p>
              <p className="text-xs text-slate-400 mt-1">
                {config.query
                  ? 'Click "Test Now" or "Start Automation" to fetch matching projects.'
                  : 'Set a search query, then test or start automation.'}
              </p>
            </div>
          )}

          {/* Project cards */}
          <div className="space-y-3">
            {visibleMatched.map(project => {
              const isSaved = savedProjects.some(p => p.id === project.id);
              return (
                <div key={project.id} className="card p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-dark text-sm leading-tight">{project.title}</h3>
                        <span className={clsx(
                          'badge text-[10px] capitalize',
                          project.platform === 'upwork' ? 'badge-success' : 'badge-blue',
                        )}>
                          {project.platform}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{project.description}</p>

                      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
                        {project.budget && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={11} className="text-success" />{project.budget}
                          </span>
                        )}
                        {project.clientCountry && (
                          <span className="flex items-center gap-1">
                            <Globe size={11} />{project.clientCountry}
                          </span>
                        )}
                        {project.proposalsCount != null && (
                          <span className="flex items-center gap-1">
                            <Users size={11} />{project.proposalsCount} proposals
                          </span>
                        )}
                        {project.clientRating != null && (
                          <span className="flex items-center gap-1 text-amber-500">
                            <Star size={10} className="fill-amber-400" />
                            {project.clientRating.toFixed(1)}
                          </span>
                        )}
                        {project.clientReviewCount != null && (
                          <span className="flex items-center gap-1 text-slate-400">
                            {project.clientReviewCount} reviews
                          </span>
                        )}
                      </div>

                      {/* Verification badges */}
                      {(project.identityVerified || project.paymentVerified || project.profileCompleted) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {project.identityVerified && (
                            <span className="badge badge-success text-[10px]">ID Verified</span>
                          )}
                          {project.paymentVerified && (
                            <span className="badge badge-success text-[10px]">Payment Verified</span>
                          )}
                          {project.profileCompleted && (
                            <span className="badge badge-success text-[10px]">Profile Complete</span>
                          )}
                        </div>
                      )}

                      {project.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {project.skills.slice(0, 6).map(s => (
                            <span key={s} className="badge badge-gray text-[10px]">{s}</span>
                          ))}
                          {project.skills.length > 6 && (
                            <span className="badge badge-gray text-[10px]">+{project.skills.length - 6}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 justify-center"
                      >
                        <ExternalLink size={11} /> View
                      </a>
                      <button
                        onClick={() => goToAnalyze(project)}
                        className="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1 justify-center"
                      >
                        <Brain size={11} /> Analyze
                      </button>
                      <button
                        onClick={() => isSaved ? unsaveProject(project.id) : saveProjectManual(project)}
                        className={clsx(
                          'text-xs px-2.5 py-1.5 rounded border flex items-center gap-1 justify-center transition-colors',
                          isSaved
                            ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600',
                        )}
                      >
                        {isSaved
                          ? <><BookmarkCheck size={11} /> Saved</>
                          : <><Bookmark size={11} /> Save</>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {matchedProjects.length > AUTO_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => setMatchedPage(p => Math.max(1, p - 1))}
                disabled={safeMPage <= 1}
                className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-xs text-slate-500">
                Page {safeMPage} of {totalMatchPages}
              </span>
              <button
                type="button"
                onClick={() => setMatchedPage(p => Math.min(totalMatchPages, p + 1))}
                disabled={safeMPage >= totalMatchPages}
                className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>

    {/* ── Saved Projects Panel (slide-in from right) ─────────────────────────── */}
    {showSavedPanel && (
      <div className="w-72 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-dark flex items-center gap-1.5">
            <BookmarkCheck size={14} className="text-primary" />
            Saved Projects ({savedProjects.length})
          </p>
          <button onClick={() => setShowSavedPanel(false)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {savedProjects.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs mt-4">
              <Bookmark size={24} className="mx-auto mb-2 text-slate-200" />
              No saved projects yet
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {savedProjects.map(p => (
                <div key={p.id} className="p-3 hover:bg-slate-50">
                  <p className="text-xs font-medium text-dark line-clamp-2 leading-tight mb-1">{p.title}</p>
                  <p className="text-[10px] text-slate-400 mb-2">
                    {p.budget ? `${p.budget} · ` : ''}{p.platform}
                  </p>
                  <div className="flex items-center gap-1">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => goToAnalyze(p)}
                      className="text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-colors"
                      title="AI Analysis"
                    >
                      <Brain size={10} />
                    </button>
                    <button
                      onClick={() => unsaveProject(p.id)}
                      className="text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
