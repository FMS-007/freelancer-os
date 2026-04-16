import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, aiApi, connectionsApi, getApiErrorMessage, type PlatformName } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { TECH_SKILLS, PLATFORMS } from '@freelancer-os/shared';
import {
  User, Briefcase, Brain, X, Save, Check, RefreshCw, TrendingUp,
  Link2, ExternalLink, CheckCircle2, AlertTriangle, Unlink, Loader2,
  Key, ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';

interface ProfileReview {
  id: string;
  overallScore: number;
  dimensionScores: { headline: number; bio: number; skills: number; portfolio: number; completeness: number };
  improvements: { action: string; expectedImpact: 'high' | 'medium' | 'low'; estimatedDays: number }[];
  createdAt: string;
}

const IMPACT_CLASSES = { high: 'badge-danger', medium: 'badge-warning', low: 'badge-success' };

const POPULAR_TZ = [
  'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London',
  'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney',
];

// ── Platform card ─────────────────────────────────────────────────────────────

interface PlatformCardProps {
  platform: PlatformName;
  color: string;
  initial: string;
  label: string;
  connection: { connectedAt: string; expiresAt: string | null; email: string | null; externalId: string | null; expired: boolean } | null;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}

function PlatformCard({
  color, initial, label,
  connection, loading, onConnect, onDisconnect, onReconnect,
}: PlatformCardProps) {
  const isConnected = !!connection && !connection.expired;
  const isExpired   = !!connection?.expired;
  const displayName = connection?.externalId ?? connection?.email ?? null;

  return (
    <div className={clsx(
      'rounded-xl border p-4 transition-colors',
      isConnected ? 'border-emerald-200 bg-emerald-50/40'
        : isExpired ? 'border-amber-200 bg-amber-50/40'
        : 'border-slate-200 bg-white',
    )}>
      <div className="flex items-center gap-3">
        {/* Platform logo */}
        <span
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
          style={{ backgroundColor: color }}
        >
          {initial}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-dark">{label}</p>
          {isConnected && displayName && (
            <p className="text-xs text-slate-500 truncate">@{displayName}</p>
          )}
          {isConnected && !displayName && (
            <p className="text-xs text-emerald-600">Connected</p>
          )}
          {isExpired && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={10} /> Session expired
            </p>
          )}
          {!connection && (
            <p className="text-xs text-slate-400">Not connected</p>
          )}
        </div>

        {/* Status badge + action */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 size={13} /> Connected
            </span>
          )}

          {loading ? (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          ) : isConnected ? (
            <button
              onClick={onDisconnect}
              title="Disconnect"
              className="text-slate-400 hover:text-danger transition-colors p-1"
            >
              <Unlink size={14} />
            </button>
          ) : isExpired ? (
            <button
              onClick={onReconnect}
              className="btn-primary text-xs px-3 py-1.5"
            >
              <RefreshCw size={12} /> Reconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              className="btn-primary text-xs px-3 py-1.5"
            >
              <ExternalLink size={12} /> Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Profile() {
  const qc = useQueryClient();
  const { user, updateUser } = useAuthStore();

  const [savedAccount,  setSavedAccount]  = useState(false);
  const [savedProfile,  setSavedProfile]  = useState(false);
  const [skillInput,    setSkillInput]    = useState('');
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformName | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [patModal, setPatModal] = useState<{
    platform: PlatformName;
    loginUrl: string;
    tokenUrl: string;
    instructions: string;
  } | null>(null);
  const [patToken, setPatToken] = useState('');
  const [patError, setPatError] = useState('');


  // Form state
  const [name,       setName]       = useState(user?.name ?? '');
  const [timezone,   setTimezone]   = useState(user?.timezone ?? 'UTC');
  const [bio,        setBio]        = useState('');
  const [experience, setExperience] = useState('');
  const [hourlyRate, setHourlyRate] = useState(30);
  const [skills,     setSkills]     = useState<string[]>([]);
  const [platforms,  setPlatforms]  = useState<string[]>([]);

  // AI Profile Review
  const [profileDesc,    setProfileDesc]    = useState('');
  const [reviewPlatform, setReviewPlatform] = useState('Upwork');
  const [reviewResult,   setReviewResult]   = useState<ProfileReview | null>(null);

  const { data: profileData } = useQuery({ queryKey: ['user-profile'],  queryFn: usersApi.getProfile });
  const { data: pastReviews = [] } = useQuery({ queryKey: ['profile-reviews'], queryFn: aiApi.getProfileReviews });
  const { data: connectionStatus } = useQuery({
    queryKey: ['platform-connections-status'],
    queryFn: connectionsApi.status,
    refetchInterval: connectingPlatform ? 3000 : false,
  });

  useEffect(() => {
    if (profileData) {
      setName(profileData.name ?? '');
      setTimezone(profileData.timezone ?? 'UTC');
      if (profileData.profile) {
        setBio(profileData.profile.bio ?? '');
        setExperience(profileData.profile.experience ?? '');
        setHourlyRate(profileData.profile.hourlyRate ?? 30);
        setSkills(profileData.profile.skills ?? []);
        setPlatforms(profileData.profile.platforms ?? []);
      }
    }
  }, [profileData]);

  // Handle ?connected / ?connectError query params (redirect-mode fallback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const connectError = params.get('connectError');
    if (connected) {
      setNotice({ type: 'success', message: `${connected} account connected successfully!` });
      qc.invalidateQueries({ queryKey: ['platform-connections-status'] });
    }
    if (connectError) {
      setNotice({ type: 'error', message: `Could not connect ${connectError}. Please try again.` });
    }
    if (connected || connectError) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [qc]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const accountMutation = useMutation({
    mutationFn: () => usersApi.updateProfile({ name, timezone }),
    onSuccess: (data) => {
      updateUser({ name: data.name, timezone: data.timezone });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
      setSavedAccount(true);
      setTimeout(() => setSavedAccount(false), 2000);
    },
  });

  const profileMutation = useMutation({
    mutationFn: () => usersApi.updateProfile({ bio, experience, hourlyRate, skills, platforms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-profile'] });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => aiApi.profileReview({ profileDescription: profileDesc, platform: reviewPlatform }),
    onSuccess: (data) => {
      setReviewResult(data);
      qc.invalidateQueries({ queryKey: ['profile-reviews'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (platform: PlatformName) => connectionsApi.disconnect(platform),
    onSuccess: (_, platform) => {
      setNotice({ type: 'success', message: `${platform} disconnected.` });
      qc.invalidateQueries({ queryKey: ['platform-connections-status'] });
    },
    onSettled: () => setConnectingPlatform(null),
  });

  // ── Platform connect flow ─────────────────────────────────────────────────
  async function startConnect(platform: PlatformName) {
    setConnectingPlatform(platform);
    setNotice(null);
    try {
      const result = await connectionsApi.browserConnect(platform);
      const label = result.username ? ` as @${result.username}` : '';
      setNotice({ type: 'success', message: `${platform} connected${label}!` });
      qc.invalidateQueries({ queryKey: ['platform-connections-status'] });
    } catch (err) {
      const msg = getApiErrorMessage(err, `Could not connect ${platform}. Make sure the scraper is running.`);
      setNotice({ type: 'error', message: msg });
    } finally {
      setConnectingPlatform(null);
    }
  }

  async function submitPAT() {
    if (!patModal || !patToken.trim()) return;
    setConnectingPlatform(patModal.platform);
    setPatError('');
    try {
      const result = await connectionsApi.submitToken(patModal.platform, patToken.trim());
      const label  = result.username ? ` as @${result.username}` : '';
      setNotice({ type: 'success', message: `${patModal.platform} connected${label}!` });
      qc.invalidateQueries({ queryKey: ['platform-connections-status'] });
      setPatModal(null);
      setPatToken('');
    } catch (err) {
      setPatError(getApiErrorMessage(err, 'Invalid token. Please check and try again.'));
    } finally {
      setConnectingPlatform(null);
    }
  }

  function toggleSkill(s: string) {
    setSkills((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  }

  function addCustomSkill() {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills((p) => [...p, s]);
    setSkillInput('');
  }

  function togglePlatform(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark">Profile</h1>
        <p className="text-slate-500 mt-0.5">Manage your account and professional profile</p>
      </div>

      {notice && (
        <div
          className={clsx(
            'mb-4 rounded-lg border px-4 py-3 text-sm flex items-start gap-2',
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          {notice.type === 'success'
            ? <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
            : <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />}
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-50 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* ── Account Info ─────────────────────────────────────────────────── */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-4 flex items-center gap-2">
            <User size={16} className="text-primary" /> Account Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Your name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={user?.email ?? ''} disabled className="input bg-slate-50 text-slate-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="label">Your Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="input">
                {POPULAR_TZ.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={() => accountMutation.mutate()}
            disabled={accountMutation.isPending}
            className={clsx('btn', savedAccount ? 'bg-success text-white' : 'btn-primary')}
          >
            {savedAccount ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Account</>}
          </button>
        </div>

        {/* ── Connected Accounts ───────────────────────────────────────────── */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-1 flex items-center gap-2">
            <Link2 size={16} className="text-primary" /> Connected Accounts
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Connect your freelancer platforms to enable authenticated project discovery and proposal submission.
          </p>

          <div className="space-y-3">
            <PlatformCard
              platform="upwork"
              color="#14A800"
              initial="U"
              label="Upwork"
              connection={connectionStatus?.connections.upwork ?? null}
              loading={connectingPlatform === 'upwork' || (disconnectMutation.isPending && disconnectMutation.variables === 'upwork')}
              onConnect={() => startConnect('upwork')}
              onDisconnect={() => { setConnectingPlatform('upwork'); disconnectMutation.mutate('upwork'); }}
              onReconnect={() => startConnect('upwork')}
            />

            <PlatformCard
              platform="freelancer"
              color="#29B2FE"
              initial="F"
              label="Freelancer.com"
              connection={connectionStatus?.connections.freelancer ?? null}
              loading={connectingPlatform === 'freelancer' || (disconnectMutation.isPending && disconnectMutation.variables === 'freelancer')}
              onConnect={() => startConnect('freelancer')}
              onDisconnect={() => { setConnectingPlatform('freelancer'); disconnectMutation.mutate('freelancer'); }}
              onReconnect={() => startConnect('freelancer')}
            />
          </div>

          {connectingPlatform && (
            <p className="text-xs text-primary font-medium mt-3 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              A browser window has opened on your machine. Please log in to {connectingPlatform}. This may take a few minutes…
            </p>
          )}

          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-600 flex items-center gap-1.5">
              <ExternalLink size={11} /> How it works
            </p>
            <p>Clicking <strong>Connect</strong> opens a browser window on your machine with the platform login page.</p>
            <p>Log in normally (including any CAPTCHA or 2FA). Once login is detected, your session is saved automatically.</p>
          </div>
        </div>

        {/* ── PAT Modal ────────────────────────────────────────────────────── */}
        {patModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-dark flex items-center gap-2">
                  <Key size={16} className="text-primary" />
                  Connect {patModal.platform === 'upwork' ? 'Upwork' : 'Freelancer.com'}
                </h3>
                <button onClick={() => setPatModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              {/* Step 1 */}
              <div className="mb-4">
                <p className="text-sm font-medium text-dark mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">1</span>
                  Log in to {patModal.platform === 'upwork' ? 'Upwork' : 'Freelancer.com'}
                </p>
                <a
                  href={patModal.loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
                >
                  <ExternalLink size={14} />
                  Open {patModal.platform === 'upwork' ? 'Upwork' : 'Freelancer.com'} login page
                  <ArrowRight size={14} className="ml-auto" />
                </a>
              </div>

              {/* Step 2 */}
              <div className="mb-4">
                <p className="text-sm font-medium text-dark mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">2</span>
                  Get your API / Access Token
                </p>
                <a
                  href={patModal.tokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs hover:border-primary/30 hover:text-primary transition-colors"
                >
                  <Key size={12} />
                  {patModal.instructions}
                  <ArrowRight size={12} className="ml-auto" />
                </a>
              </div>

              {/* Step 3 */}
              <div className="mb-5">
                <p className="text-sm font-medium text-dark mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">3</span>
                  Paste your token below
                </p>
                <input
                  value={patToken}
                  onChange={e => setPatToken(e.target.value)}
                  className="input font-mono text-sm"
                  placeholder="Paste access token here…"
                  autoComplete="off"
                />
                {patError && (
                  <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
                    <AlertTriangle size={11} /> {patError}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPatModal(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPAT}
                  disabled={!patToken.trim() || connectingPlatform === patModal.platform}
                  className="flex-1 btn-primary justify-center disabled:opacity-50"
                >
                  {connectingPlatform === patModal.platform
                    ? <><Loader2 size={14} className="animate-spin" /> Verifying…</>
                    : <><Check size={14} /> Connect</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Professional Profile ─────────────────────────────────────────── */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-4 flex items-center gap-2">
            <Briefcase size={16} className="text-primary" /> Professional Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Bio / Summary</label>
              <textarea
                value={bio} onChange={(e) => setBio(e.target.value)}
                rows={3} className="input resize-none"
                placeholder="Write a short professional summary that highlights your expertise..."
              />
            </div>
            <div>
              <label className="label">Experience Summary</label>
              <textarea
                value={experience} onChange={(e) => setExperience(e.target.value)}
                rows={2} className="input resize-none"
                placeholder="e.g. 5 years in React, 3 years in Node.js, built 20+ client projects..."
              />
            </div>
            <div>
              <label className="label">Hourly Rate (USD)</label>
              <input
                type="number" value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                min={1} className="input w-36"
              />
            </div>

            {/* Skills */}
            <div>
              <label className="label">Skills</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {skills.map((s) => (
                  <button key={s} type="button" onClick={() => toggleSkill(s)} className="badge badge-blue gap-1">
                    {s} <X size={10} />
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                  className="input flex-1" placeholder="Add custom skill..."
                />
                <button type="button" onClick={addCustomSkill} className="btn-secondary text-xs px-3">Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {TECH_SKILLS.filter((s) => !skills.includes(s)).map((s) => (
                  <button
                    key={s} type="button" onClick={() => toggleSkill(s)}
                    className="badge badge-gray hover:badge-blue transition-colors cursor-pointer text-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className="label">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p} type="button" onClick={() => togglePlatform(p)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm border transition-all',
                      platforms.includes(p)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => profileMutation.mutate()}
              disabled={profileMutation.isPending}
              className={clsx('btn', savedProfile ? 'bg-success text-white' : 'btn-primary')}
            >
              {savedProfile ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Profile</>}
            </button>
          </div>
        </div>

        {/* ── AI Profile Review ─────────────────────────────────────────────── */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-1 flex items-center gap-2">
            <Brain size={16} className="text-primary" /> AI Profile Review
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Paste your freelancer profile description to get an AI-powered score and improvement tips
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <label className="label">Platform</label>
              <select value={reviewPlatform} onChange={(e) => setReviewPlatform(e.target.value)} className="input w-48">
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Profile Description</label>
              <textarea
                value={profileDesc} onChange={(e) => setProfileDesc(e.target.value)}
                rows={6} className="input resize-none"
                placeholder="Paste your profile headline, bio, skills section, etc. from your freelancer profile..."
              />
            </div>
            <button
              onClick={() => reviewMutation.mutate()}
              disabled={!profileDesc || reviewMutation.isPending}
              className="btn-primary"
            >
              {reviewMutation.isPending
                ? <><RefreshCw size={14} className="animate-spin" /> Analyzing...</>
                : <><Brain size={14} /> Analyze Profile</>}
            </button>
          </div>

          {reviewResult && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="text-center py-2">
                <div className={clsx(
                  'text-4xl font-bold',
                  reviewResult.overallScore >= 70 ? 'text-success' : reviewResult.overallScore >= 40 ? 'text-warning' : 'text-danger',
                )}>
                  {reviewResult.overallScore}<span className="text-xl text-slate-400">/100</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Profile Strength Score</p>
              </div>

              <div className="space-y-2">
                {Object.entries(reviewResult.dimensionScores).map(([dim, score]) => (
                  <div key={dim}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span className="capitalize font-medium">{dim}</span>
                      <span className="font-semibold">{score}/20</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full', score >= 15 ? 'bg-success' : score >= 8 ? 'bg-warning' : 'bg-danger')}
                        style={{ width: `${(score / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <TrendingUp size={12} /> Top Improvements
                </p>
                <div className="space-y-2">
                  {reviewResult.improvements.map((imp, i) => (
                    <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                      <span className={clsx('badge flex-shrink-0 mt-0.5', IMPACT_CLASSES[imp.expectedImpact])}>
                        {imp.expectedImpact}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-dark">{imp.action}</p>
                        <p className="text-xs text-slate-400 mt-0.5">~{imp.estimatedDays} day{imp.estimatedDays !== 1 ? 's' : ''} to implement</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {pastReviews.length > 0 && !reviewResult && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Previous Reviews</p>
              <div className="space-y-2">
                {(pastReviews as ProfileReview[]).slice(0, 3).map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                    <div>
                      <p className={clsx(
                        'text-lg font-bold',
                        r.overallScore >= 70 ? 'text-success' : r.overallScore >= 40 ? 'text-warning' : 'text-danger',
                      )}>
                        {r.overallScore}/100
                      </p>
                      <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{r.improvements.length} improvements</p>
                      <p className="text-xs text-slate-400">suggested</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
