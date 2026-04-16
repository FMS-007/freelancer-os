import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'react-router-dom';
import {
  Brain, Sparkles, AlertTriangle, TrendingUp, Clock,
  Target, DollarSign, ChevronDown, ChevronUp, RefreshCw,
  ExternalLink, Star, FileText, Copy, CheckCheck, Globe, Users,
  ShieldCheck, CreditCard, UserCheck, BadgeCheck,
} from 'lucide-react';
import { aiApi } from '../lib/api';
import { AnalyzeProjectSchema, type AnalyzeProjectInput, POPULAR_COUNTRIES, PROPOSAL_STRATEGIES } from '@freelancer-os/shared';
import type { ScrapedProject } from '@freelancer-os/shared';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';

interface AnalysisResult {
  id?: string;
  recommendedStructure: string[];
  biddingStrategy: 'fixed' | 'hourly' | 'milestone';
  effortLevel: 'low' | 'medium' | 'high';
  hoursEstimate: number;
  techFitScore: number;
  matchedSkills: string[];
  bidRange: { min: number; max: number; currency: string };
  redFlags: string[];
  winningAngle: string;
}

const EFFORT_CLASSES = {
  low:    'badge-success',
  medium: 'badge-warning',
  high:   'badge-danger',
};

const STRATEGY_CLASSES = {
  fixed:     'badge-blue',
  hourly:    'badge-blue',
  milestone: 'badge-blue',
};

