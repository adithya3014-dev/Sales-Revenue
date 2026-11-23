import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  AreaChart as AreaChartIcon,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Layers3,
  LogOut,
  ChevronDown,
  Moon,
  Package,
  Percent,
  PieChartIcon,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  ShoppingCart,
  TrendingUp,
  UserRound,
  Users,
  Warehouse,
  Zap,
  CalendarRange
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  clearStoredAuth,
  fetchCategories,
  fetchCustomers,
  fetchDashboard,
  fetchAdminUsers,
  fetchModelMetrics,
  fetchProducts,
  fetchProfitAnalysis,
  fetchRevenueAnalysis,
  fetchSales,
  fetchSeasonalAnalysis,
  loginUser,
  logoutUser,
  me,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updatePassword,
  updatePreferences,
  updateProfile,
  updateUserRole,
  submitPrediction,
  uploadCsv
} from './services/api';
import CATEGORY_TAXONOMY from './data/categoryTaxonomy';
import HelpChat from './components/HelpChat';

const navigation = [
  { label: 'Data Management', icon: Warehouse },
  { label: 'Dashboard', icon: AreaChartIcon },
  { label: 'Categories', icon: Layers3 },
  { label: 'Products', icon: Package },
  { label: 'Sales Analysis', icon: BarChart3 },
  { label: 'Customers', icon: Users },
  { label: 'Revenue & Profit', icon: CircleDollarSign },
  { label: 'Seasonal Analysis', icon: CalendarRange },
  { label: 'Revenue Prediction', icon: TrendingUp },
  { label: 'Model Comparison', icon: Zap },
  { label: 'EDA', icon: FileText },
  { label: 'Reports', icon: FileSpreadsheet },
  { label: 'Admin', icon: ShieldCheck },
  { label: 'Settings', icon: Settings },
  { label: 'Logout', icon: LogOut }
];

