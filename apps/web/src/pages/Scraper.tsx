import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  Search, ExternalLink, Globe, DollarSign, Users,
  AlertCircle, CheckCircle2, Brain, RefreshCw, Clock,
  Link2, ChevronDown, ChevronUp, SlidersHorizontal, X,
  Bookmark, BookmarkCheck, CheckSquare, RotateCcw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { scraperApi, aiApi, connectionsApi } from '../lib/api';
import { ScraperQuerySchema, type ScraperQueryInput, TECH_SKILLS } from '@freelancer-os/shared';
import type { ScrapedProject } from '@freelancer-os/shared';
import clsx from 'clsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'default' | 'budget_asc' | 'budget_desc' | 'proposals_asc';

interface Filters {
  platform: string;
  maxProposals: string;
  minClientRating: string;
  includeKeywords: string;
  excludeKeywords: string;
  identityVerified: boolean;
  paymentVerified: boolean;
  depositMade: boolean;
  profileCompleted: boolean;
}

const DEFAULT_FILTERS: Filters = {
  platform: 'all',
  maxProposals: 'any',
  minClientRating: '',
  includeKeywords: '',
  excludeKeywords: '',
  identityVerified: false,
  paymentVerified: false,
  depositMade: false,
  profileCompleted: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBudgetMin(budget: string): number {
  const match = budget.match(/\$?([\d,]+)/);
  return match ? parseInt(match[1].replace(',', ''), 10) : 0;
}

function applySort(projects: ScrapedProject[], sort: SortKey): ScrapedProject[] {
  if (sort === 'default') return projects;
  return [...projects].sort((a, b) => {
    if (sort === 'budget_asc')    return parseBudgetMin(a.budget) - parseBudgetMin(b.budget);
    if (sort === 'budget_desc')   return parseBudgetMin(b.budget) - parseBudgetMin(a.budget);
    if (sort === 'proposals_asc') return (a.proposalsCount ?? 999) - (b.proposalsCount ?? 999);
    return 0;
  });
}

function applyFilters(projects: ScrapedProject[], filters: Filters): ScrapedProject[] {
  return projects.filter((p) => {
    if (filters.platform !== 'all' && p.platform !== filters.platform) return false;

    if (filters.maxProposals !== 'any') {
      const max = parseInt(filters.maxProposals, 10);
      if ((p.proposalsCount ?? 999) > max) return false;
    }

    if (filters.minClientRating) {
      const min = parseFloat(filters.minClientRating);
      if ((p.clientRating ?? 0) < min) return false;
    }

    if (filters.includeKeywords.trim()) {
      const kws = filters.includeKeywords.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
      const text = (p.title + ' ' + p.description).toLowerCase();
      if (!kws.every(k => text.includes(k))) return false;
    }

    if (filters.excludeKeywords.trim()) {
      const kws = filters.excludeKeywords.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
      const text = (p.title + ' ' + p.description).toLowerCase();
      if (kws.some(k => text.includes(k))) return false;
    }

    return true;
  });
}

function hasActiveFilters(f: Filters): boolean {
  return (
    f.platform !== 'all' ||
    f.maxProposals !== 'any' ||
    !!f.minClientRating ||
    !!f.includeKeywords.trim() ||
    !!f.excludeKeywords.trim() ||
    f.identityVerified || f.paymentVerified || f.depositMade || f.profileCompleted
  );
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Scraper() {
  const navigate = useNavigate();

  // Results & search state
  const [allResults,   setAllResults]   = useState<ScrapedProject[]>([]);
  const [page,         setPage]         = useState(1);
  const [lastSearch,   setLastSearch]   = useState<ScraperQueryInput | null>(null);
  const [analyzingId,  setAnalyzingId]  = useState<string | null>(null);
  const [analysisMap,  setAnalysisMap]  = useState<Record<string, {
    techFitScore: number; effortLevel: string; winningAngle: string;
    bidRange: { min: number; max: number };
  }>>({});

  // Sort / filter
  const [showFilters, setShowFilters] = useState(false);
  const [sort,        setSort]        = useState<SortKey>('default');
  const [filters,     setFilters]     = useState<Filters>(DEFAULT_FILTERS);

  // Saved projects (persisted to localStorage)
  const [savedProjects, setSavedProjects] = useState<ScrapedProject[]>(() =>
    loadFromStorage<ScrapedProject[]>('fos_savedProjects', []),
  );
  const [biddedIds, setBiddedIds] = useState<Set<string>>(() =>
    new Set(loadFromStorage<string[]>('fos_biddedIds', [])),
  );
  const [showSavedPanel, setShowSavedPanel] = useState(false);

  // Persist saved/bid state whenever they change
  useEffect(() => {
    localStorage.setItem('fos_savedProjects', JSON.stringify(savedProjects));
  }, [savedProjects]);

  useEffect(() => {
    localStorage.setItem('fos_biddedIds', JSON.stringify([...biddedIds]));
  }, [biddedIds]);

  // Scraper health
  const { data: statusData } = useQuery({
    queryKey: ['scraper-status'],
    queryFn: scraperApi.status,
    refetchInterval: 30000,
  });

  // Platform connection status
  const { data: connectionStatus } = useQuery({
    queryKey: ['platform-connections-status'],
    queryFn: connectionsApi.status,
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ScraperQueryInput>({
    resolver: zodResolver(ScraperQuerySchema),
    defaultValues: { platform: 'both', limit: 30 },
  });

  const queryValue           = watch('query') ?? '';
  const normalizedQuery      = queryValue.trim().toLowerCase();
  const filteredSuggestions  = normalizedQuery.length === 0 ? [] :
    TECH_SKILLS
      .filter(s => s.toLowerCase().includes(normalizedQuery) && s.toLowerCase() !== normalizedQuery)
      .slice(0, 8);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Per-platform outcome info from the last scrape
  type PlatformOutcome = { status: string; count: number; message: string };
  const [platformOutcomes, setPlatformOutcomes] = useState<Record<string, PlatformOutcome>>({});

  const searchMutation = useMutation({
    mutationFn: scraperApi.search,
    onSuccess: (data) => {
      setAllResults(data.projects ?? []);
      setPlatformOutcomes(data.platformOutcomes ?? {});
      setPage(1);
    },
  });

  function onSubmit(data: ScraperQueryInput) {
    const payload = {
      ...data,
      // Pass server-side filter flags to scraper if supported
      identityVerified: filters.identityVerified || undefined,
      paymentVerified:  filters.paymentVerified  || undefined,
      depositMade:      filters.depositMade      || undefined,
      profileCompleted: filters.profileCompleted || undefined,
    };
    setLastSearch(payload as ScraperQueryInput);
    searchMutation.mutate(payload as ScraperQueryInput);
  }

  async function handleRefresh() {
    if (!lastSearch || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const data = await scraperApi.search(lastSearch);
      const incoming: ScrapedProject[] = data.projects ?? [];
      setPlatformOutcomes(data.platformOutcomes ?? {});
      setAllResults(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newOnes = incoming.filter(p => !existingIds.has(p.id));
        return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
      });
    } catch { /* ignore */ }
    finally { setIsRefreshing(false); }
  }

  async function analyzeProject(project: ScrapedProject) {
    setAnalyzingId(project.id);
    try {
      const result = await aiApi.analyze({
        projectTitle:       project.title,
        projectDescription: project.description,
        clientCountry:      project.clientCountry,
      });
      setAnalysisMap(prev => ({ ...prev, [project.id]: result }));
    } catch { /* ignore */ }
    finally { setAnalyzingId(null); }
  }

  function goToAIAnalyze(project: ScrapedProject) {
    navigate('/ai-analyze', { state: { project } });
  }

  function saveProject(project: ScrapedProject) {
    setSavedProjects(prev =>
      prev.some(p => p.id === project.id) ? prev : [...prev, project],
    );
  }

  function unsaveProject(id: string) {
    setSavedProjects(prev => prev.filter(p => p.id !== id));
  }

  function markBidded(project: ScrapedProject) {
    setBiddedIds(prev => new Set([...prev, project.id]));
    unsaveProject(project.id);
  }

  const isOnline = statusData?.status === 'online';

  // Processed results: exclude bidded, apply sort + filters, then paginate
  const withoutBidded = allResults.filter(p => !biddedIds.has(p.id));
  const processed     = applyFilters(applySort(withoutBidded, sort), filters);
  const totalPages    = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage      = Math.min(page, totalPages);
  const visible       = processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeFilters = hasActiveFilters(filters);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-dark flex items-center gap-2">
                <Search size={22} className="text-primary" /> Find Projects
              </h1>
              <p className="text-slate-500 mt-0.5">Search live freelance projects from Upwork &amp; Freelancer.com</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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

              {/* Platform pills */}
              {(['upwork', 'freelancer'] as const).map(p => {
                const connected = connectionStatus?.[p];
                return (
                  <span key={p} className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                    connected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400',
                  )}>
                    <Link2 size={10} />
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                    {connected ? ' ✓' : ' —'}
                  </span>
                );
              })}

              {/* Scraper status */}
              <span className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                isOnline
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700',
              )}>
                {isOnline
                  ? <><CheckCircle2 size={11} /> Scraper Online</>
                  : <><AlertCircle size={11} /> Scraper Offline</>}
              </span>
            </div>
          </div>

          {/* Offline warning */}
          {!isOnline && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-medium">Scraper service not running</p>
              <p className="text-xs text-amber-700 mt-1">
                Start it with: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">cd apps/scraper &amp;&amp; python api.py</code>
              </p>
            </div>
          )}

          {/* Per-platform outcome warnings (shown after a search) */}
          {Object.entries(platformOutcomes).some(([, o]) => o.status === 'platform_blocked') && (
            <div className="mb-4 space-y-2">
              {platformOutcomes.upwork?.status === 'platform_blocked' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">Upwork: Automated search blocked</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Upwork is blocking HTTP scraping for this query. Connect your Upwork account in{' '}
                      <a href="/profile" className="underline font-medium">Profile</a>{' '}
                      to enable authenticated search, or try the RSS feed by searching again.
                    </p>
                  </div>
                </div>
              )}
              {platformOutcomes.freelancer?.status === 'platform_blocked' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">Freelancer: API temporarily unavailable</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {platformOutcomes.freelancer.message || 'Freelancer.com API returned an error. Try again in a moment.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search form */}
          <div className="card p-5 mb-4">
            <form onSubmit={handleSubmit(onSubmit)} className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-48">
                <input
                  {...register('query')}
                  className="input"
                  placeholder="e.g. React developer, WordPress, Python scraper..."
                />
                {filteredSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {filteredSuggestions.map(s => (
                      <button
                        key={s} type="button"
                        onClick={() => setValue('query', s, { shouldDirty: true, shouldValidate: true })}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {errors.query && <p className="mt-1 text-xs text-danger">{errors.query.message}</p>}
              </div>

              <select {...register('platform')} className="input w-40">
                <option value="both">Both Platforms</option>
                <option value="upwork">Upwork Only</option>
                <option value="freelancer">Freelancer Only</option>
              </select>

              <button type="submit" disabled={searchMutation.isPending || !isOnline} className="btn-primary">
                {searchMutation.isPending
                  ? <><RefreshCw size={14} className="animate-spin" /> Searching...</>
                  : <><Search size={14} /> Search</>}
              </button>
            </form>
          </div>

          {/* Sort / filter / refresh bar */}
          {allResults.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <p className="text-sm text-slate-500 mr-auto">
                {processed.length} of {allResults.length} projects
                {biddedIds.size > 0 && <span className="ml-1 text-slate-400">({biddedIds.size} hidden)</span>}
              </p>

              {/* Refresh */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing || !lastSearch}
                className="btn-secondary text-xs px-3 flex items-center gap-1"
                title="Fetch new projects (deduplicates existing)"
              >
                <RotateCcw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                Refresh
              </button>

              {/* Sort */}
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="input w-44 text-xs"
              >
                <option value="default">Sort: Default</option>
                <option value="budget_desc">Budget: High → Low</option>
                <option value="budget_asc">Budget: Low → High</option>
                <option value="proposals_asc">Fewest Proposals</option>
              </select>

              {/* Filter toggle */}
              <button
                type="button"
                onClick={() => setShowFilters(v => !v)}
                className={clsx(
                  'btn-secondary text-xs px-3',
                  showFilters && 'bg-primary/5 border-primary/30 text-primary',
                )}
              >
                <SlidersHorizontal size={12} /> Filters
                {activeFilters && <span className="ml-1 w-1.5 h-1.5 bg-primary rounded-full inline-block" />}
              </button>

              {activeFilters && (
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-xs text-slate-400 hover:text-danger flex items-center gap-1"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          )}

          {/* Filter panel */}
          {showFilters && allResults.length > 0 && (
            <div className="card p-4 mb-4 space-y-4">
              {/* Row 1: Platform + Max Proposals + Client Rating */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="label text-[11px]">Platform</label>
                  <select
                    value={filters.platform}
                    onChange={e => setFilters(f => ({ ...f, platform: e.target.value }))}
                    className="input w-36 text-xs"
                  >
                    <option value="all">All</option>
                    <option value="upwork">Upwork</option>
                    <option value="freelancer">Freelancer</option>
                  </select>
                </div>
                <div>
                  <label className="label text-[11px]">Max Proposals</label>
                  <select
                    value={filters.maxProposals}
                    onChange={e => setFilters(f => ({ ...f, maxProposals: e.target.value }))}
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
                    value={filters.minClientRating}
                    onChange={e => setFilters(f => ({ ...f, minClientRating: e.target.value }))}
                    className="input w-36 text-xs"
                  >
                    <option value="">Any</option>
                    <option value="3">3+ stars</option>
                    <option value="4">4+ stars</option>
                    <option value="4.5">4.5+ stars</option>
                    <option value="4.8">4.8+ stars</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Include / Exclude keywords */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-48">
                  <label className="label text-[11px]">Include Keywords <span className="text-slate-400">(comma-separated)</span></label>
                  <input
                    value={filters.includeKeywords}
                    onChange={e => setFilters(f => ({ ...f, includeKeywords: e.target.value }))}
                    className="input text-xs"
                    placeholder="e.g. React, TypeScript"
                  />
                </div>
                <div className="flex-1 min-w-48">
                  <label className="label text-[11px]">Exclude Keywords <span className="text-slate-400">(comma-separated)</span></label>
                  <input
                    value={filters.excludeKeywords}
                    onChange={e => setFilters(f => ({ ...f, excludeKeywords: e.target.value }))}
                    className="input text-xs"
                    placeholder="e.g. WordPress, Wix"
                  />
                </div>
              </div>

              {/* Row 3: Client verification checkboxes */}
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
                        checked={filters[key]}
                        onChange={e => setFilters(f => ({ ...f, [key]: e.target.checked }))}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs text-slate-600">{label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">These flags are sent to the scraper — results depend on platform data availability.</p>
              </div>
            </div>
          )}

          {/* Error state — scraper itself is down (connection refused) */}
          {searchMutation.isError && (
            <div className="card p-5 text-center text-danger mb-4">
              <AlertCircle size={24} className="mx-auto mb-2" />
              <p className="text-sm font-medium">Scraper service is offline</p>
              <p className="text-xs text-slate-500 mt-1">
                Start it with:{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">cd apps/scraper &amp;&amp; python api.py</code>
              </p>
            </div>
          )}

          {/* Results */}
          {visible.length > 0 && (
            <div className="space-y-3">
              {visible.map(project => {
                const analysis    = analysisMap[project.id];
                const isAnalyzing = analyzingId === project.id;
                const isSaved     = savedProjects.some(p => p.id === project.id);

                return (
                  <div key={project.id} className="card p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-dark text-sm">{project.title}</h3>
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
                          {project.proposalsCount !== null && project.proposalsCount !== undefined && (
                            <span className="flex items-center gap-1">
                              <Users size={11} />{project.proposalsCount} proposals
                            </span>
                          )}
                          {project.clientRating !== null && project.clientRating !== undefined && (
                            <span className="flex items-center gap-1 text-amber-500">
                              ★ {project.clientRating.toFixed(1)}
                            </span>
                          )}
                          {project.postedAt && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} />{project.postedAt}
                            </span>
                          )}
                        </div>

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

                        {analysis && (
                          <div className="mt-3 bg-primary/5 border border-primary/15 rounded-lg p-3 text-xs">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1 font-medium text-primary">
                                <Brain size={11} /> AI Analysis
                              </span>
                              <span className={clsx(
                                'font-semibold',
                                analysis.techFitScore >= 70 ? 'text-success' : analysis.techFitScore >= 40 ? 'text-warning' : 'text-danger',
                              )}>
                                Fit: {analysis.techFitScore}/100
                              </span>
                              <span className="text-slate-600">Bid: ${analysis.bidRange.min}–${analysis.bidRange.max}</span>
                              <span className="badge badge-gray capitalize">{analysis.effortLevel} effort</span>
                            </div>
                            <p className="text-slate-600 mt-1.5">{analysis.winningAngle}</p>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {/* View */}
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 justify-center"
                        >
                          <ExternalLink size={11} /> View
                        </a>

                        {/* AI Analysis → navigate to AI Analyze page */}
                        <button
                          onClick={() => goToAIAnalyze(project)}
                          className="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1 justify-center"
                          title="Open in AI Analyze"
                        >
                          <Brain size={11} /> Analyze
                        </button>

                        {/* Quick inline AI analysis */}
                        <button
                          onClick={() => analyzeProject(project)}
                          disabled={isAnalyzing || !!analysis}
                          className={clsx(
                            'text-xs px-2.5 py-1.5 rounded border flex items-center gap-1 justify-center transition-colors',
                            analysis
                              ? 'bg-success/10 text-success border-success/20 cursor-default'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary',
                          )}
                          title={analysis ? 'Already analyzed' : 'Quick inline analysis'}
                        >
                          {isAnalyzing
                            ? <RefreshCw size={11} className="animate-spin" />
                            : analysis
                              ? <><CheckCircle2 size={11} /> Done</>
                              : <><RefreshCw size={11} /> Quick</>}
                        </button>

                        {/* Save */}
                        <button
                          onClick={() => isSaved ? unsaveProject(project.id) : saveProject(project)}
                          className={clsx(
                            'text-xs px-2.5 py-1.5 rounded border flex items-center gap-1 justify-center transition-colors',
                            isSaved
                              ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600',
                          )}
                          title={isSaved ? 'Unsave' : 'Save project'}
                        >
                          {isSaved
                            ? <><BookmarkCheck size={11} /> Saved</>
                            : <><Bookmark size={11} /> Save</>}
                        </button>

                        {/* Already Bid — hides from all future results */}
                        <button
                          onClick={() => markBidded(project)}
                          className="text-xs px-2.5 py-1.5 rounded border bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 flex items-center gap-1 justify-center transition-colors"
                          title="Mark as bid — hides this project"
                        >
                          <CheckSquare size={11} /> Bid
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {processed.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
                .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                  if (idx > 0 && (n as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...'
                    ? <span key={`ellipsis-${idx}`} className="text-xs text-slate-400 px-1">…</span>
                    : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item as number)}
                        className={clsx(
                          'text-xs w-8 h-8 rounded border transition-colors',
                          item === safePage
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40',
                        )}
                      >
                        {item}
                      </button>
                    ),
                )}

              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40"
              >
                <ChevronRight size={13} />
              </button>

              <span className="text-xs text-slate-400 ml-1">
                Page {safePage} of {totalPages}
              </span>
            </div>
          )}

          {/* Empty state */}
          {!searchMutation.isPending && allResults.length === 0 && !searchMutation.isError && (
            <div className="card p-12 text-center text-slate-400">
              <Search size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-medium">Search for projects to see results here</p>
              {(!connectionStatus?.upwork || !connectionStatus?.freelancer) && (
                <p className="text-xs text-slate-400 mt-2">
                  Connect your accounts in{' '}
                  <a href="/profile" className="text-primary underline">Profile</a>{' '}
                  for authenticated search results.
                </p>
              )}
            </div>
          )}

          {/* No results after filter */}
          {!searchMutation.isPending && allResults.length > 0 && processed.length === 0 && (
            <div className="card p-8 text-center text-slate-400">
              <SlidersHorizontal size={24} className="mx-auto mb-2 text-slate-200" />
              <p className="text-sm">No projects match the current filters.</p>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-3 text-xs text-primary underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Bidded projects info */}
          {biddedIds.size > 0 && (
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5">
              <span>{biddedIds.size} project{biddedIds.size !== 1 ? 's' : ''} hidden (already bid)</span>
              <button
                onClick={() => setBiddedIds(new Set())}
                className="text-primary hover:underline flex items-center gap-1"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Saved Projects Panel (right) ──────────────────────────────────── */}
      {showSavedPanel && (
        <div className="w-64 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-dark flex items-center gap-1.5">
              <BookmarkCheck size={14} className="text-primary" />
              Saved ({savedProjects.length})
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
                  <div key={p.id} className="p-3 hover:bg-slate-50 group">
                    <p className="text-xs font-medium text-dark line-clamp-2 leading-tight mb-1">{p.title}</p>
                    <p className="text-[10px] text-slate-400 mb-2">{p.budget} · {p.platform}</p>
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
                        onClick={() => goToAIAnalyze(p)}
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