export default function AIAnalyze() {
  const location = useLocation();
  const prefill  = (location.state as { project?: ScrapedProject } | null)?.project;

  const [result,           setResult]           = useState<AnalysisResult | null>(null);
  const [expandedId,       setExpandedId]       = useState<string | null>(null);
  const [proposalStrategy, setProposalStrategy] = useState(PROPOSAL_STRATEGIES[0]);
  const [proposal,         setProposal]         = useState<string | null>(null);
  const [copied,           setCopied]           = useState(false);

  const { data: pastAnalyses = [] } = useQuery({
    queryKey: ['ai-analyses'],
    queryFn:  aiApi.getAnalyses,
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<AnalyzeProjectInput>({
    resolver: zodResolver(AnalyzeProjectSchema),
  });

  const watchedTitle       = watch('projectTitle')       ?? '';
  const watchedDescription = watch('projectDescription') ?? '';

  // Pre-fill form when navigated from Project Search or Automation
  useEffect(() => {
    if (prefill) {
      setValue('projectTitle',       prefill.title);
      setValue('projectDescription', prefill.description);
      if (prefill.clientCountry) setValue('clientCountry', prefill.clientCountry);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const analyzeMutation = useMutation({
    mutationFn: aiApi.analyze,
    onSuccess:  (data) => { setResult(data); setProposal(null); },
  });

  const proposalMutation = useMutation({
    mutationFn: aiApi.generateProposal,
    onSuccess:  (data) => setProposal(data.proposal ?? data),
  });

  function onSubmit(data: AnalyzeProjectInput) {
    setResult(null);
    setProposal(null);
    analyzeMutation.mutate(data);
  }

  function handleGenerateProposal() {
    if (!result) return;
    proposalMutation.mutate({
      projectTitle:       watchedTitle,
      projectDescription: watchedDescription,
      analysisId:         result.id,
      strategy:           proposalStrategy,
    });
  }

  async function copyProposal() {
    if (!proposal) return;
    await navigator.clipboard.writeText(proposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Verification flags available from prefill
  const hasVerificationData = prefill && (
    prefill.identityVerified != null ||
    prefill.paymentVerified  != null ||
    prefill.profileCompleted != null ||
    prefill.depositMade      != null
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark flex items-center gap-2">
          <Brain size={24} className="text-primary" /> AI Project Analysis
        </h1>
        <p className="text-slate-500 mt-0.5">Paste any project listing and get an instant bid strategy + proposal</p>
      </div>

      {/* Project info strip — shown when navigated from Project Search / Automation */}
      {prefill && (
        <div className="mb-5 card p-4 bg-primary/3 border border-primary/15">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">
                Project from {prefill.platform === 'upwork' ? 'Upwork' : 'Freelancer.com'}
              </p>
              <p className="text-sm font-semibold text-dark mb-2">{prefill.title}</p>

              {/* Meta row */}
              <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 mb-2">
                {prefill.budget && (
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <DollarSign size={11} className="text-success" />{prefill.budget}
                  </span>
                )}
                {prefill.clientCountry && (
                  <span className="flex items-center gap-1">
                    <Globe size={11} />{prefill.clientCountry}
                  </span>
                )}
                {prefill.clientRating != null && (
                  <span className="flex items-center gap-0.5 text-amber-500">
                    <Star size={10} className="fill-amber-400" />
                    {prefill.clientRating.toFixed(1)} rating
                  </span>
                )}
                {prefill.clientReviewCount != null && (
                  <span className="flex items-center gap-1 text-slate-500">
                    {prefill.clientReviewCount} client review{prefill.clientReviewCount !== 1 ? 's' : ''}
                  </span>
                )}
                {prefill.proposalsCount != null && (
                  <span className="flex items-center gap-1">
                    <Users size={11} />{prefill.proposalsCount} proposals
                  </span>
                )}
                {prefill.postedAt && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} />{prefill.postedAt}
                  </span>
                )}
              </div>

              {/* Verification badges */}
              {hasVerificationData && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {prefill.identityVerified === true && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                      <ShieldCheck size={9} /> Identity Verified
                    </span>
                  )}
                  {prefill.paymentVerified === true && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                      <CreditCard size={9} /> Payment Verified
                    </span>
                  )}
                  {prefill.profileCompleted === true && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                      <UserCheck size={9} /> Profile Complete
                    </span>
                  )}
                  {prefill.depositMade === true && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                      <BadgeCheck size={9} /> Deposit Made
                    </span>
                  )}
                  {prefill.identityVerified === false && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-400 font-medium">
                      Identity Not Verified
                    </span>
                  )}
                  {prefill.paymentVerified === false && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-400 font-medium">
                      Payment Not Verified
                    </span>
                  )}
                </div>
              )}

              {/* Skills */}
              {prefill.skills && prefill.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {prefill.skills.slice(0, 8).map(s => (
                    <span key={s} className="badge badge-gray text-[10px]">{s}</span>
                  ))}
                  {prefill.skills.length > 8 && (
                    <span className="badge badge-gray text-[10px]">+{prefill.skills.length - 8}</span>
                  )}
                </div>
              )}
            </div>

            {/* Project link */}
            {prefill.url && (
              <a
                href={prefill.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 flex-shrink-0"
              >
                <ExternalLink size={11} /> View Project
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-4">Analyze Project</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Project Title</label>
              <input
                {...register('projectTitle')}
                className="input"
                placeholder="e.g. Build React Dashboard with Charts"
              />
              {errors.projectTitle && (
                <p className="mt-1 text-xs text-danger">{errors.projectTitle.message}</p>
              )}
            </div>

            <div>
              <label className="label">Project Description</label>
              <textarea
                {...register('projectDescription')}
                rows={8}
                className="input resize-none"
                placeholder="Paste the full project description from Upwork / Freelancer..."
              />
              {errors.projectDescription && (
                <p className="mt-1 text-xs text-danger">{errors.projectDescription.message}</p>
              )}
            </div>

            <div>
              <label className="label">
                Client Country <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select {...register('clientCountry')} className="input">
                <option value="">— Unknown —</option>
                {POPULAR_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Show budget from prefill as read-only info if available */}
            {prefill?.budget && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                  Project Budget
                </p>
                <p className="text-sm font-semibold text-dark flex items-center gap-1">
                  <DollarSign size={13} className="text-success" /> {prefill.budget}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={analyzeMutation.isPending}
              className="btn-primary w-full justify-center"
            >
              {analyzeMutation.isPending ? (
                <><RefreshCw size={14} className="animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles size={14} /> Analyze Project</>
              )}
            </button>

            {analyzeMutation.isError && (
              <p className="text-xs text-danger text-center">
                Analysis failed. Make sure your profile has skills set in Profile settings.
              </p>
            )}
          </form>
        </div>

        {/* ── Result ───────────────────────────────────────────────────────── */}
        <div>
          {analyzeMutation.isPending && (
            <div className="card p-8 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw size={28} className="animate-spin text-primary" />
              <p className="text-sm">AI is analyzing the project...</p>
            </div>
          )}

          {result && !analyzeMutation.isPending && (
            <div className="card p-5 space-y-5">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold text-dark">Analysis Result</h2>
                <div className="flex gap-2">
                  <span className={clsx('badge', STRATEGY_CLASSES[result.biddingStrategy])}>
                    {result.biddingStrategy} price
                  </span>
                  <span className={clsx('badge', EFFORT_CLASSES[result.effortLevel])}>
                    {result.effortLevel} effort
                  </span>
                </div>
              </div>

              {/* Tech Fit Score */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-dark flex items-center gap-1.5">
                    <Target size={14} className="text-primary" /> Tech Fit Score
                  </span>
                  <span className={clsx(
                    'text-sm font-bold',
                    result.techFitScore >= 70 ? 'text-success'
                      : result.techFitScore >= 40 ? 'text-warning'
                      : 'text-danger',
                  )}>
                    {result.techFitScore}/100
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      result.techFitScore >= 70 ? 'bg-success'
                        : result.techFitScore >= 40 ? 'bg-warning'
                        : 'bg-danger',
                    )}
                    style={{ width: `${result.techFitScore}%` }}
                  />
                </div>
                {result.matchedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.matchedSkills.map((s) => (
                      <span key={s} className="badge badge-success text-xs">{s}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bid Range & Effort */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign size={13} className="text-primary" />
                    <span className="text-xs font-medium text-slate-600">Bid Range</span>
                  </div>
                  <p className="font-bold text-dark">
                    ${result.bidRange.min} – ${result.bidRange.max}
                  </p>
                  <p className="text-xs text-slate-400">{result.bidRange.currency}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock size={13} className="text-primary" />
                    <span className="text-xs font-medium text-slate-600">Estimated Hours</span>
                  </div>
                  <p className="font-bold text-dark">{result.hoursEstimate}h</p>
                  <p className="text-xs text-slate-400">{result.effortLevel} effort</p>
                </div>
              </div>

              {/* Winning Angle */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp size={13} className="text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Winning Angle
                  </span>
                </div>
                <p className="text-sm text-dark">{result.winningAngle}</p>
              </div>

              {/* Red Flags */}
              {result.redFlags.length > 0 && (
                <div className="bg-danger/5 border border-danger/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={13} className="text-danger" />
                    <span className="text-xs font-semibold text-danger uppercase tracking-wide">
                      Red Flags
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {result.redFlags.map((f, i) => (
                      <li key={i} className="text-sm text-dark flex items-start gap-2">
                        <span className="text-danger mt-0.5">•</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Structure */}
              {result.recommendedStructure.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Recommended Structure
                  </p>
                  <ol className="space-y-1">
                    {result.recommendedStructure.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-dark">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold flex-shrink-0">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* ── Generate Proposal (inline — no redirect) ───────────────── */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText size={12} /> Generate Proposal
                </p>

                <div className="flex gap-2">
                  <select
                    value={proposalStrategy}
                    onChange={e => setProposalStrategy(e.target.value)}
                    className="input text-xs flex-1"
                  >
                    {PROPOSAL_STRATEGIES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleGenerateProposal}
                    disabled={proposalMutation.isPending}
                    className="btn-primary text-xs px-3 flex items-center gap-1.5 flex-shrink-0"
                  >
                    {proposalMutation.isPending
                      ? <><RefreshCw size={12} className="animate-spin" /> Generating...</>
                      : <><Sparkles size={12} /> Generate</>}
                  </button>
                </div>

                {proposalMutation.isError && (
                  <p className="text-xs text-danger">Proposal generation failed. Try again.</p>
                )}

                {proposal && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative">
                    <button
                      type="button"
                      onClick={copyProposal}
                      className="absolute top-3 right-3 text-slate-400 hover:text-primary transition-colors"
                      title="Copy proposal"
                    >
                      {copied
                        ? <CheckCheck size={14} className="text-success" />
                        : <Copy size={14} />}
                    </button>
                    <pre className="text-xs text-dark whitespace-pre-wrap leading-relaxed pr-6">
                      {proposal}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {!result && !analyzeMutation.isPending && (
            <div className="card p-8 text-center text-slate-400">
              <Brain size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm">Fill out the form and click Analyze to get AI insights</p>
              <p className="text-xs text-slate-400 mt-1">
                Proposal generation will appear here after analysis
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Past Analyses ─────────────────────────────────────────────────── */}
      {pastAnalyses.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-dark mb-4">Past Analyses</h2>
          <div className="space-y-2">
            {pastAnalyses.map((a: AnalysisResult & { id: string; projectTitle?: string; createdAt: string }) => (
              <div key={a.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={clsx('badge', EFFORT_CLASSES[a.effortLevel])}>{a.effortLevel}</span>
                    <div>
                      <p className="text-sm font-medium text-dark">
                        {a.projectTitle || 'Project Analysis'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tech fit: {a.techFitScore}/100 · Bid: ${a.bidRange?.min}–${a.bidRange?.max} ·{' '}
                        {format(parseISO(a.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {expandedId === a.id
                    ? <ChevronUp size={16} className="text-slate-400" />
                    : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {expandedId === a.id && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
                    <p className="text-sm text-dark">
                      <span className="font-medium">Winning angle:</span> {a.winningAngle}
                    </p>
                    {a.redFlags.length > 0 && (
                      <p className="text-sm text-danger">
                        <span className="font-medium">Red flags:</span> {a.redFlags.join(', ')}
                      </p>
                    )}
                    {a.matchedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {a.matchedSkills.map((s) => (
                          <span key={s} className="badge badge-success text-xs">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
