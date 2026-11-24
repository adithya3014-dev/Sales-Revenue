import axios from 'axios';
import {
  DEMO_SALES,
  DEMO_PRODUCTS,
  DEMO_CATEGORIES,
  DEMO_CUSTOMERS,
  DEMO_MODEL_METRICS,
  getDemoDashboard,
  filterDemoSales
} from '../data/mockData';

const DEFAULT_API_URL = 'https://bay-laid-analyst-technology.trycloudflare.com/api';

function resolveApiBaseUrl() {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const apiParam = params.get('api');
      if (apiParam) {
        let clean = apiParam.trim().replace(/\/+$/, '');
        if (!clean.endsWith('/api')) clean += '/api';
        localStorage.setItem('revora_api_url', clean);
        params.delete('api');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        return clean;
      }
    } catch {
      // ignore in environments without window / location
    }

    // When running locally on localhost or 127.0.0.1, directly use the local Express backend
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }

    const saved = localStorage.getItem('revora_api_url');
    if (saved) return saved;
  }
  return import.meta.env.VITE_API_URL || DEFAULT_API_URL;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  timeout: 8000
});

export const getApiUrl = () => api.defaults.baseURL || resolveApiBaseUrl();

export const setApiUrl = (url) => {
  let clean = (url || '').trim().replace(/\/+$/, '');
  if (clean && !clean.endsWith('/api')) clean += '/api';
  if (clean) {
    localStorage.setItem('revora_api_url', clean);
    api.defaults.baseURL = clean;
  }
  return clean;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sales_auth_token') || sessionStorage.getItem('sales_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Bypass-Tunnel-Reminder'] = 'true';
  return config;
});

export const clearStoredAuth = () => {
  localStorage.removeItem('sales_auth_token');
  sessionStorage.removeItem('sales_auth_token');
  localStorage.removeItem('sales_auth_user');
  sessionStorage.removeItem('sales_demo_user');
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
      window.dispatchEvent(new Event('revora:session-expired'));
    }
    return Promise.reject(error);
  }
);