const KPI_COLORS = ['#1f6feb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981'];
const CHART_COLORS = ['#1f6feb', '#0ea5e9', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444'];

const emptyModelMetrics = { metrics: {}, historical: [] };

const pageNumber = {
  'Data Management': 0,
  Dashboard: 1,
  'Sales Analysis': 4,
  Products: 3,
  Categories: 2,
  Customers: 5,
  'Revenue & Profit': 6,
  'Seasonal Analysis': 7,
  'Revenue Prediction': 8,
  'Model Comparison': 9,
  EDA: 10,
  Reports: 12,
  Admin: 13,
  Settings: 14,
  Logout: 15
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const formatNumber = (value) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value || 0);

const getPasswordStrength = (password) => {
  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
  return checks <= 2 ? 'Weak' : checks <= 4 ? 'Good' : 'Strong';
};

const StatCard = ({ label, value, icon: Icon, accent = '#1f6feb' }) => (
  <div className="stat-card">
    <div className="stat-card-header">
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
      </div>
      <div className="stat-icon" style={{ background: `${accent}1f` }}>
        <Icon size={20} color={accent} />
      </div>
    </div>
  </div>
);

const BrandMark = ({ large = false }) => (
  <div className={`brand-mark${large ? ' large' : ''}`} aria-hidden="true">
    <span>R</span>
    <TrendingUp className="brand-mark-arrow" size={large ? 15 : 17} />
  </div>
);

const SectionCard = ({ title, subtitle, children }) => (
  <div className="panel">
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        <small>{subtitle}</small>
      </div>
    </div>
    {children}
  </div>
);

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activePage, setActivePage] = useState('Data Management');
  const [loading, setLoading] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [predictionError, setPredictionError] = useState('');
  const [demoData, setDemoData] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [filters, setFilters] = useState({
    range: 'all',
    startDate: '',
    endDate: '',
    product: '',
    category: '',
    region: '',
    search: ''
  });
  const [preferences, setPreferences] = useState({ theme: 'light', notificationsEnabled: true });
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [profileName, setProfileName] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authView, setAuthView] = useState('default');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [authMessage, setAuthMessage] = useState({ type: '', text: '' });
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [resetToken, setResetToken] = useState('');
  const [dashboard, setDashboard] = useState({
    summary: {
      totalRevenue: 0,
      totalProfit: 0,
      totalOrders: 0,
      totalQuantity: 0,
      avgOrderValue: 0
    },
    revenueTrend: [],
    salesTrend: [],
    categoryBreakdown: [],
    productPerformance: [],
    customerData: [],
    seasonalPattern: []
  });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('Electronics');
  const [selectedProductCategory, setSelectedProductCategory] = useState('');
  const [customers, setCustomers] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [modelMetrics, setModelMetrics] = useState(emptyModelMetrics);
  const [predictionResult, setPredictionResult] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvStatus, setCsvStatus] = useState('');
  const browsableProducts = useMemo(() => {
    const catalogProducts = CATEGORY_TAXONOMY.flatMap((category) => (
      category.subcategories.flatMap((subcategory) => subcategory.items.map((productName) => ({
        productName,
        category: category.category,
        subcategory: subcategory.name,
        quantity: 0,
        revenue: 0,
        profit: 0,
        avgPrice: 0,
        performance: 'No matching sales'
      })))
    ));
    const productMap = new Map(
      catalogProducts.map((product) => [
        `${product.category.toLowerCase()}:${product.productName.toLowerCase()}`,
        product
      ])
    );

    products.forEach((product) => {
      const key = `${product.category.toLowerCase()}:${product.productName.toLowerCase()}`;
      const catalogProduct = productMap.get(key);
      productMap.set(key, {
        ...catalogProduct,
        ...product,
        subcategory: catalogProduct?.subcategory || 'Other'
      });
    });

    return [...productMap.values()];
  }, [products]);
  const visibleProducts = useMemo(
    () => browsableProducts.filter((product) => (
      !selectedProductCategory || product.category === selectedProductCategory
    )),
    [browsableProducts, selectedProductCategory]
  );
  const productsWithSales = visibleProducts
    .filter((product) => product.revenue > 0)
    .sort((left, right) => right.revenue - left.revenue);
  const filterParams = useMemo(() => Object.fromEntries(
    Object.entries(filters)
      .filter(([key, value]) => key !== 'range' && value !== '')
  ), [filters]);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [predictionForm, setPredictionForm] = useState({ period: 'Next 3 Months' });

  const loadDashboard = async (params = filterParams) => {
    setLoading(true);
    setError('');
    try {
      const [dashboardData, revenueData, profitData, productData, categoryData, customerData, seasonalData, modelData, salesData] = await Promise.all([
        fetchDashboard(params),
        fetchRevenueAnalysis(params),
        fetchProfitAnalysis(params),
        fetchProducts(params),
        fetchCategories(params),
        fetchCustomers(params),
        fetchSeasonalAnalysis(params),
        fetchModelMetrics().catch(() => ({ data: emptyModelMetrics })),
        fetchSales(params)
      ]);

      const nextSummary = dashboardData?.summary || {
        totalRevenue: 0,
        totalProfit: 0,
        totalOrders: 0,
        totalQuantity: 0,
        avgOrderValue: 0
      };

      const revenueTrend = revenueData?.data || [];
      const latestRevenue = revenueTrend.at(-1)?.revenue;
      const previousRevenue = revenueTrend.at(-2)?.revenue;
      setDashboard({
        summary: {
          ...nextSummary,
          revenueGrowth: previousRevenue > 0 ? ((latestRevenue - previousRevenue) / previousRevenue) * 100 : null
        },
        revenueTrend,
        salesTrend: salesData?.data?.map((row) => ({ month: row.orderDate?.slice(0, 7) || row.month, sales: row.quantity || row.sales || 0 })) || [],
        categoryBreakdown: categoryData?.data || [],
        productPerformance: productData?.data || [],
        customerData: customerData?.data || [],
        seasonalPattern: seasonalData?.data || []
      });

      setProducts(productData?.data || []);
      setCategories(categoryData?.data || []);
      setCustomers(customerData?.data || []);
      setModelMetrics(modelData?.data || emptyModelMetrics);
      setSalesRows(salesData?.data || []);
      setDemoData(Boolean(dashboardData?.demoData || salesData?.demoData));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load analytics from the backend. Please try again.');
      setDashboard({
        summary: { totalRevenue: 0, totalProfit: 0, totalOrders: 0, totalQuantity: 0, avgOrderValue: 0 },
        revenueTrend: [],
        salesTrend: [],
        categoryBreakdown: [],
        productPerformance: [],
        customerData: [],
        seasonalPattern: []
      });
      setProducts([]);
      setCategories([]);
      setCustomers([]);
      setSalesRows([]);
      setModelMetrics(emptyModelMetrics);
      setDemoData(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      loadDashboard();
    }
  }, [authenticated, filterParams]);

  const homeDashboard = dashboard;

  const datasetAnalysis = useMemo(() => {
    const rows = salesRows;
    const missingValues = rows.reduce((count, row) => count + ['orderId', 'orderDate', 'productName', 'quantity', 'sales', 'profit']
      .filter((field) => row[field] === undefined || row[field] === null || row[field] === '').length, 0);
    const seen = new Set();
    let duplicateRecords = 0;
    rows.forEach((row) => {
      const key = row.orderId || [row.orderDate, row.productName, row.quantity, row.sales].join('|');
      if (seen.has(key)) duplicateRecords += 1;
      seen.add(key);
    });

    const average = (field) => rows.length
      ? rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length
      : 0;
    const standardDeviation = (field) => {
      if (!rows.length) return 0;
      const mean = average(field);
      return Math.sqrt(rows.reduce((sum, row) => sum + (Number(row[field] || 0) - mean) ** 2, 0) / rows.length);
    };
    const revenueMean = average('sales');
    const profitMean = average('profit');
    const covariance = rows.reduce((sum, row) => sum + (Number(row.sales || 0) - revenueMean) * (Number(row.profit || 0) - profitMean), 0);
    const revenueVariance = rows.reduce((sum, row) => sum + (Number(row.sales || 0) - revenueMean) ** 2, 0);
    const profitVariance = rows.reduce((sum, row) => sum + (Number(row.profit || 0) - profitMean) ** 2, 0);
    const chronologicalRows = [...rows].sort((left, right) => new Date(left.orderDate) - new Date(right.orderDate));

    return {
      missingValues,
      duplicateRecords,
      correlation: revenueVariance && profitVariance ? covariance / Math.sqrt(revenueVariance * profitVariance) : 0,
      mean: { sales: revenueMean, profit: profitMean, quantity: average('quantity'), discount: average('discount') },
      standardDeviation: { sales: standardDeviation('sales'), profit: standardDeviation('profit'), quantity: standardDeviation('quantity'), discount: standardDeviation('discount') },
      trend: chronologicalRows.length > 1
        ? Number(chronologicalRows.at(-1).sales || 0) >= Number(chronologicalRows[0].sales || 0) ? 'Positive' : 'Negative'
        : 'Insufficient data'
    };
  }, [salesRows]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      clearStoredAuth();
      try {
        const response = await me();
        setCurrentUser(response.user);
        setProfileName(response.user.name || '');
        setPreferences({
          theme: response.user.preferences?.theme || 'light',
          notificationsEnabled: Boolean(response.user.preferences?.notificationsEnabled ?? true)
        });
        setAuthenticated(true);
      } catch {
        setAuthenticated(false);
      } finally {
        setAuthReady(true);
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    const expireSession = () => {
      setAuthenticated(false);
      setCurrentUser(null);
      setAuthReady(true);
      setActivePage('Data Management');
      setActionMessage({ type: 'error', text: 'Your session expired. Please sign in again.' });
    };
    window.addEventListener('revora:session-expired', expireSession);
    return () => window.removeEventListener('revora:session-expired', expireSession);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  useEffect(() => {
    if (!authenticated || activePage !== 'Admin' || currentUser?.role !== 'admin') return;
    setAdminLoading(true);
    fetchAdminUsers()
      .then((response) => setAdminUsers(response.data || []))
      .catch((err) => setActionMessage({ type: 'error', text: err.response?.data?.message || 'Unable to load administrator tools.' }))
      .finally(() => setAdminLoading(false));
  }, [authenticated, activePage, currentUser?.role]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setAuthView('reset');
      setAuthMode('login');
    }
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;

    const closeProfileMenu = (event) => {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setProfileMenuOpen(false);
      } else if (event.type === 'pointerdown' && !profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', closeProfileMenu);
    document.addEventListener('pointerdown', closeProfileMenu);
    return () => {
      document.removeEventListener('keydown', closeProfileMenu);
      document.removeEventListener('pointerdown', closeProfileMenu);
    };
  }, [profileMenuOpen]);

  const handleLogin = async (event) => {
    event.preventDefault();
    const email = authForm.email.trim();
    const password = authForm.password;

    if (!email || !password) {
      setAuthMessage({ type: 'error', text: 'Please enter both your email and password to continue.' });
      return;
    }

    setLoading(true);
    setAuthMessage({ type: '', text: '' });

    try {
      const response = await loginUser({ email, password, rememberMe });
      setCurrentUser(response.user);
      setProfileName(response.user.name || '');
      const session = await me();
      setPreferences({
        theme: session.user.preferences?.theme || 'light',
        notificationsEnabled: Boolean(session.user.preferences?.notificationsEnabled ?? true)
      });
      setAuthenticated(true);
      setActivePage('Data Management');
      setAuthForm({ name: '', email: '', password: '', confirmPassword: '' });
      setAuthMessage({ type: 'success', text: 'Login successful. Redirecting to the dashboard...' });
    } catch (error) {
      setAuthMessage({ type: 'error', text: error.response?.data?.message || 'Invalid email or password.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const name = authForm.name.trim();
    const email = authForm.email.trim();
    const password = authForm.password;
    const confirmPassword = authForm.confirmPassword;

    if (!name || !email || !password || !confirmPassword) {
      setAuthMessage({ type: 'error', text: 'Please complete all registration fields.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    if (password.length < 8) {
      setAuthMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      setAuthMessage({ type: 'error', text: 'Passwords do not match. Please try again.' });
      return;
    }

    setLoading(true);
    setAuthMessage({ type: '', text: '' });

    try {
      const response = await registerUser({ name, email, password, confirmPassword });
      setCurrentUser(response.user);
      setProfileName(response.user.name || '');
      setPreferences({ theme: 'light', notificationsEnabled: true });
      setAuthenticated(true);
      setActivePage('Data Management');
      setAuthForm({ name: '', email: '', password: '', confirmPassword: '' });
    } catch (error) {
      setAuthMessage({ type: 'error', text: error.response?.data?.message || 'Unable to register a new account.' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    const email = authForm.email.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthMessage({ type: 'error', text: 'Please enter a valid registered email address.' });
      return;
    }

    setLoading(true);
    setAuthMessage({ type: '', text: '' });
    try {
      const response = await requestPasswordReset(email);
      setAuthMessage({
        type: 'success',
        text: response.message || 'If an account exists, a password reset link has been sent.'
      });
      setAuthForm({ ...authForm, email: email });
      setAuthView('default');
      setAuthMode('login');
    } catch (error) {
      setAuthMessage({ type: 'error', text: error.response?.data?.message || 'Unable to process the password reset request.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    const newPassword = authForm.password;
    const confirmPassword = authForm.confirmPassword;

    if (!newPassword || !confirmPassword) {
      setAuthMessage({ type: 'error', text: 'Please enter and confirm the new password.' });
      return;
    }

    if (newPassword.length < 8) {
      setAuthMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setAuthMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    if (!resetToken) {
      setAuthMessage({ type: 'error', text: 'The password reset token is missing or invalid.' });
      return;
    }

    setLoading(true);
    setAuthMessage({ type: '', text: '' });

    try {
      const response = await resetPassword({ token: resetToken, newPassword, confirmPassword });
      setAuthMessage({ type: 'success', text: response.message || 'Password reset successful. You can log in with your new password.' });
      setAuthForm({ name: '', email: '', password: '', confirmPassword: '' });
      setResetToken('');
      setAuthView('default');
      setAuthMode('login');
      window.history.replaceState({}, '', '/');
    } catch (error) {
      setAuthMessage({ type: 'error', text: error.response?.data?.message || 'Invalid or expired reset token.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    try {
      await logoutUser();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Unable to confirm sign out with the server.' });
    } finally {
      setAuthenticated(false);
      setCurrentUser(null);
      setActivePage('Data Management');
      setAuthForm({ name: '', email: '', password: '', confirmPassword: '' });
      setAuthMode('login');
      setAuthView('default');
      setResetToken('');
      window.history.replaceState({}, '', '/');
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setActionMessage({ type: '', text: '' });
    try {
      const response = await updateProfile({ name: profileName });
      setCurrentUser((user) => ({ ...user, ...response.user }));
      setActionMessage({ type: 'success', text: response.message });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Unable to save profile.' });
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setActionMessage({ type: '', text: '' });
    try {
      const response = await updatePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setActionMessage({ type: 'success', text: response.message });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Unable to change password.' });
    }
  };

  const handlePreferenceChange = async (nextPreferences) => {
    setActionMessage({ type: '', text: '' });
    try {
      const response = await updatePreferences(nextPreferences);
      setPreferences(response.preferences);
      setCurrentUser((user) => ({ ...user, preferences: response.preferences }));
      setActionMessage({ type: 'success', text: response.message });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Unable to save preferences.' });
    }
  };

  const handleRoleChange = async (userId, role) => {
    setActionMessage({ type: '', text: '' });
    try {
      const response = await updateUserRole(userId, role);
      setAdminUsers((users) => users.map((user) => user.id === userId ? { ...user, role: response.role } : user));
      setActionMessage({ type: 'success', text: response.message });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Unable to update user role.' });
    }
  };

  const setDateRange = (range) => {
    const end = new Date();
    const start = new Date(end);
    if (range === '7d') start.setDate(start.getDate() - 6);
    if (range === '30d') start.setDate(start.getDate() - 29);
    if (range === '90d') start.setDate(start.getDate() - 89);
    if (range === 'year') start.setMonth(0, 1);
    const toDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setFilters((current) => ({
      ...current,
      range,
      startDate: range === 'all' || range === 'custom' ? '' : toDateString(start),
      endDate: range === 'all' || range === 'custom' ? '' : toDateString(end)
    }));
  };

  const handlePrediction = async (event) => {
    event.preventDefault();
    setPredictionLoading(true);
    setPredictionError('');
    setPredictionResult(null);
    try {
      const response = await submitPrediction(predictionForm);
      setPredictionResult(response);
    } catch (err) {
      setPredictionError(err.response?.data?.message || 'Unable to generate a forecast. Check that the prediction service is running and try again.');
    } finally {
      setPredictionLoading(false);
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCsvText(await file.text());
      setCsvStatus(`${file.name} is ready to process.`);
      setError('');
    } catch {
      setCsvStatus('Unable to read this file. Choose a valid CSV file and try again.');
    }
  };

  const downloadCsvTemplate = () => {
    const csv = [
      'order_id,order_date,product_name,category,quantity_sold,sales_revenue,unit_price,discount,customer_name,profit,promotion_details,region',
      'SO-2001,2026-01-15,Example product,Electronics,2,200,100,0,Example customer,40,Launch offer,North'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'revora-sales-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleProcessCsv = async () => {
    if (!csvText.trim()) {
      setCsvStatus('Choose a CSV file or paste CSV content before processing.');
      return;
    }

    setCsvProcessing(true);
    setCsvStatus('');
    setError('');
    try {
      const response = await uploadCsv(csvText);
      if (!response?.rowsAdded) {
        throw new Error('The CSV did not contain any valid sales rows.');
      }
      await loadDashboard();
      setCsvText('');
      setCsvStatus('');
      setActionMessage({
        type: 'success',
        text: `${response.rowsAdded} CSV ${response.rowsAdded === 1 ? 'row' : 'rows'} imported. Revenue analytics refreshed.`
      });
      setActivePage('Data Management');
    } catch (err) {
      setCsvStatus(err.response?.data?.message || err.message || 'CSV processing failed. Check the columns and try again.');
    } finally {
      setCsvProcessing(false);
    }
  };

  const exportSalesCsv = () => {
    if (!salesRows.length) {
      setActionMessage({ type: 'error', text: 'There are no filtered sales records to export.' });
      return;
    }
    const fields = [
      ['Order ID', 'orderId'],
      ['Order Date', 'orderDate'],
      ['Product', 'productName'],
      ['Category', 'category'],
      ['Quantity', 'quantity'],
      ['Revenue', 'sales'],
      ['Profit', 'profit'],
      ['Customer', 'customerName'],
      ['Region', 'region']
    ];
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      fields.map(([label]) => escapeCsv(label)).join(','),
      ...salesRows.map((row) => fields.map(([, key]) => escapeCsv(row[key])).join(','))
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `revora-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setActionMessage({ type: 'success', text: `Exported ${salesRows.length} filtered sales records.` });
  };

  const notificationItems = useMemo(() => {
    if (!preferences.notificationsEnabled) return [];
    const growth = dashboard.summary.revenueGrowth;
    if (!salesRows.length || growth === null || growth === undefined) {
      return [{ title: 'More sales history needed', detail: 'Revenue comparisons appear when multiple periods are available.' }];
    }
    return [{
      title: growth > 0 ? 'Revenue increased' : growth < 0 ? 'Revenue decreased' : 'Revenue was unchanged',
      detail: `Monthly revenue changed ${Math.abs(growth).toFixed(1)}% between the latest available periods.`
    }];
  }, [dashboard.summary.revenueGrowth, preferences.notificationsEnabled, salesRows.length]);

  const kpis = useMemo(
    () => [
      { label: 'Total Revenue', value: salesRows.length ? formatCurrency(homeDashboard.summary.totalRevenue) : '--', icon: CircleDollarSign, accent: '#1f6feb' },
      { label: 'Total Profit', value: salesRows.length ? formatCurrency(homeDashboard.summary.totalProfit) : '--', icon: TrendingUp, accent: '#14b8a6' },
      { label: 'Total Orders', value: salesRows.length ? formatNumber(homeDashboard.summary.totalOrders) : '--', icon: ShoppingCart, accent: '#f59e0b' },
      { label: 'Total Sales', value: salesRows.length ? formatNumber(homeDashboard.summary.totalQuantity) : '--', icon: Package, accent: '#8b5cf6' },
      { label: 'Average Order Value', value: salesRows.length ? formatCurrency(homeDashboard.summary.avgOrderValue) : '--', icon: Activity, accent: '#ef4444' },
      { label: 'Revenue Growth', value: homeDashboard.summary.revenueGrowth === null || homeDashboard.summary.revenueGrowth === undefined ? '--' : `${homeDashboard.summary.revenueGrowth.toFixed(1)}%`, icon: BriefcaseBusiness, accent: '#10b981' }
    ],
    [homeDashboard.summary]
  );

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return (
          <>
            <div className="section-grid four">
              {kpis.map(({ label, value, icon, accent }) => (
                <StatCard key={label} label={label} value={value} icon={icon} accent={accent} />
              ))}
            </div>

            <div className="chart-grid two">
              <SectionCard title="Monthly Revenue Trend" subtitle="Revenue growth over the reporting period">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={homeDashboard.revenueTrend}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#1f6feb" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#1f6feb" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="revenue" stroke="#1f6feb" fill="url(#revenueFill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Monthly Sales Trend" subtitle="Order volumes by month">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={homeDashboard.salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatNumber(value)} />
                      <Bar dataKey="sales" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <div className="chart-grid three">
              <SectionCard title="Revenue vs Profit" subtitle="Operating margin comparison">
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={homeDashboard.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#1f6feb" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="profit" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Category-wise Revenue" subtitle="Contribution by business segment">
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={categories} dataKey="revenue" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={5}>
                        {categories.map((entry, index) => (
                          <Cell key={`${entry.category}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Product-wise Sales" subtitle="Top product contribution">
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={products.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="productName" type="category" width={90} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
          </>
        );
      case 'Sales Analysis':
        return (
          <>
            <div className="toolbar-row">
              <div className="search-box">
                <Search size={16} />
                <input
                  aria-label="Search sales records"
                  placeholder="Search orders, products, customers"
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                />
              </div>
            </div>

            <div className="chart-grid two">
              <SectionCard title="Daily Sales" subtitle="Revenue performance across the selected range">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dashboard.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="revenue" stroke="#1f6feb" strokeWidth={3} dot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Weekly Sales Profile" subtitle="Quantity sold and order flow">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dashboard.salesTrend}>
                      <defs>
                        <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatNumber(value)} />
                      <Area type="monotone" dataKey="sales" stroke="#14b8a6" fill="url(#salesArea)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Sales Records" subtitle="Historical transactions and order metrics">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Product</th>
                      <th>Date</th>
                      <th>Quantity</th>
                      <th>Revenue</th>
                      <th>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesRows.slice(0, 7).map((row, index) => (
                      <tr key={`${row.productName || 'row'}-${index}`}>
                        <td>{row.orderId || '--'}</td>
                        <td>{row.productName || row.category || '--'}</td>
                        <td>{row.orderDate || '--'}</td>
                        <td>{row.quantity ?? row.totalQuantity ?? '--'}</td>
                        <td>{formatCurrency(row.sales || row.revenue || 0)}</td>
                        <td>{formatCurrency(row.profit || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );
      case 'Products':
        return (
          <>
            <SectionCard title="Browse Products" subtitle="Select a category to see its products">
              <label className="category-picker">
                <span>Product category</span>
                <select
                  aria-label="Filter products by category"
                  value={selectedProductCategory}
                  onChange={(event) => setSelectedProductCategory(event.target.value)}
                >
                  <option value="">All products</option>
                  {[...new Set([
                    ...CATEGORY_TAXONOMY.map((item) => item.category),
                    ...products.map((item) => item.category).filter(Boolean)
                  ])].map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
            </SectionCard>

            <div className="chart-grid two">
              <SectionCard title="Top Performing Products" subtitle="Revenue and quantity contribution">
                <div className="chart-wrap large">
                  {productsWithSales.length ? (
                    <ResponsiveContainer width="100%" height={290}>
                      <BarChart data={productsWithSales.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="productName" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#1f6feb" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="empty-copy">No sales match this category and the current filters.</p>}
                </div>
              </SectionCard>

              <SectionCard title="Product Quantity" subtitle="Units moved by product">
                <div className="chart-wrap large">
                  {productsWithSales.length ? (
                    <ResponsiveContainer width="100%" height={290}>
                      <LineChart data={productsWithSales.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="productName" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatNumber(value)} />
                        <Line type="monotone" dataKey="quantity" stroke="#14b8a6" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <p className="empty-copy">No sales match this category and the current filters.</p>}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title={selectedProductCategory ? `${selectedProductCategory} Products` : 'All Products'}
              subtitle={`${visibleProducts.length} catalog products${selectedProductCategory ? ` in ${selectedProductCategory}` : ' across all categories'}; sales figures follow the current filters`}
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Subcategory</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                      <th>Profit</th>
                      <th>Average Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((item, index) => (
                      <tr key={`${item.productName}-${index}`}>
                        <td>{item.productName}</td>
                        <td>{item.category || '--'}</td>
                        <td>{item.subcategory || '--'}</td>
                        <td>{item.quantity ?? '--'}</td>
                        <td>{formatCurrency(item.revenue || 0)}</td>
                        <td>{formatCurrency(item.profit || 0)}</td>
                        <td>{formatCurrency(item.avgPrice || item.revenue / (item.quantity || 1))}</td>
                        <td>{item.revenue > 0 ? item.performance || 'Selling' : 'No matching sales'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );
      case 'Categories':
        const selectedCategoryDetails = CATEGORY_TAXONOMY.find(
          (item) => item.category === selectedCatalogCategory
        );
        return (
          <>
            <SectionCard
              title="Category & Subcategory Catalog"
              subtitle="Choose a category to explore its product types and examples"
            >
              <div className="category-catalog">
                <label className="category-picker">
                  <span>Main category</span>
                  <select
                    aria-label="Choose a category to view its subcategories"
                    value={selectedCatalogCategory}
                    onChange={(event) => setSelectedCatalogCategory(event.target.value)}
                  >
                    {CATEGORY_TAXONOMY.map((item) => (
                      <option key={item.category} value={item.category}>{item.category}</option>
                    ))}
                  </select>
                </label>
                {selectedCategoryDetails && (
                  <>
                    <div className="category-catalog-heading">
                      <h4>{selectedCategoryDetails.category}</h4>
                      <p>{selectedCategoryDetails.description}</p>
                    </div>
                    <div className="subcategory-grid">
                      {selectedCategoryDetails.subcategories.map((subcategory) => (
                        <article className="subcategory-card" key={subcategory.name}>
                          <h5>{subcategory.name}</h5>
                          <ul>
                            {subcategory.items.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </SectionCard>

            <div className="chart-grid two">
              <SectionCard title="Category Revenue" subtitle="Segment contribution by revenue">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={290}>
                    <BarChart data={categories}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="revenue" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Category Profit Comparison" subtitle="Margin comparison across categories">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={290}>
                    <PieChart>
                      <Pie data={categories} dataKey="profit" nameKey="category" innerRadius={50} outerRadius={90}>
                        {categories.map((entry, index) => (
                          <Cell key={`${entry.category}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Category Summary" subtitle="Performance by category">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Total Sales</th>
                      <th>Revenue</th>
                      <th>Profit</th>
                      <th>Qty Sold</th>
                      <th>Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((item) => (
                      <tr key={item.category}>
                        <td>{item.category}</td>
                        <td>{formatNumber(item.quantity || 0)}</td>
                        <td>{formatCurrency(item.revenue || 0)}</td>
                        <td>{formatCurrency(item.profit || 0)}</td>
                        <td>{item.quantity || 0}</td>
                        <td>{Math.round(((item.revenue || 0) / categories.reduce((sum, c) => sum + (c.revenue || 0), 0)) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );
      case 'Customers':
        return (
          <>
            <div className="chart-grid two">
              <SectionCard title="Customer Spending" subtitle="High-value buyers and total spend">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={290}>
                    <BarChart data={customers}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="customerName" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="totalSpending" fill="#1f6feb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Purchase Frequency" subtitle="Order repeat behavior by customer">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={290}>
                    <AreaChart data={customers}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="customerName" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value}x`} />
                      <Area type="monotone" dataKey="purchaseFrequency" stroke="#14b8a6" fill="#ccfbf1" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Customer Insights" subtitle="Purchase behavior snapshot">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Orders</th>
                      <th>Qty Purchased</th>
                      <th>Total Spending</th>
                      <th>Average Order</th>
                      <th>Purchase Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((item) => (
                      <tr key={item.customerName}>
                        <td>{item.customerName}</td>
                        <td>{item.orders}</td>
                        <td>{item.totalQuantity}</td>
                        <td>{formatCurrency(item.totalSpending)}</td>
                        <td>{formatCurrency(item.avgOrderValue)}</td>
                        <td>{item.purchaseFrequency}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );
      case 'Revenue & Profit':
        return (
          <>
            <div className="section-grid four">
              <StatCard label="Total Revenue" value={salesRows.length ? formatCurrency(dashboard.summary.totalRevenue) : '--'} icon={CircleDollarSign} accent="#1f6feb" />
              <StatCard label="Total Profit" value={salesRows.length ? formatCurrency(dashboard.summary.totalProfit) : '--'} icon={TrendingUp} accent="#14b8a6" />
              <StatCard label="Profit Margin" value={salesRows.length && dashboard.summary.totalRevenue ? `${((dashboard.summary.totalProfit / dashboard.summary.totalRevenue) * 100).toFixed(1)}%` : '--'} icon={Percent} accent="#f59e0b" />
              <StatCard label="Revenue Growth" value={homeDashboard.summary.revenueGrowth === null || homeDashboard.summary.revenueGrowth === undefined ? '--' : `${homeDashboard.summary.revenueGrowth.toFixed(1)}%`} icon={BriefcaseBusiness} accent="#8b5cf6" />
            </div>

            <div className="chart-grid two">
              <SectionCard title="Revenue Trend" subtitle="Revenue growth by month">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={290}>
                    <LineChart data={dashboard.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="revenue" stroke="#1f6feb" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Profit Trend" subtitle="Operating profit trend">
                <div className="chart-wrap large">
                  <ResponsiveContainer width="100%" height={290}>
                    <LineChart data={dashboard.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="profit" stroke="#14b8a6" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
          </>
        );
      case 'Seasonal Analysis':
        return (
          <>
            <SectionCard title="Seasonal Trend" subtitle="Revenue pattern by season">
              <div className="chart-wrap large">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dashboard.seasonalPattern}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="season" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill="#1f6feb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <div className="feature-grid">
              {dashboard.seasonalPattern.map((item) => (
                <div className="feature-box" key={item.season}>
                  <h4>{item.season}</h4>
                  <p>{formatCurrency(item.revenue)}</p>
                  <small>{formatCurrency(item.profit)} profit</small>
                </div>
              ))}
            </div>
          </>
        );
      case 'Revenue Prediction':
        return (
          <>
            <div className="two-column-form">
              <SectionCard title="Prediction Inputs" subtitle="Forecast the next months using observed sales history">
                <form className="form-grid" onSubmit={handlePrediction}>
                  <label>
                    Prediction period
                    <select value={predictionForm.period} onChange={(e) => setPredictionForm({ ...predictionForm, period: e.target.value })}>
                      <option>Next 3 Months</option>
                      <option>Next 6 Months</option>
                      <option>Next 12 Months</option>
                    </select>
                  </label>
                  <button className="primary-btn" type="submit" disabled={predictionLoading}>
                    {predictionLoading ? 'Generating...' : 'Generate Forecast'}
                  </button>
                </form>
              </SectionCard>

              <SectionCard title="Predicted Revenue" subtitle="Current forecast output">
                <div className="prediction-panel">
                  <div className="prediction-amount">
                    {predictionResult ? formatCurrency(predictionResult.predictedRevenue || predictionResult.totalRevenue || 0) : '--'}
                  </div>
                  <div className="metric-list">
                    <div><span>Model</span><strong>{predictionResult?.bestModel || '--'}</strong></div>
                    <div><span>Prediction Range</span><strong>{predictionResult?.predictionRange ? `${formatCurrency(predictionResult.predictionRange.low)} - ${formatCurrency(predictionResult.predictionRange.high)}` : '--'}</strong></div>
                    <div><span>Forecast Period</span><strong>{predictionResult?.forecastPeriod || '--'}</strong></div>
                  </div>
                  {predictionResult?.note && <p className="muted-copy" role="status">{predictionResult.note}</p>}
                  {predictionError && <div className="error-banner" role="alert">{predictionError}</div>}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Actual vs Predicted Revenue" subtitle="Forecast validation chart">
              <div className="chart-wrap large">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={predictionResult?.history?.length ? predictionResult.history : modelMetrics?.historical || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="actual" stroke="#1f6feb" strokeWidth={3} />
                    <Line type="monotone" dataKey="predicted" stroke="#14b8a6" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </>
        );
      case 'Model Comparison':
        return (
          <>
            <SectionCard title="Model Evaluation" subtitle="Trained on the bundled sample dataset; not production data">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>MAE</th>
                      <th>RMSE</th>
                      <th>MAPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(modelMetrics?.metrics || {}).map(([name, values]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{values.MAE}</td>
                        <td>{values.RMSE}</td>
                        <td>{values.MAPE}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Actual vs Predicted Revenue" subtitle="Forecast accuracy comparison across selected model outputs">
              <div className="chart-wrap large">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={modelMetrics?.historical || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="actual" stroke="#1f6feb" fill="#dbeafe" />
                    <Area type="monotone" dataKey="predicted" stroke="#14b8a6" fill="#dcfce7" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </>
        );
      case 'EDA':
        return (
          <>
            <div className="section-grid four">
              <StatCard label="Dataset Rows" value={String(salesRows.length)} icon={FileText} accent="#1f6feb" />
              <StatCard label="Missing Values" value={String(datasetAnalysis.missingValues)} icon={ShieldCheck} accent="#14b8a6" />
              <StatCard label="Duplicate Records" value={String(datasetAnalysis.duplicateRecords)} icon={Search} accent="#f59e0b" />
              <StatCard label="Correlation" value={datasetAnalysis.correlation.toFixed(2)} icon={Activity} accent="#8b5cf6" />
            </div>

            <SectionCard title="Statistical Overview" subtitle="EDA summary for uploaded dataset">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Revenue</th>
                      <th>Profit</th>
                      <th>Quantity</th>
                      <th>Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Mean</td>
                      <td>{formatCurrency(datasetAnalysis.mean.sales)}</td>
                      <td>{formatCurrency(datasetAnalysis.mean.profit)}</td>
                      <td>{datasetAnalysis.mean.quantity.toFixed(1)}</td>
                      <td>{datasetAnalysis.mean.discount.toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td>Standard Deviation</td>
                      <td>{formatCurrency(datasetAnalysis.standardDeviation.sales)}</td>
                      <td>{formatCurrency(datasetAnalysis.standardDeviation.profit)}</td>
                      <td>{datasetAnalysis.standardDeviation.quantity.toFixed(1)}</td>
                      <td>{datasetAnalysis.standardDeviation.discount.toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td>Trend</td>
                      <td>{datasetAnalysis.trend}</td>
                      <td>{datasetAnalysis.trend}</td>
                      <td>{datasetAnalysis.trend}</td>
                      <td>{datasetAnalysis.trend}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );
      case 'Data Management':
        return (
          <>
            <div className="two-column-form">
              <SectionCard title="Upload Dataset" subtitle="Add CSV records to the working sales dataset">
                <div className="upload-box">
                  <p className="muted-copy">Required fields: order ID, date (YYYY-MM-DD), product, category, quantity, revenue, customer, and profit. Duplicate order IDs are rejected; imports never overwrite sales.</p>
                  <button type="button" className="secondary-btn" onClick={downloadCsvTemplate}>
                    <Download size={16} /> Download CSV template
                  </button>
                  <input type="file" accept=".csv" onChange={handleCsvUpload} />
                  <textarea
                    value={csvText}
                    onChange={(event) => {
                      setCsvText(event.target.value);
                      setCsvStatus('');
                    }}
                    placeholder="Paste CSV content here or upload a file"
                  />
                  <button type="button" className="primary-btn" onClick={handleProcessCsv} disabled={csvProcessing || !csvText.trim()}>
                    {csvProcessing ? 'Processing CSV...' : 'Process CSV'}
                  </button>
                  {csvStatus && <p className="csv-status" role="status">{csvStatus}</p>}
                </div>
              </SectionCard>

              <SectionCard title="Dataset Overview" subtitle="Current loaded records">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Product</th>
                        <th>Revenue</th>
                        <th>Region</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesRows.slice(0, 6).map((row, index) => (
                        <tr key={`${row.orderId || 'csv'}-${index}`}>
                          <td>{row.orderId || `SO-${index + 1}`}</td>
                          <td>{row.productName || 'Uploaded Product'}</td>
                          <td>{formatCurrency(row.sales || row.revenue || 0)}</td>
                          <td>{row.region || 'Central'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </>
        );
      case 'Settings':
        return (
          <>
            <SectionCard title="Profile settings" subtitle="Manage your REVORA account details">
              <form className="form-grid profile-form" onSubmit={handleSaveProfile}>
                <label>
                  Full name
                  <input value={profileName} maxLength={255} required onChange={(event) => setProfileName(event.target.value)} />
                </label>
                <label>
                  Email address
                  <input value={currentUser?.email || ''} readOnly />
                </label>
                <label>
                  Account role
                  <input value={currentUser?.role || 'user'} readOnly />
                </label>
                <button className="primary-btn" type="submit">Save profile</button>
              </form>
            </SectionCard>

            <SectionCard title="Change password" subtitle="Verify your current password before choosing a new one">
              <form className="form-grid" onSubmit={handleChangePassword}>
                <label>
                  Current password
                  <input type="password" autoComplete="current-password" value={passwordForm.currentPassword} required onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
                </label>
                <label>
                  New password
                  <input type="password" autoComplete="new-password" minLength={8} value={passwordForm.newPassword} required onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
                </label>
                <label>
                  Confirm new password
                  <input type="password" autoComplete="new-password" minLength={8} value={passwordForm.confirmPassword} required onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} />
                </label>
                <button className="primary-btn" type="submit">Update password</button>
              </form>
            </SectionCard>

            <SectionCard title="Preferences" subtitle="Choose your appearance and notification settings">
              <div className="settings-controls">
                <label>
                  Appearance
                  <select value={preferences.theme} onChange={(event) => handlePreferenceChange({ ...preferences, theme: event.target.value })}>
                     <option value="light">Light</option>
                    <option value="dark">Dark</option>
                     <option value="aurora">Aurora</option>
                  </select>
                </label>
                <label className="checkbox-row settings-checkbox">
                  <input type="checkbox" checked={Boolean(preferences.notificationsEnabled)} onChange={(event) => handlePreferenceChange({ ...preferences, notificationsEnabled: event.target.checked })} />
                  <span>Enable data-driven notifications</span>
                </label>
              </div>
            </SectionCard>
          </>
        );
      case 'Reports':
        return (
          <SectionCard title="Sales reports" subtitle="Exports include the current date, product, category, region, and search filters">
            <div className="report-printable">
              <div className="report-heading">
                <BrandMark />
                <div>
                  <strong>REVORA Intelligence</strong>
                  <p>Sales and revenue report · Generated {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="section-grid four">
                <StatCard label="Filtered Revenue" value={salesRows.length ? formatCurrency(dashboard.summary.totalRevenue) : '--'} icon={CircleDollarSign} />
                <StatCard label="Filtered Profit" value={salesRows.length ? formatCurrency(dashboard.summary.totalProfit) : '--'} icon={TrendingUp} accent="#159b81" />
                <StatCard label="Orders" value={formatNumber(dashboard.summary.totalOrders)} icon={ShoppingCart} accent="#d99418" />
                <StatCard label="Records" value={formatNumber(salesRows.length)} icon={FileText} accent="#8b5cf6" />
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Order</th><th>Date</th><th>Product</th><th>Category</th><th>Quantity</th><th>Revenue</th><th>Profit</th><th>Region</th></tr></thead>
                  <tbody>
                    {salesRows.map((row) => (
                      <tr key={row.id || row.orderId}>
                        <td>{row.orderId}</td><td>{row.orderDate}</td><td>{row.productName}</td><td>{row.category}</td>
                        <td>{row.quantity}</td><td>{formatCurrency(row.sales)}</td><td>{formatCurrency(row.profit)}</td><td>{row.region || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!salesRows.length && <p className="empty-copy">No sales match the selected report filters.</p>}
              </div>
            </div>
            <div className="report-actions no-print">
              <button type="button" className="primary-btn" onClick={exportSalesCsv} disabled={!salesRows.length}>
                <Download size={16} /> Download CSV (Excel-compatible)
              </button>
              <button type="button" className="secondary-btn" onClick={() => window.print()} disabled={!salesRows.length}>
                <Printer size={16} /> Print / Save as PDF
              </button>
            </div>
          </SectionCard>
        );
      case 'Admin':
        if (currentUser?.role !== 'admin') {
          return (
            <SectionCard title="Administrator access required" subtitle="User administration is restricted to administrators">
              <p className="muted-copy">You can continue to use the dashboard and view sales data. Contact an administrator if you need account permissions changed.</p>
            </SectionCard>
          );
        }
        return (
          <SectionCard title="User administration" subtitle="Manage account roles; changes are enforced by the API">
            {adminLoading ? <p className="loading-banner">Loading users...</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Role</th><th>Permissions</th></tr></thead>
                  <tbody>
                    {adminUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.name}</td><td>{user.email}</td>
                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>
                          <select aria-label={`Role for ${user.email}`} value={user.role} disabled={Number(user.id) === Number(currentUser?.id)} onChange={(event) => handleRoleChange(user.id, event.target.value)}>
                            <option value="user">User</option><option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>{user.role === 'admin' ? 'Manage users and sales data' : 'View analytics and forecasts'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!adminUsers.length && <p className="empty-copy">No user accounts found.</p>}
              </div>
            )}
          </SectionCard>
        );
      default:
        return null;
    }
  };

  if (!authenticated && authReady) {
    const isRegister = authMode === 'register';
    const isForgotPassword = authView === 'forgot';
    const isResetPassword = authView === 'reset';

    return (
      <div className="login-shell">
        <div className="login-card auth-card">
          <div className="login-brand">
            <BrandMark />
            <div>
              <h1>REVORA</h1>
              <p>Intelligence · Predict Growth. Power Success.</p>
            </div>
          </div>

          <div className="auth-toggle-row" role="tablist" aria-label="Authentication options">
            <button
              type="button"
              className={authMode === 'login' && !isRegister ? 'auth-tab active' : 'auth-tab'}
              onClick={() => {
                setAuthMode('login');
                setAuthView('default');
                setAuthMessage({ type: '', text: '' });
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={isRegister ? 'auth-tab active' : 'auth-tab'}
              onClick={() => {
                setAuthMode('register');
                setAuthView('default');
                setAuthMessage({ type: '', text: '' });
              }}
            >
              Register
            </button>
          </div>

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="login-form auth-form">
              <h2>Forgot password</h2>
              <p className="auth-subtitle">Enter the email associated with your account.</p>

              <label>
                Email address
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  placeholder="name@example.com"
                />
              </label>

              {authMessage.text && <div className={authMessage.type === 'error' ? 'error-banner login-error' : 'success-banner'}>{authMessage.text}</div>}

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>

              <button type="button" className="text-link-button" onClick={() => {
                setAuthView('default');
                setAuthMode('login');
                setAuthMessage({ type: '', text: '' });
              }}>
                Back to login
              </button>
            </form>
          ) : isResetPassword ? (
            <form onSubmit={handleResetPassword} className="login-form auth-form">
              <h2>Reset your password</h2>
              <p className="auth-subtitle">Choose a strong, new password for your account.</p>

              <label>
                New password
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={authForm.password}
                    onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  />
                  <button type="button" className="field-toggle" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <label>
                Confirm new password
                <div className="password-field">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={authForm.confirmPassword}
                    onChange={(event) => setAuthForm({ ...authForm, confirmPassword: event.target.value })}
                  />
                  <button type="button" className="field-toggle" onClick={() => setShowConfirmPassword((value) => !value)}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {authMessage.text && <div className={authMessage.type === 'error' ? 'error-banner login-error' : 'success-banner'}>{authMessage.text}</div>}

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Reset password'}
              </button>
            </form>
          ) : isRegister ? (
            <form onSubmit={handleRegister} className="login-form auth-form">
              <h2>Create account</h2>
              <p className="auth-subtitle">Register to access the dashboard and predictions.</p>

              <label>
                Full name
                <input
                  type="text"
                  autoComplete="name"
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  maxLength={255}
                  required
                />
              </label>

              <label>
                Email address
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  placeholder="name@example.com"
                />
              </label>

              <label>
                Password
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={authForm.password}
                    onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  />
                  <button type="button" className="field-toggle" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>
              <div className={`password-strength ${authForm.password ? getPasswordStrength(authForm.password).toLowerCase() : ''}`} aria-live="polite">
                <span>Password strength</span>
                <strong>{authForm.password ? getPasswordStrength(authForm.password) : 'At least 8 characters'}</strong>
              </div>

              <label>
                Confirm password
                <div className="password-field">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={authForm.confirmPassword}
                    onChange={(event) => setAuthForm({ ...authForm, confirmPassword: event.target.value })}
                  />
                  <button type="button" className="field-toggle" onClick={() => setShowConfirmPassword((value) => !value)}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {authMessage.text && <div className={authMessage.type === 'error' ? 'error-banner login-error' : 'success-banner'}>{authMessage.text}</div>}

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </button>

              <button
                type="button"
                className="secondary-btn"
                style={{ marginTop: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(54, 197, 240, 0.1)', color: '#0284c7', border: '1px solid #38bdf8', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => {
                  const demoUser = { id: 1, name: 'Admin User (Demo)', email: 'admin@salesdashboard.com', role: 'admin' };
                  setCurrentUser(demoUser);
                  setProfileName(demoUser.name);
                  setAuthenticated(true);
                  setActivePage('Dashboard');
                  setDemoData(true);
                }}
              >
                🚀 Explore Demo Dashboard (Instant Access)
              </button>

              <p className="auth-footer">
                Already have an account? <button type="button" className="text-link-button" onClick={() => { setAuthMode('login'); setAuthView('default'); setAuthMessage({ type: '', text: '' }); }}>Login</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="login-form auth-form">
              <h2>Welcome</h2>
              <p className="auth-subtitle">Turn sales data into intelligent business decisions.</p>

              <label>
                Email address
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  placeholder="name@example.com"
                />
              </label>

              <label>
                Password
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={authForm.password}
                    onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  />
                  <button type="button" className="field-toggle" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <div className="login-meta">
                <label className="checkbox-row">
                  <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe((value) => !value)} />
                  <span>Remember me</span>
                </label>
                <button type="button" className="text-link-button" onClick={() => {
                  setAuthView('forgot');
                  setAuthMessage({ type: '', text: '' });
                }}>
                  Forgot password?
                </button>
              </div>

              {authMessage.text && <div className={authMessage.type === 'error' ? 'error-banner login-error' : 'success-banner'}>{authMessage.text}</div>}

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Login'}
              </button>

              <button
                type="button"
                className="secondary-btn"
                style={{ marginTop: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(54, 197, 240, 0.1)', color: '#0284c7', border: '1px solid #38bdf8', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => {
                  const demoUser = { id: 1, name: 'Admin User (Demo)', email: 'admin@salesdashboard.com', role: 'admin' };
                  setCurrentUser(demoUser);
                  setProfileName(demoUser.name);
                  setAuthenticated(true);
                  setActivePage('Dashboard');
                  setDemoData(true);
                }}
              >
                🚀 Explore Demo Dashboard (Instant Access)
              </button>

              <p className="auth-footer">
                New here? <button type="button" className="text-link-button" onClick={() => { setAuthMode('register'); setAuthView('default'); setAuthMessage({ type: '', text: '' }); }}>Create an account</button>
              </p>
            </form>
          )}
        </div>
        <HelpChat />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-bar">
          <BrandMark large />
          <div>
            <strong>REVORA</strong>
            <small>Predict Growth. Power Success.</small>
          </div>
        </div>

        <nav className="nav-menu">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className={activePage === label ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                if (label === 'Logout') {
                  handleLogout();
                  return;
                }
                setActivePage(label);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {activePage === label && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activePage === 'Dashboard' ? 'Your Business Intelligence Overview' : 'REVORA Intelligence'}</p>
            <h2>{activePage === 'Dashboard' ? 'Welcome to REVORA' : activePage}</h2>
          </div>

          <div className="topbar-actions">
            <div className="notification-wrap">
              <button
                type="button"
                className="icon-btn"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                {notificationItems.length > 0 && <span className="notification-dot" />}
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <strong>Business insights</strong>
                  {notificationItems.length ? notificationItems.map((item) => (
                    <div className="notification-item" key={item.title}>
                      <span>{item.title}</span><small>{item.detail}</small>
                    </div>
                  )) : <p className="empty-copy">Notifications are disabled in your preferences.</p>}
                </div>
              )}
            </div>
            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className="user-tag"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span>{currentUser?.name || currentUser?.email || 'Account'}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {profileMenuOpen && (
                <div className="profile-menu" role="menu">
                  <div className="profile-menu-user">
                    <strong>{currentUser?.name || currentUser?.email || 'Account'}</strong>
                    {currentUser?.name && <span>{currentUser.email}</span>}
                    <span className="role-label">{currentUser?.role || 'user'}</span>
                  </div>
                  <button type="button" role="menuitem" onClick={() => { setActivePage('Settings'); setProfileMenuOpen(false); }}>
                    <UserRound size={16} aria-hidden="true" />
                    <span>My profile</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setActivePage('Settings'); setProfileMenuOpen(false); }}>
                    <Settings size={16} aria-hidden="true" />
                    <span>Settings</span>
                  </button>
                  <button type="button" role="menuitem" onClick={handleLogout}>
                    <LogOut size={16} aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {!['Settings', 'Admin'].includes(activePage) && (
          <div className="data-filters no-print" aria-label="Sales data filters">
            <label>
              <CalendarDays size={15} />
              <select aria-label="Date range" value={filters.range} onChange={(event) => setDateRange(event.target.value)}>
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="year">This year</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            {filters.range === 'custom' && (
              <>
                <input aria-label="Start date" type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
                <input aria-label="End date" type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
              </>
            )}
            <select aria-label="Product filter" value={filters.product} onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))}>
              <option value="">All products</option>
              {[...new Set([filters.product, ...products.map((item) => item.productName)].filter(Boolean))].map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
            <select aria-label="Category filter" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
              <option value="">All categories</option>
              {[...new Set([
                filters.category,
                ...categories.map((item) => item.category),
                ...CATEGORY_TAXONOMY.map((item) => item.category)
              ].filter(Boolean))].map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select aria-label="Region filter" value={filters.region} onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value }))}>
              <option value="">All regions</option>
              {[...new Set([filters.region, ...salesRows.map((item) => item.region)].filter(Boolean))].map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
            <button type="button" className="secondary-btn" onClick={() => setFilters({ range: 'all', startDate: '', endDate: '', product: '', category: '', region: '', search: '' })}>Clear filters</button>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="loading-banner">Loading analytics data...</div>}
        {actionMessage.text && (
          <div className={actionMessage.type === 'error' ? 'error-banner' : 'success-banner'} role="status">
            {actionMessage.text}
          </div>
        )}

        <div className="page-content">
          {demoData && (
            <div className="demo-banner" role="status">
              Sample sales records are shown. Replace them with your own data before using these figures for business decisions.
            </div>
          )}
          {!loading && !error && salesRows.length === 0 && (
            <div className="empty-state" role="status">
              <strong>No sales records yet</strong>
              <span>{currentUser?.role === 'admin'
                ? 'Import a sales CSV from Data Management to populate REVORA with your business data.'
                : 'Ask an administrator to import sales data before using analytics and reports.'}</span>
            </div>
          )}
          {renderPage()}
        </div>
      </main>
      <HelpChat onNavigate={setActivePage} />
    </div>
  );
}

export default App;
