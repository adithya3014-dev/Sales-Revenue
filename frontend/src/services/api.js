import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
});

export const clearStoredAuth = () => {
  localStorage.removeItem('sales_auth_token');
  sessionStorage.removeItem('sales_auth_token');
  localStorage.removeItem('sales_auth_user');
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
  const response = await api.post('/auth/register', payload);
  return response.data;
};

export const loginUser = async (payload) => {
  const response = await api.post('/auth/login', payload);
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

export const me = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const updateProfile = async (payload) => {
  const response = await api.patch('/auth/profile', payload);
  return response.data;
};

export const updatePassword = async (payload) => {
  const response = await api.patch('/auth/password', payload);
  return response.data;
};

export const updatePreferences = async (payload) => {
  const response = await api.patch('/auth/preferences', payload);
  return response.data;
};

export const fetchAdminUsers = async () => {
  const response = await api.get('/admin/users');
  return response.data;
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
  const response = await api.get('/dashboard', { params });
  return response.data;
};

export const fetchSales = async (params = {}) => {
  const response = await api.get('/sales', { params });
  return response.data;
};

export const fetchProducts = async (params = {}) => {
  const response = await api.get('/products', { params });
  return response.data;
};

export const fetchCategories = async (params = {}) => {
  const response = await api.get('/categories', { params });
  return response.data;
};

export const fetchCustomers = async (params = {}) => {
  const response = await api.get('/customers', { params });
  return response.data;
};

export const fetchRevenueAnalysis = async (params = {}) => {
  const response = await api.get('/analysis/revenue', { params });
  return response.data;
};

export const fetchProfitAnalysis = async (params = {}) => {
  const response = await api.get('/analysis/profit', { params });
  return response.data;
};

export const fetchSeasonalAnalysis = async (params = {}) => {
  const response = await api.get('/analysis/seasonal', { params });
  return response.data;
};

export const fetchModelMetrics = async () => {
  const response = await api.get('/models/metrics');
  return response.data;
};

export const submitPrediction = async (payload) => {
  const response = await api.post('/prediction', payload);
  return response.data;
};

export const uploadCsv = async (csvData) => {
  const response = await api.post('/data/upload', { csv: csvData });
  return response.data;
};

export default api;