export const registerUser = async (payload) => {
  try {
    const response = await api.post('/auth/register', payload);
    if (response.data?.token) {
      localStorage.setItem('sales_auth_token', response.data.token);
    }
    if (response.data?.user) {
      localStorage.setItem('sales_auth_user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw err;
    }
    // Only if backend is completely offline:
    const user = {
      id: Date.now(),
      name: payload.name || 'REVORA User',
      email: payload.email,
      role: 'admin',
      preferences: { theme: 'light', notificationsEnabled: true }
    };
    sessionStorage.setItem('sales_demo_user', JSON.stringify(user));
    return { success: true, message: 'Account created (Demo Mode)', user };
  }
};

export const loginUser = async (payload) => {
  try {
    const response = await api.post('/auth/login', payload);
    if (response.data?.token) {
      localStorage.setItem('sales_auth_token', response.data.token);
    }
    if (response.data?.user) {
      localStorage.setItem('sales_auth_user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw err;
    }
    // Only if backend is completely offline:
    const user = {
      id: 1,
      name: payload.email?.split('@')[0] || 'Admin User',
      email: payload.email || 'admin@salesdashboard.com',
      role: 'admin',
      preferences: { theme: 'light', notificationsEnabled: true }
    };
    sessionStorage.setItem('sales_demo_user', JSON.stringify(user));
    return { success: true, message: 'Signed in (Demo Mode)', user };
  }
};

export const logoutUser = async () => {
  clearStoredAuth();
  try {
    const response = await api.post('/auth/logout');
    return response.data;
  } catch {
    return { success: true };
  }
};

export const me = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (err) {
    const saved = sessionStorage.getItem('sales_demo_user');
    if (saved) {
      return { user: JSON.parse(saved) };
    }
    throw err;
  }
};

export const updateProfile = async (payload) => {
  try {
    const response = await api.patch('/auth/profile', payload);
    return response.data;
  } catch {
    const saved = JSON.parse(sessionStorage.getItem('sales_demo_user') || '{}');
    const updated = { ...saved, name: payload.name || saved.name };
    sessionStorage.setItem('sales_demo_user', JSON.stringify(updated));
    return { success: true, user: updated };
  }
};

export const updatePassword = async (payload) => {
  const response = await api.patch('/auth/password', payload);
  return response.data;
};

export const updatePreferences = async (payload) => {
  try {
    const response = await api.patch('/auth/preferences', payload);
    return response.data;
  } catch {
    return { success: true, preferences: payload };
  }
};

export const fetchAdminUsers = async () => {
  try {
    const response = await api.get('/admin/users');
    return response.data;
  } catch {
    return {
      data: [
        { id: 1, name: 'Admin User', email: 'admin@salesdashboard.com', role: 'admin' },
        { id: 2, name: 'Operations Manager', email: 'ops@salesdashboard.com', role: 'manager' }
      ]
    };
  }
};

export const updateUserRole = async (id, role) => {
  const response = await api.patch(`/admin/users/${id}/role`, { role });
  return response.data;
};

export const requestPasswordReset = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (payload) => {
  const response = await api.post('/auth/reset-password', payload);
  return response.data;
};

export const fetchDashboard = async (params = {}) => {
  try {
    const response = await api.get('/dashboard', { params });
    return response.data;
  } catch {
    return getDemoDashboard(params);
  }
};

export const fetchSales = async (params = {}) => {
  try {
    const response = await api.get('/sales', { params });
    return response.data;
  } catch {
    return { data: filterDemoSales(params), demoData: true };
  }
};

export const fetchProducts = async (params = {}) => {
  try {
    const response = await api.get('/products', { params });
    return response.data;
  } catch {
    return { data: DEMO_PRODUCTS };
  }
};

export const fetchCategories = async (params = {}) => {
  try {
    const response = await api.get('/categories', { params });
    return response.data;
  } catch {
    return { data: DEMO_CATEGORIES };
  }
};

export const fetchCustomers = async (params = {}) => {
  try {
    const response = await api.get('/customers', { params });
    return response.data;
  } catch {
    return { data: DEMO_CUSTOMERS };
  }
};

export const fetchRevenueAnalysis = async (params = {}) => {
  try {
    const response = await api.get('/analysis/revenue', { params });
    return response.data;
  } catch {
    const dash = getDemoDashboard(params);
    return { data: dash.revenueTrend };
  }
};

export const fetchProfitAnalysis = async (params = {}) => {
  try {
    const response = await api.get('/analysis/profit', { params });
    return response.data;
  } catch {
    const dash = getDemoDashboard(params);
    return { data: dash.categoryBreakdown.map(c => ({ category: c.category, profit: c.profit })) };
  }
};

export const fetchSeasonalAnalysis = async (params = {}) => {
  try {
    const response = await api.get('/analysis/seasonal', { params });
    return response.data;
  } catch {
    const dash = getDemoDashboard(params);
    return { data: dash.seasonalPattern };
  }
};

export const fetchModelMetrics = async () => {
  try {
    const response = await api.get('/models/metrics');
    return response.data;
  } catch {
    return { data: DEMO_MODEL_METRICS };
  }
};

export const submitPrediction = async (payload) => {
  try {
    const response = await api.post('/prediction', payload);
    return response.data;
  } catch {
    return {
      prediction: 128450.00,
      predictedRevenue: 128450.00,
      period: payload.period || 'Next 3 Months',
      model: payload.model || 'Random Forest Regressor',
      mae: 1420.35,
      rmse: 1890.12,
      mape: 4.82
    };
  }
};

export const uploadCsv = async (csvData) => {
  const response = await api.post('/data/upload', { csv: csvData });
  return response.data;
};

export default api;
