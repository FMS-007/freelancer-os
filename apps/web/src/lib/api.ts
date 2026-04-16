import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401; redirect to login when refresh itself fails
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { refreshToken, setTokens, logout } = useAuthStore.getState();
        if (!refreshToken) { logout(); redirectToLogin(original.url); return Promise.reject(error); }
        const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
        setTokens(res.data.accessToken, res.data.refreshToken);
        original.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        redirectToLogin(original?.url);
      }
    }
    return Promise.reject(error);
  },
);

function redirectToLogin(requestUrl?: string): void {
  const isAuthRequest = typeof requestUrl === 'string' && requestUrl.includes('/auth/');
  if (!isAuthRequest && window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  signup: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/signup', data).then(r => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getProfile: () => api.get('/users/profile').then(r => r.data),
  updateProfile: (data: Record<string, unknown>) => api.put('/users/profile', data).then(r => r.data),
  getStats: () => api.get('/users/stats').then(r => r.data),
};

// ── Proposals ─────────────────────────────────────────────────────────────────
export const proposalsApi = {
  list: (params?: Record<string, unknown>) => api.get('/proposals', { params }).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/proposals', data).then(r => r.data),
  get: (id: string) => api.get(`/proposals/${id}`).then(r => r.data),
  updateStatus: (id: string, status: string) => api.put(`/proposals/${id}/status`, { status }).then(r => r.data),
  saveReference: (id: string) => api.post(`/proposals/${id}/save-reference`).then(r => r.data),
  delete: (id: string) => api.delete(`/proposals/${id}`).then(r => r.data),
  references: () => api.get('/proposals/references').then(r => r.data),
  exportCsv: () => api.get('/proposals/export/csv', { responseType: 'blob' }),
};

// ── Templates ─────────────────────────────────────────────────────────────────
export const templatesApi = {
  listComponents: (type?: string) => api.get('/templates/components', { params: type ? { type } : {} }).then(r => r.data),
  createComponent: (data: Record<string, unknown>) => api.post('/templates/components', data).then(r => r.data),
  updateComponent: (id: string, data: Record<string, unknown>) => api.put(`/templates/components/${id}`, data).then(r => r.data),
  deleteComponent: (id: string) => api.delete(`/templates/components/${id}`).then(r => r.data),
  list: () => api.get('/templates').then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/templates', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/templates/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/templates/${id}`).then(r => r.data),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  analyze: (data: Record<string, unknown>) => api.post('/ai/analyze', data).then(r => r.data),
  generateProposal: (data: Record<string, unknown>) => api.post('/ai/generate-proposal', data).then(r => r.data),
  profileReview: (data: Record<string, unknown>) => api.post('/ai/profile-review', data).then(r => r.data),
  getAnalyses: () => api.get('/ai/analyses').then(r => r.data),
  getProfileReviews: () => api.get('/ai/profile-reviews').then(r => r.data),
};

// ── Alerts ────────────────────────────────────────────────────────────────────
export const alertsApi = {
  getConfig: () => api.get('/alerts/config').then(r => r.data),
  saveConfig: (data: Record<string, unknown>) => api.put('/alerts/config', data).then(r => r.data),
  getTimezones: () => api.get('/alerts/timezones').then(r => r.data),
  getSchedule: () => api.get('/alerts/schedule').then(r => r.data),
};

// ── Records ───────────────────────────────────────────────────────────────────
export const recordsApi = {
  list: (params?: Record<string, unknown>) => api.get('/records', { params }).then(r => r.data),
  getStats: () => api.get('/records/stats').then(r => r.data),
  exportCsv: () => api.get('/records/export/csv', { responseType: 'blob' }),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard').then(r => r.data),
  getTimeline: (days?: number) => api.get('/analytics/timeline', { params: { days } }).then(r => r.data),
  getHeatmap: () => api.get('/analytics/heatmap').then(r => r.data),
};

// ── Scraper ───────────────────────────────────────────────────────────────────
export const scraperApi = {
  search:       (data: Record<string, unknown>) => api.post('/scraper/search', data).then(r => r.data),
  status:       () => api.get('/scraper/status').then(r => r.data),
  saveProject:  (data: Record<string, unknown>) => api.post('/scraper/save', data).then(r => r.data),
  getSaved:     () => api.get('/scraper/saved').then(r => r.data),
  deleteSaved:  (id: string) => api.delete(`/scraper/saved/${id}`).then(r => r.data),
};

// ── Platform Connections (OAuth) ──────────────────────────────────────────────
export type PlatformName = 'upwork' | 'freelancer';

export interface PlatformConnectionInfo {
  platform: PlatformName;
  connectedAt: string;
  expiresAt: string | null;
  email: string | null;
  externalId: string | null;
  expired: boolean;
}

export interface ConnectionStatusResponse {
  upwork: boolean;
  freelancer: boolean;
  connections: {
    upwork:     PlatformConnectionInfo | null;
    freelancer: PlatformConnectionInfo | null;
  };
}

export const connectionsApi = {
  /** Returns connected status + metadata for all platforms. */
  status: () =>
    api.get<ConnectionStatusResponse>('/connections/status').then(r => r.data),

  /**
   * Starts OAuth flow for the given platform.
   * Returns the authorizeUrl the user should be redirected / popup-opened to.
   */
  start: (platform: PlatformName) =>
    api
      .post<{ platform: PlatformName; authorizeUrl: string }>(`/connections/${platform}/start`)
      .then(r => r.data),

  /** Refreshes an expired access token using the stored refresh token. */
  refresh: (platform: PlatformName) =>
    api.post<{ success: boolean; platform: PlatformName }>(`/connections/${platform}/refresh`).then(r => r.data),

  /** Removes the stored connection for a platform. */
  disconnect: (platform: PlatformName) =>
    api.delete<{ success: boolean; platform: PlatformName }>(`/connections/${platform}`).then(r => r.data),

  /** Submits a Personal Access Token for a platform (no OAuth app needed). */
  submitToken: (platform: PlatformName, token: string) =>
    api.post<{ success: boolean; platform: PlatformName; username: string | null; email: string | null }>(
      `/connections/${platform}/token`,
      { token },
    ).then(r => r.data),

  /** Returns whether OAuth is configured + PAT info URLs for a platform. */
  getOAuthConfig: (platform: PlatformName) =>
    api.get<{ platform: PlatformName; configured: boolean; patInfo: { loginUrl: string; tokenUrl: string; instructions: string } }>(
      `/connections/oauth-config/${platform}`,
    ).then(r => r.data),

  /**
   * Opens a real Chromium browser window on the server (via scraper service).
   * Kept for backwards-compat; not used in the primary UI flow.
   */
  browserConnect: (platform: PlatformName) =>
    api.post<{ success: boolean; platform: PlatformName; username: string | null; email: string | null }>(
      `/connections/${platform}/browser-connect`,
      {},
      { timeout: 360_000 },
    ).then(r => r.data),
};
