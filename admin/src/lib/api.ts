import axios from 'axios';

type QueryParams = Record<string, string | number | boolean | undefined>;
type RequestPayload = Record<string, unknown>;

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) { localStorage.removeItem('admin_token'); window.location.href = '/login'; }
    return Promise.reject(err);
  },
);

export function setToken(token: string) { localStorage.setItem('admin_token', token); }
export function clearToken() { localStorage.removeItem('admin_token'); }
export function hasToken() { return !!localStorage.getItem('admin_token'); }

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { identifier: email, password });
  const token = res.data?.accessToken || res.data?.access_token || res.data?.token;
  if (token) setToken(token);
  return res.data;
}

export async function getDashboard() { const r = await api.get('/admin/dashboard'); return r.data; }
export async function getUsers(p?: QueryParams) { const r = await api.get('/admin/users', { params: p }); return r.data; }
export async function getUserDetail(id: string) { const r = await api.get(`/admin/users/${id}`); return r.data; }
export async function suspendUser(id: string, reason: string) { const r = await api.patch(`/admin/users/${id}/suspend`, { reason }); return r.data; }
export async function unsuspendUser(id: string) { const r = await api.patch(`/admin/users/${id}/unsuspend`); return r.data; }
export async function banUser(id: string, reason: string) { const r = await api.patch(`/admin/users/${id}/ban`, { reason }); return r.data; }
export async function getTrips(p?: QueryParams) { const r = await api.get('/admin/trips', { params: p }); return r.data; }
export async function cancelTrip(id: string, reason: string) { const r = await api.post(`/admin/trips/${id}/cancel`, { reason }); return r.data; }
export async function getBookings(p?: QueryParams) { const r = await api.get('/admin/bookings', { params: p }); return r.data; }
export async function getPayments(p?: QueryParams) { const r = await api.get('/admin/payments', { params: p }); return r.data; }
export async function getSosAlerts() { const r = await api.get('/admin/safety/sos'); return r.data; }
export async function getIncidents(p?: QueryParams) { const r = await api.get('/admin/safety/incidents', { params: p }); return r.data; }
export async function getConfig() { const r = await api.get('/admin/config'); return r.data; }
export async function updateConfig(c: RequestPayload) { const r = await api.patch('/admin/config', c); return r.data; }
export async function getSubscriptions(p?: QueryParams) { const r = await api.get('/admin/subscriptions', { params: p }); return r.data; }
export async function overrideTrial(userId: string, days: number) { const r = await api.post(`/admin/subscriptions/${userId}/trial`, { days }); return r.data; }
export async function broadcastNotification(title: string, body: string, role?: string) { const r = await api.post('/admin/notifications/broadcast', { title, body, role }); return r.data; }
export async function getDriverDocs() { const r = await api.get('/admin/driver-docs'); return r.data; }
export async function verifyVehicle(id: string, approved: boolean) { const r = await api.patch(`/admin/driver-docs/vehicles/${id}/verify`, { approved }); return r.data; }
export async function getVehicleReviewQueue(status = 'pending_review') { const r = await api.get('/admin/vehicle-review', { params: { status } }); return r.data; }
export async function reviewMobileVehicle(id: string, approved: boolean, note?: string) { const r = await api.patch(`/admin/vehicle-review/${id}`, { approved, note }); return r.data; }
export async function getAuditTrail(p?: QueryParams) { const r = await api.get('/admin/audit', { params: p }); return r.data; }
export async function getModerationQueue(p?: QueryParams) { const r = await api.get('/trust-safety/admin/moderation/queue', { params: p }); return r.data; }
export async function getReportDetail(id: string) { const r = await api.get(`/trust-safety/admin/moderation/reports/${id}`); return r.data; }
export async function getSupportTickets(p?: QueryParams) { const r = await api.get('/admin/support-tickets', { params: p }); return r.data; }
export async function getSupportTicket(id: string) { const r = await api.get(`/admin/support-tickets/${id}`); return r.data; }
export async function updateTicketStatus(id: string, status: string) { const r = await api.patch(`/admin/support-tickets/${id}/status`, { status }); return r.data; }
export async function getTicketMessages(id: string) { const r = await api.get(`/admin/support-tickets/${id}/messages`); return r.data; }
export async function addTicketMessage(id: string, dto: RequestPayload) { const r = await api.post(`/admin/support-tickets/${id}/messages`, dto); return r.data; }
export async function getSupportAgents() { const r = await api.get('/admin/support-agents'); return r.data; }
export async function createSupportAgent(dto: RequestPayload) { const r = await api.post('/admin/support-agents', dto); return r.data; }
export async function toggleSupportAgent(id: string, active: boolean) { const r = await api.patch(`/admin/support-agents/${id}/toggle`, { active }); return r.data; }

export default api;
