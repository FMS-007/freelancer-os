import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api, authApi, proposalsApi, recordsApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { isFirebaseConfigured, registerPushNotifications } from '../lib/firebase';
import {
  Shield, Bell, Database, Trash2, Download,
  Key, Check, AlertTriangle, RefreshCw, Copy, Puzzle,
} from 'lucide-react';
import clsx from 'clsx';

export default function Settings() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [pwError, setPwError] = useState('');

  // Push notifications
  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');

  // Extension token
  const [extToken, setExtToken]       = useState('');
  const [extTokenStatus, setExtTokenStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [extTokenCopied, setExtTokenCopied] = useState(false);

  // Data export
  const [exporting, setExporting] = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleChangePassword() {
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Passwords do not match');
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    setPwStatus('loading');
    setPwError('');
    try {
      await api.put('/users/password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwStatus('ok');
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwStatus('idle'), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPwError(msg || 'Failed to change password');
      setPwStatus('error');
    }
  }

  async function handleEnablePush() {
    setPushStatus('loading');
    try {
      const ok = await registerPushNotifications();
      setPushStatus(ok ? 'ok' : 'denied');
    } catch {
      setPushStatus('denied');
    }
  }

  async function handleGenerateExtToken() {
    setExtTokenStatus('loading');
    try {
      const { extensionToken } = await authApi.extensionToken();
      setExtToken(extensionToken);
      setExtTokenStatus('ok');
    } catch {
      setExtTokenStatus('error');
    }
  }

  async function handleCopyExtToken() {
    if (!extToken) return;
    await navigator.clipboard.writeText(extToken);
    setExtTokenCopied(true);
    setTimeout(() => setExtTokenCopied(false), 2000);
  }

  async function handleExportAll() {
    setExporting(true);
    try {
      const res = await recordsApi.exportCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `freelancer-os-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== user?.email) return;
    setDeleting(true);
    try {
      await api.delete('/users/account');
      logout();
      navigate('/login');
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="page-shell-tight">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark">Settings</h1>
        <p className="text-slate-500 mt-0.5">Account security, notifications, and data management</p>
      </div>

      <div className="space-y-6">
        {/* Change Password */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-4 flex items-center gap-2">
            <Key size={16} className="text-primary" /> Change Password
          </h2>
          {pwError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-danger">
              {pwError}
            </div>
          )}
          {pwStatus === 'ok' && (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-success flex items-center gap-2">
              <Check size={14} /> Password changed successfully
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="label">Current Password</label>
              <input
                type="password"
                value={pwForm.current}
                onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                className="input"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                value={pwForm.next}
                onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                className="input"
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                className="input"
                placeholder="Repeat new password"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={!pwForm.current || !pwForm.next || pwStatus === 'loading'}
              className="btn-primary"
            >
              {pwStatus === 'loading' ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : <><Shield size={14} /> Update Password</>}
            </button>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-1 flex items-center gap-2">
            <Bell size={16} className="text-primary" /> Push Notifications
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Get browser push alerts when your target markets are active.
            {!isFirebaseConfigured() && (
              <span className="block mt-1 text-xs text-warning">
                Firebase not configured — add VITE_FIREBASE_* env vars to enable.
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleEnablePush}
              disabled={pushStatus === 'loading' || pushStatus === 'ok' || !isFirebaseConfigured()}
              className={clsx(
                'btn',
                pushStatus === 'ok' ? 'bg-success text-white' : 'btn-primary',
                pushStatus === 'denied' ? 'btn-secondary' : '',
              )}
            >
              {pushStatus === 'loading' && <RefreshCw size={14} className="animate-spin" />}
              {pushStatus === 'ok' && <Check size={14} />}
              {pushStatus === 'ok' ? 'Notifications Enabled' : 'Enable Notifications'}
            </button>
            {pushStatus === 'denied' && (
              <p className="text-xs text-danger">
                Permission denied. Enable notifications in your browser settings.
              </p>
            )}
          </div>
        </div>

        {/* Chrome Extension Token */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-1 flex items-center gap-2">
            <Puzzle size={16} className="text-primary" /> Chrome Extension
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Generate a long-lived token (30 days) for the{' '}
            <span className="font-medium text-dark">Freelancer OS Connector</span> browser extension.
            Paste it in the extension popup to connect it to your account.
          </p>
          <button
            onClick={handleGenerateExtToken}
            disabled={extTokenStatus === 'loading'}
            className="btn-primary mb-3"
          >
            {extTokenStatus === 'loading'
              ? <><RefreshCw size={14} className="animate-spin" /> Generating...</>
              : <><Key size={14} /> Generate Token</>}
          </button>
          {extTokenStatus === 'ok' && extToken && (
            <div className="space-y-2">
              <label className="label text-xs">Extension Token (expires in 30 days)</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={extToken}
                  className="input font-mono text-xs flex-1 select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyExtToken}
                  className={clsx(
                    'btn flex-shrink-0 text-xs',
                    extTokenCopied ? 'bg-success text-white' : 'btn-secondary',
                  )}
                  title="Copy token"
                >
                  {extTokenCopied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Paste this token into the Freelancer OS Chrome Extension popup → API Connection → Auth Token
              </p>
            </div>
          )}
          {extTokenStatus === 'error' && (
            <p className="text-xs text-danger">Failed to generate token. Please try again.</p>
          )}
        </div>

        {/* Data Export */}
        <div className="card p-5">
          <h2 className="font-semibold text-dark mb-1 flex items-center gap-2">
            <Database size={16} className="text-primary" /> Data Export
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Download all your proposal records as a CSV file before they expire.
          </p>
          <button
            onClick={handleExportAll}
            disabled={exporting}
            className="btn-secondary"
          >
            {exporting ? (
              <><RefreshCw size={14} className="animate-spin" /> Exporting...</>
            ) : (
              <><Download size={14} /> Export All Records</>
            )}
          </button>
        </div>

        {/* Delete Account */}
        <div className="card p-5 border-danger/30">
          <h2 className="font-semibold text-danger mb-1 flex items-center gap-2">
            <AlertTriangle size={16} /> Danger Zone
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Permanently delete your account and all data. This cannot be undone.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-sm text-danger">
              Type <strong>{user?.email}</strong> to confirm deletion:
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="input border-red-200 focus:ring-danger/30 focus:border-danger"
              placeholder={user?.email}
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== user?.email || deleting}
              className="btn-danger"
            >
              {deleting ? (
                <><RefreshCw size={14} className="animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 size={14} /> Delete My Account</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
