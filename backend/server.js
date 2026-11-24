const express = require('express');
const cors = require('cors');
const fsSync = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { initializeDatabase, getDbConnection } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'sales-dashboard-dev-secret';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SESSION_COOKIE = 'revora_session';
let seededSampleSales = false;

const publicAuthRoutes = new Set([
  '/auth/register',
  '/auth/login',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password'
]);

const authAttempts = new Map();

function createRateLimiter({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
    const now = Date.now();
    const history = authAttempts.get(key) || [];
    const recent = history.filter((timestamp) => timestamp > now - windowMs);

    if (recent.length >= max) {
      authAttempts.set(key, recent);
      return res.status(429).json({ message });
    }

    recent.push(now);
    authAttempts.set(key, recent);
    return next();
  };
}

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please wait a few minutes and try again.'
});

const allowedOrigins = new Set([
  APP_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
]);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || origin.endsWith('.github.io') || origin.endsWith('.trycloudflare.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by the REVORA API.'));
  }
}));
app.use(express.json({ limit: '2mb' }));

function getSessionToken(req) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (cookie) return decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));

  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

function setSessionCookie(res, token, remember = true) {
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api'
  };
  if (remember) options.maxAge = 8 * 60 * 60 * 1000;
  res.cookie(SESSION_COOKIE, token, options);
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api'
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function findUserByEmail(email) {
  const db = getDbConnection();
  const normalized = String(email || '').trim().toLowerCase();
  const [rows] = await db.execute('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [normalized]);
  return rows[0] || null;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

async function storeResetToken(userId, token) {
  const db = getDbConnection();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const tokenHash = await bcrypt.hash(token, 12);
  await db.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [userId]);
  await db.execute(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
}

async function sendResetEmail(user, token) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
    to: user.email,
    subject: 'Reset your REVORA password',
    text: `Use this link to reset your password: ${APP_URL}/?view=reset&token=${encodeURIComponent(token)}\n\nThis link expires in 1 hour.`
  });

}

app.use('/api', async (req, res, next) => {
  if (req.path === '/health' || publicAuthRoutes.has(req.path)) {
    return next();
  }

  const token = getSessionToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [users] = await getDbConnection().execute(
      'SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1',
      [payload.sub]
    );
    if (!users.length) return res.status(401).json({ message: 'Session user not found.' });
    req.user = users[0];
    return next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      console.error('Unable to verify authenticated API request:', error.message);
      return res.status(500).json({ message: 'Unable to verify the current session.' });
    }
    return res.status(401).json({ message: 'Invalid or expired session.' });
  }
});

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator access is required.' });
  }
  return next();
}

app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body || {};

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Full name, email, password, and confirm password are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const fullName = String(name || '').trim() || String(email).split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() || 'REVORA User';
    if (fullName.length > 255) {
      return res.status(400).json({ message: 'Name must be 255 characters or fewer.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);

    const [result] = await getDbConnection().execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [fullName, email.trim().toLowerCase(), passwordHash,
        process.env.ADMIN_EMAIL && email.trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase() ? 'admin' : 'user']
    );

    const newUser = {
      id: result.insertId,
      name: fullName,
      email: email.trim().toLowerCase(),
      role: process.env.ADMIN_EMAIL && email.trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase() ? 'admin' : 'user'
    };
    const token = signToken(newUser);
    setSessionCookie(res, token);
    return res.status(201).json({
      message: 'Registration successful.',
      user: newUser,
      token
    });
  } catch (error) {
    return databaseError(res, 'Unable to register user.', error);
  }
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken(user);
    setSessionCookie(res, token, req.body?.rememberMe !== false);
    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user'
      },
      token
    });
  } catch (error) {
    return databaseError(res, 'Unable to log in.', error);
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const db = getDbConnection();
    const [settings] = await db.execute(
      'SELECT theme, notifications_enabled AS notificationsEnabled FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );
    return res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role || 'user',
        preferences: settings[0] || { theme: 'light', notificationsEnabled: 1 }
      }
    });
  } catch (error) {
    return databaseError(res, 'Unable to fetch current user.', error);
  }
});

app.patch('/api/auth/profile', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name || name.length > 255) {
    return res.status(400).json({ message: 'Enter a name between 1 and 255 characters.' });
  }
  try {
    await getDbConnection().execute('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    return res.json({ message: 'Profile updated.', user: { ...req.user, name } });
  } catch (error) {
    return databaseError(res, 'Unable to update profile.', error);
  }
});

app.patch('/api/auth/preferences', async (req, res) => {
  const { theme, notificationsEnabled } = req.body || {};
  if (!['light', 'dark', 'aurora'].includes(theme) || typeof notificationsEnabled !== 'boolean') {
    return res.status(400).json({ message: 'Choose a light, dark, or Aurora theme and a valid notification preference.' });
  }
  try {
    await getDbConnection().execute(
      `INSERT INTO user_settings (user_id, theme, notifications_enabled)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE theme = VALUES(theme), notifications_enabled = VALUES(notifications_enabled)`,
      [req.user.id, theme, notificationsEnabled ? 1 : 0]
    );
    return res.json({ message: 'Preferences saved.', preferences: { theme, notificationsEnabled } });
  } catch (error) {
    return databaseError(res, 'Unable to save preferences.', error);
  }
});

app.patch('/api/auth/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'Current password, new password, and confirmation are required.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New passwords do not match.' });
  }
  try {
    const [rows] = await getDbConnection().execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (!rows.length || !await bcrypt.compare(String(currentPassword), rows[0].password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    const passwordHash = await bcrypt.hash(String(newPassword), 12);
    await getDbConnection().execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    return res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    return databaseError(res, 'Unable to change password.', error);
  }
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const [users] = await getDbConnection().query(
      'SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC'
    );
    return res.json({ data: users });
  } catch (error) {
    return databaseError(res, 'Unable to load users.', error);
  }
});

app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const { role } = req.body || {};
  if (!Number.isSafeInteger(userId) || userId < 1 || !['admin', 'user'].includes(role)) {
    return res.status(400).json({ message: 'Provide a valid user ID and role.' });
  }
  if (userId === Number(req.user.id) && role !== 'admin') {
    return res.status(400).json({ message: 'You cannot remove your own administrator access.' });
  }
  try {
    const db = getDbConnection();
    const [targets] = await db.execute('SELECT id, role FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!targets.length) return res.status(404).json({ message: 'User not found.' });
    if (targets[0].role === 'admin' && role !== 'admin') {
      const [[{ totalAdmins }]] = await db.query("SELECT COUNT(*) AS totalAdmins FROM users WHERE role = 'admin'");
      if (Number(totalAdmins) <= 1) {
        return res.status(400).json({ message: 'The last administrator cannot be demoted.' });
      }
    }
    await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    return res.json({ message: 'User role updated.', id: userId, role });
  } catch (error) {
    return databaseError(res, 'Unable to update user role.', error);
  }
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  return res.json({ message: 'Logged out successfully.' });
});

app.post('/api/auth/forgot-password', authRateLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Password reset is unavailable until SMTP_HOST, SMTP_USER, and SMTP_PASS are configured.');
      return res.status(503).json({
        message: 'Secure password recovery is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email reset links.'
      });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.json({
        message: 'If an account exists for that email, a password reset link has been sent.'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await storeResetToken(user.id, token);
    await sendResetEmail(user, token);

    return res.json({
      message: 'If an account exists for that email, a password reset link has been sent.'
    });
  } catch (error) {
    return databaseError(res, 'Unable to process password reset request.', error);
  }
});

app.post('/api/auth/reset-password', authRateLimiter, async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body || {};

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Token, new password, and confirmation are required.' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    if (String(newPassword) !== String(confirmPassword)) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const [records] = await getDbConnection().query(
      `SELECT prt.id, prt.user_id, prt.token_hash, prt.expires_at, u.email
       FROM password_reset_tokens prt
       INNER JOIN users u ON u.id = prt.user_id
       WHERE prt.used_at IS NULL AND prt.expires_at > NOW()`
    );

    let matchingRecord = null;
    for (const record of records) {
      const tokenMatches = await bcrypt.compare(String(token), record.token_hash);
      if (tokenMatches) {
        matchingRecord = record;
        break;
      }
    }

    if (!matchingRecord) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 12);
    const db = getDbConnection();
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, matchingRecord.user_id]);
    await db.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [matchingRecord.id]);

    return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (error) {
    return databaseError(res, 'Unable to reset password.', error);
  }
});

const SALES = [
  { id: 1, orderId: 'SO-1001', orderDate: '2024-01-04', productName: 'Laptop Pro 14', category: 'Electronics', quantity: 2, sales: 3299, price: 1649.5, discount: 5, customerName: 'Alicia N', profit: 890, promotion: 'Winter Launch', region: 'North' },
  { id: 2, orderId: 'SO-1002', orderDate: '2024-01-18', productName: 'Wireless Mouse', category: 'Accessories', quantity: 12, sales: 720, price: 60, discount: 8, customerName: 'Michael S', profit: 190, promotion: 'New Year Offer', region: 'West' },
  { id: 3, orderId: 'SO-1003', orderDate: '2024-02-06', productName: 'Office Chair', category: 'Furniture', quantity: 5, sales: 2100, price: 420, discount: 10, customerName: 'Rita K', profit: 620, promotion: 'Office Upgrade', region: 'South' },
  { id: 4, orderId: 'SO-1004', orderDate: '2024-02-16', productName: '4K Monitor', category: 'Electronics', quantity: 4, sales: 2800, price: 700, discount: 12, customerName: 'David T', profit: 760, promotion: 'Product Bundles', region: 'Central' },
  { id: 5, orderId: 'SO-1005', orderDate: '2024-03-02', productName: 'Ergonomic Keyboard', category: 'Accessories', quantity: 9, sales: 990, price: 110, discount: 7, customerName: 'Emma R', profit: 225, promotion: 'Spring Sale', region: 'East' },
  { id: 6, orderId: 'SO-1006', orderDate: '2024-03-20', productName: 'Smart Speaker', category: 'Electronics', quantity: 6, sales: 1800, price: 300, discount: 9, customerName: 'Jason P', profit: 510, promotion: 'Festival Event', region: 'North' },
  { id: 7, orderId: 'SO-1007', orderDate: '2024-04-08', productName: 'Standing Desk', category: 'Furniture', quantity: 3, sales: 3600, price: 1200, discount: 15, customerName: 'Laura H', profit: 980, promotion: 'Business Growth', region: 'West' },
  { id: 8, orderId: 'SO-1008', orderDate: '2024-05-03', productName: 'Webcam', category: 'Electronics', quantity: 15, sales: 2250, price: 150, discount: 10, customerName: 'Kevin M', profit: 610, promotion: 'Remote Work', region: 'East' },
  { id: 9, orderId: 'SO-1009', orderDate: '2024-05-28', productName: 'USB-C Hub', category: 'Accessories', quantity: 16, sales: 1100, price: 70, discount: 5, customerName: 'Priya D', profit: 330, promotion: 'Bundle Bonus', region: 'South' },
  { id: 10, orderId: 'SO-1010', orderDate: '2024-06-12', productName: 'Premium Notebook', category: 'Office', quantity: 21, sales: 1575, price: 75, discount: 6, customerName: 'Noah W', profit: 420, promotion: 'Back-to-School', region: 'Central' },
  { id: 11, orderId: 'SO-1011', orderDate: '2024-06-25', productName: 'Projector', category: 'Electronics', quantity: 2, sales: 2600, price: 1300, discount: 18, customerName: 'Olivia F', profit: 720, promotion: 'Summer Offer', region: 'North' },
  { id: 12, orderId: 'SO-1012', orderDate: '2024-07-02', productName: 'Executive Desk', category: 'Furniture', quantity: 4, sales: 5200, price: 1300, discount: 12, customerName: 'Sam C', profit: 1500, promotion: 'Corporate Deal', region: 'West' },
  { id: 13, orderId: 'SO-1013', orderDate: '2024-07-19', productName: 'Noise Cancelling Headset', category: 'Electronics', quantity: 8, sales: 3192, price: 399, discount: 11, customerName: 'Sophia B', profit: 980, promotion: 'Travel Sale', region: 'East' },
  { id: 14, orderId: 'SO-1014', orderDate: '2024-08-11', productName: 'Printer', category: 'Office', quantity: 6, sales: 2400, price: 400, discount: 13, customerName: 'Liam P', profit: 650, promotion: 'Business Essentials', region: 'South' },
  { id: 15, orderId: 'SO-1015', orderDate: '2024-08-28', productName: 'Tablet Pro', category: 'Electronics', quantity: 7, sales: 4890, price: 700, discount: 9, customerName: 'Mila G', profit: 1380, promotion: 'Digital Upgrade', region: 'Central' },
  { id: 16, orderId: 'SO-1016', orderDate: '2024-09-13', productName: 'Desk Organizer', category: 'Accessories', quantity: 24, sales: 1488, price: 62, discount: 7, customerName: 'Henry Q', profit: 440, promotion: 'Workspace Refresh', region: 'North' },
  { id: 17, orderId: 'SO-1017', orderDate: '2024-10-04', productName: 'Monitor Arm', category: 'Furniture', quantity: 11, sales: 1540, price: 140, discount: 8, customerName: 'Isabella V', profit: 470, promotion: 'Office Makeover', region: 'West' },
  { id: 18, orderId: 'SO-1018', orderDate: '2024-10-22', productName: 'Smartwatch', category: 'Electronics', quantity: 10, sales: 3550, price: 355, discount: 10, customerName: 'Ethan K', profit: 1010, promotion: 'Holiday Tech', region: 'Central' },
  { id: 19, orderId: 'SO-1019', orderDate: '2024-11-08', productName: 'Portable SSD', category: 'Accessories', quantity: 18, sales: 2520, price: 140, discount: 6, customerName: 'Grace L', profit: 710, promotion: 'Black Friday', region: 'East' },
  { id: 20, orderId: 'SO-1020', orderDate: '2024-11-26', productName: 'Gaming Console', category: 'Electronics', quantity: 3, sales: 5100, price: 1700, discount: 15, customerName: 'Nathan Y', profit: 1480, promotion: 'Holiday Bundle', region: 'South' },
  { id: 21, orderId: 'SO-1021', orderDate: '2024-12-05', productName: 'Standing Lamp', category: 'Furniture', quantity: 7, sales: 1820, price: 260, discount: 9, customerName: 'Abigail J', profit: 510, promotion: 'Festive Decor', region: 'North' },
  { id: 22, orderId: 'SO-1022', orderDate: '2024-12-19', productName: 'USB Dock', category: 'Accessories', quantity: 15, sales: 1725, price: 115, discount: 8, customerName: 'Lucas W', profit: 490, promotion: 'Year-End Sale', region: 'West' },
  { id: 23, orderId: 'SO-1023', orderDate: '2025-01-16', productName: 'Laptop Pro 14', category: 'Electronics', quantity: 12, sales: 21460, price: 1790, discount: 12, customerName: 'Emma R', profit: 6270, promotion: 'Q1 Growth', region: 'Central' },
  { id: 24, orderId: 'SO-1024', orderDate: '2025-02-11', productName: '4K Monitor', category: 'Electronics', quantity: 9, sales: 6498, price: 720, discount: 10, customerName: 'Alicia N', profit: 1870, promotion: 'Business Refresh', region: 'East' },
  { id: 25, orderId: 'SO-1025', orderDate: '2025-03-02', productName: 'Smart Speaker', category: 'Electronics', quantity: 13, sales: 4170, price: 320, discount: 11, customerName: 'Sophia B', profit: 1180, promotion: 'Spring New Launch', region: 'South' },
  { id: 26, orderId: 'SO-1026', orderDate: '2025-03-29', productName: 'Executive Desk', category: 'Furniture', quantity: 5, sales: 6325, price: 1265, discount: 14, customerName: 'Michael S', profit: 1740, promotion: 'Commercial Office', region: 'North' },
  { id: 27, orderId: 'SO-1027', orderDate: '2025-04-15', productName: 'Noise Cancelling Headset', category: 'Electronics', quantity: 15, sales: 6120, price: 408, discount: 9, customerName: 'Priya D', profit: 1800, promotion: 'Work From Anywhere', region: 'Central' },
  { id: 28, orderId: 'SO-1028', orderDate: '2025-05-22', productName: 'Tablet Pro', category: 'Electronics', quantity: 11, sales: 7460, price: 680, discount: 8, customerName: 'Kevin M', profit: 2120, promotion: 'Digital Transformation', region: 'West' },
  { id: 29, orderId: 'SO-1029', orderDate: '2025-06-09', productName: 'Webcam', category: 'Electronics', quantity: 18, sales: 2694, price: 149, discount: 7, customerName: 'Jason P', profit: 760, promotion: 'Hybrid Work', region: 'South' },
  { id: 30, orderId: 'SO-1030', orderDate: '2025-06-25', productName: 'USB-C Hub', category: 'Accessories', quantity: 36, sales: 2448, price: 68, discount: 6, customerName: 'Olivia F', profit: 690, promotion: 'Product Bundle', region: 'East' }
];

function parseCsv(csvText) {
  if (!csvText || !csvText.trim()) {
    return [];
  }

  const records = [];
  let record = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    if (character === '"') {
      if (quoted && csvText[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      record.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csvText[index + 1] === '\n') index += 1;
      record.push(value.trim());
      if (record.some(Boolean)) records.push(record);
      record = [];
      value = '';
    } else {
      value += character;
    }
  }

  record.push(value.trim());
  if (record.some(Boolean)) records.push(record);
  if (quoted) {
    throw new Error('CSV contains an unclosed quoted field.');
  }
  if (records.length < 2) {
    return [];
  }

  const headers = records[0].map((header) => header.replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (new Set(headers).size !== headers.length) {
    throw new Error('CSV contains duplicate column names.');
  }
  const aliases = {
    orderId: ['orderid', 'transactionid', 'invoiceno', 'id'],
    orderDate: ['orderdate', 'transactiondate', 'date'],
    productName: ['productname', 'product', 'item'],
    category: ['category', 'productcategory'],
    quantity: ['quantitysold', 'quantity', 'qty', 'units'],
    sales: ['sales', 'salesrevenue', 'revenue', 'totalrevenue', 'amount', 'total'],
    price: ['price', 'unitprice'],
    discount: ['discount', 'discountpercent', 'discountpercentage'],
    customerName: ['customerinformation', 'customername', 'customer', 'client'],
    profit: ['profit', 'netprofit'],
    promotion: ['promotiondetails', 'promotion', 'campaign'],
    region: ['region', 'area', 'location']
  };
  const fieldFor = (field) => aliases[field].find((name) => headers.includes(name));
  const requiredFields = ['orderId', 'orderDate', 'productName', 'category', 'quantity', 'sales', 'customerName', 'profit'];
  const missingFields = requiredFields.filter((field) => !fieldFor(field));
  if (missingFields.length) {
    throw new Error(`CSV is missing required columns: ${missingFields.map((field) => fieldForLabel(field)).join(', ')}.`);
  }
  if (records.length - 1 > 5000) {
    throw new Error('CSV files may contain at most 5,000 sales records per import.');
  }
  const invalidRow = records.slice(1).findIndex((cells) => cells.length !== headers.length);
  if (invalidRow !== -1) {
    throw new Error(`CSV row ${invalidRow + 2} has a different number of values than the header.`);
  }

  const numberValue = (input, field, rowNumber) => {
    const parsed = Number(String(input || '').replace(/[,$%\s]/g, ''));
    if (!String(input || '').trim() || !Number.isFinite(parsed)) {
      throw new Error(`CSV row ${rowNumber} contains an invalid ${fieldForLabel(field)}.`);
    }
    return parsed;
  };
  const seenOrderIds = new Set();
  return records.slice(1).map((cells, index) => {
    const rowNumber = index + 2;
    const raw = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    const row = {};
    Object.entries(aliases).forEach(([field, names]) => {
      const matched = names.find((name) => raw[name] !== undefined);
      row[field] = matched ? raw[matched] : '';
    });
    const orderDate = row.orderDate;
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(orderDate) ? new Date(`${orderDate}T00:00:00Z`) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== orderDate) {
      throw new Error(`CSV row ${rowNumber} contains an invalid order date.`);
    }
    const quantity = numberValue(row.quantity, 'quantity', rowNumber);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`CSV row ${rowNumber} quantity must be a positive whole number.`);
    }
    const sales = numberValue(row.sales, 'sales', rowNumber);
    if (sales < 0) throw new Error(`CSV row ${rowNumber} revenue cannot be negative.`);
    const profit = numberValue(row.profit, 'profit', rowNumber);
    const discount = row.discount ? numberValue(row.discount, 'discount', rowNumber) : 0;
    if (discount < 0 || discount > 100) throw new Error(`CSV row ${rowNumber} discount must be between 0 and 100.`);
    const orderId = row.orderId.trim();
    if (!orderId || seenOrderIds.has(orderId)) throw new Error(`CSV row ${rowNumber} has a missing or duplicate order ID.`);
    seenOrderIds.add(orderId);
    const productName = row.productName.trim();
    const category = row.category.trim();
    const customerName = row.customerName.trim();
    if (!productName || !category || !customerName) {
      throw new Error(`CSV row ${rowNumber} is missing product, category, or customer information.`);
    }
    return {
      ...row,
      orderId,
      orderDate,
      productName,
      category,
      customerName,
      quantity,
      sales,
      price: row.price ? numberValue(row.price, 'price', rowNumber) : sales / quantity,
      discount,
      profit,
      promotion: row.promotion || null,
      region: row.region || null
    };
  });
}

function fieldForLabel(field) {
  return {
    orderId: 'order ID',
    orderDate: 'order date',
    productName: 'product name',
    category: 'category',
    quantity: 'quantity',
    sales: 'revenue',
    customerName: 'customer name',
    profit: 'profit'
  }[field] || field;
}

function mapSalesRow(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderDate: row.order_date instanceof Date ? row.order_date.toISOString().slice(0, 10) : String(row.order_date).slice(0, 10),
    productName: row.product_name,
    category: row.product_category,
    quantity: Number(row.quantity_sold),
    sales: Number(row.sales_revenue),
    price: Number(row.unit_price),
    discount: Number(row.discount || 0),
    customerName: row.customer_name,
    profit: Number(row.profit),
    promotion: row.promotion_details,
    region: row.region
  };
}

async function seedSampleSales() {
  const db = getDbConnection();
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM sales');
  const sampleIds = SALES.map((item) => item.orderId);
  if (Number(total) !== 0) {
    const [matches] = await db.execute(
      `SELECT COUNT(*) AS total FROM sales WHERE order_id IN (${sampleIds.map(() => '?').join(', ')})`,
      sampleIds
    );
    seededSampleSales = Number(total) === SALES.length && Number(matches[0].total) === SALES.length;
    return;
  }
  if (process.env.SEED_SAMPLE_SALES !== 'true') return;

  const fieldsPerRow = 12;
  const placeholders = SALES.map(() => `(${Array(fieldsPerRow).fill('?').join(', ')})`).join(', ');
  const values = SALES.flatMap((item) => [
    item.orderId, item.orderDate, item.productName, item.category, item.quantity,
    item.sales, item.price, item.discount, item.customerName, item.profit,
    item.promotion, item.region
  ]);

  await db.query(
    `INSERT INTO sales (order_id, order_date, product_name, product_category, quantity_sold, sales_revenue, unit_price, discount, customer_name, profit, promotion_details, region) VALUES ${placeholders}`,
    values
  );
  seededSampleSales = true;
}

async function seedEmptyReferenceTables() {
  const db = getDbConnection();
  const seedPath = path.resolve(__dirname, '../database/sample_data.sql');
  const sql = await fs.readFile(seedPath, 'utf8');
  const seedableTables = new Set(['categories', 'products', 'customers', 'model_metrics']);
  const statements = sql.split(';').map((statement) => statement.trim()).filter((statement) => {
    const match = statement.match(/^INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?/i);
    return match && seedableTables.has(match[1].toLowerCase());
  });

  for (const statement of statements) {
    const [, table] = statement.match(/^INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?/i);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    if (Number(total) === 0) await db.query(statement);
  }
}

const salesSelect = `SELECT id, order_id, order_date, product_name, product_category,
  quantity_sold, sales_revenue, unit_price, discount, customer_name, profit,
  promotion_details, region FROM sales`;

function parseSalesFilters(query) {
  const filters = {};
  for (const key of ['startDate', 'endDate']) {
    const value = query[key];
    if (value !== undefined && value !== '') {
      const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
        const error = new Error(`${key} must be a valid date in YYYY-MM-DD format.`);
        error.statusCode = 400;
        throw error;
      }
      filters[key] = value;
    }
  }
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    const error = new Error('Start date must not be after end date.');
    error.statusCode = 400;
    throw error;
  }
  for (const key of ['product', 'category', 'region', 'search']) {
    if (query[key] !== undefined && query[key] !== '') {
      const value = String(query[key]).trim();
      const maxLength = key === 'search' ? 100 : 255;
      if (value.length > maxLength) {
        const error = new Error(`${key} must be ${maxLength} characters or fewer.`);
        error.statusCode = 400;
        throw error;
      }
      filters[key] = value;
    }
  }
  return filters;
}

function salesWhere(filters) {
  const conditions = [];
  const values = [];
  if (filters.startDate) {
    conditions.push('order_date >= ?');
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('order_date <= ?');
    values.push(filters.endDate);
  }
  if (filters.product) {
    conditions.push('product_name = ?');
    values.push(filters.product);
  }
  if (filters.category) {
    conditions.push('product_category = ?');
    values.push(filters.category);
  }
  if (filters.region) {
    conditions.push('region = ?');
    values.push(filters.region);
  }
  if (filters.search) {
    const search = `%${filters.search}%`;
    conditions.push('(order_id LIKE ? OR product_name LIKE ? OR customer_name LIKE ? OR region LIKE ?)');
    values.push(search, search, search, search);
  }
  return { clause: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '', values };
}

async function querySales(filters) {
  const where = salesWhere(filters);
  const [rows] = await getDbConnection().query(
    `${salesSelect}${where.clause} ORDER BY order_date DESC, id DESC`,
    where.values
  );
  return rows.map(mapSalesRow);
}

async function queryMonthlySales(field, filters) {
  const valueColumn = field === 'profit' ? 'profit' : field === 'quantity' ? 'quantity_sold' : 'sales_revenue';
  const where = salesWhere(filters);
  const [rows] = await getDbConnection().query(
    `SELECT DATE_FORMAT(MIN(order_date), '%b %Y') AS month, MIN(order_date) AS sort_date,
      SUM(sales_revenue) AS revenue, SUM(profit) AS profit,
      SUM(quantity_sold) AS quantity, COUNT(*) AS orders, SUM(${valueColumn}) AS value
     FROM sales${where.clause} GROUP BY YEAR(order_date), MONTH(order_date) ORDER BY sort_date`,
    where.values
  );
  return rows.map((row) => ({
    month: row.month,
    revenue: Number(row.revenue),
    profit: Number(row.profit),
    quantity: Number(row.quantity),
    orders: Number(row.orders),
    value: Number(row.value)
  }));
}

function databaseError(res, message, error) {
  console.error(`${message}:`, error.message);
  const status = error.statusCode || (error.code === 'ER_DUP_ENTRY' ? 409 : 500);
  res.status(status).json({
    message: status === 409 ? 'A record with this identifier already exists.' : status < 500 ? error.message : message
  });
}

function runPredictionScript(horizon = 3) {
  const pythonPath = path.resolve(__dirname, '../ml/prediction.py');
  const csvPath = path.resolve(__dirname, '../ml/data/sales_data.csv');
  const venvPython = path.resolve(__dirname, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const pythonCommand = process.env.PYTHON || (fsSync.existsSync(venvPython) ? venvPython : 'python');
  const result = spawnSync(pythonCommand, [pythonPath, '--input', csvPath, '--horizon', String(horizon)], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf-8'
  });

  if (result.error) {
    throw new Error(`Unable to start Python (${pythonCommand}): ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Prediction script failed.');
  }

  return JSON.parse(result.stdout);
}

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', message: 'REVORA Intelligence API is running.' });
});

app.get('/api/sales', async (req, res) => {
  try {
    const filters = parseSalesFilters(req.query);
    res.json({ data: await querySales(filters), demoData: seededSampleSales, source: 'mysql' });
  } catch (error) {
    databaseError(res, 'Unable to load sales data.', error);
  }
});

app.post('/api/sales', requireAdmin, async (req, res) => {
  const record = req.body;
  if (!record || !record.productName || !record.orderDate) {
    return res.status(400).json({ message: 'Missing required sales data.' });
  }

  const newRecord = {
    id: Number(Date.now()),
    orderId: record.orderId || `SO-${Date.now()}`,
    orderDate: record.orderDate,
    productName: record.productName,
    category: record.category || 'General',
    quantity: Number(record.quantity || 0),
    sales: Number(record.sales || 0),
    price: Number(record.price || 0),
    discount: Number(record.discount || 0),
    customerName: record.customerName || 'Walk-in Customer',
    profit: Number(record.profit || 0),
    promotion: record.promotion || 'No Promotion',
    region: record.region || 'Central'
  };

  try {
    const [result] = await getDbConnection().execute(
      `INSERT INTO sales (order_id, order_date, product_name, product_category, quantity_sold, sales_revenue, unit_price, discount, customer_name, profit, promotion_details, region)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newRecord.orderId, newRecord.orderDate, newRecord.productName, newRecord.category, newRecord.quantity,
        newRecord.sales, newRecord.price, newRecord.discount, newRecord.customerName, newRecord.profit,
        newRecord.promotion, newRecord.region]
    );
    newRecord.id = result.insertId;
    res.status(201).json({ message: 'Sales record created successfully.', data: newRecord, demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to create sales record.', error);
  }
});

app.put('/api/sales/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const fields = {
    orderId: 'order_id', orderDate: 'order_date', productName: 'product_name', category: 'product_category',
    quantity: 'quantity_sold', sales: 'sales_revenue', price: 'unit_price', discount: 'discount',
    customerName: 'customer_name', profit: 'profit', promotion: 'promotion_details', region: 'region'
  };
  const updates = Object.entries(fields).filter(([key]) => req.body?.[key] !== undefined);
  if (!updates.length) return res.status(400).json({ message: 'No supported sales fields were provided.' });

  try {
    const db = getDbConnection();
    const [result] = await db.execute(
      `UPDATE sales SET ${updates.map(([, column]) => `\`${column}\` = ?`).join(', ')} WHERE id = ?`,
      [...updates.map(([key]) => req.body[key]), id]
    );
    if (!result.affectedRows) {
      const [existing] = await db.execute('SELECT id FROM sales WHERE id = ?', [id]);
      if (!existing.length) return res.status(404).json({ message: 'Sales record not found.' });
    }
    const [rows] = await db.execute(`${salesSelect} WHERE id = ?`, [id]);
    res.json({ message: 'Sales record updated successfully.', data: mapSalesRow(rows[0]), demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to update sales record.', error);
  }
});

app.delete('/api/sales/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await getDbConnection().execute('DELETE FROM sales WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Sales record not found.' });
    res.json({ message: 'Sales record deleted successfully.', demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to delete sales record.', error);
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const where = salesWhere(parseSalesFilters(req.query));
    const [data] = await getDbConnection().query(
      `SELECT product_name AS productName, product_category AS category,
        SUM(quantity_sold) AS quantity, SUM(sales_revenue) AS revenue,
        SUM(profit) AS profit, AVG(discount) AS discount,
        SUM(sales_revenue) / NULLIF(SUM(quantity_sold), 0) AS averagePrice,
        IF(SUM(profit) > 0, 'Strong', 'Monitoring') AS performance
       FROM sales${where.clause} GROUP BY product_name, product_category ORDER BY revenue DESC`,
      where.values
    );
    res.json({ data: data.map((row) => ({ ...row, quantity: Number(row.quantity), revenue: Number(row.revenue), profit: Number(row.profit), discount: Number(row.discount), averagePrice: Number(row.averagePrice) })), demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to load products.', error);
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const where = salesWhere(parseSalesFilters(req.query));
    const [data] = await getDbConnection().query(
      `SELECT product_category AS category, SUM(sales_revenue) AS revenue,
        SUM(profit) AS profit, SUM(quantity_sold) AS quantity
       FROM sales${where.clause} GROUP BY product_category ORDER BY revenue DESC`,
      where.values
    );
    res.json({ data: data.map((row) => ({ ...row, revenue: Number(row.revenue), profit: Number(row.profit), quantity: Number(row.quantity) })), demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to load categories.', error);
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const where = salesWhere(parseSalesFilters(req.query));
    const [data] = await getDbConnection().query(
      `SELECT customer_name AS customerName, COUNT(*) AS orders,
        SUM(quantity_sold) AS totalQuantity, SUM(sales_revenue) AS totalSpending,
        AVG(sales_revenue) AS avgOrderValue, COUNT(DISTINCT DATE_FORMAT(order_date, '%Y-%m')) AS purchaseFrequency
       FROM sales${where.clause} GROUP BY customer_name ORDER BY totalSpending DESC`,
      where.values
    );
    res.json({ data: data.map((row) => ({ ...row, orders: Number(row.orders), totalQuantity: Number(row.totalQuantity), totalSpending: Number(row.totalSpending), avgOrderValue: Number(row.avgOrderValue), purchaseFrequency: Number(Number(row.purchaseFrequency).toFixed(2)) })), demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to load customers.', error);
  }
});

app.get('/api/analysis/revenue', async (req, res) => {
  try {
    res.json({ data: await queryMonthlySales('revenue', parseSalesFilters(req.query)), demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to load revenue analysis.', error);
  }
});

app.get('/api/analysis/profit', async (req, res) => {
  try {
    res.json({ data: await queryMonthlySales('profit', parseSalesFilters(req.query)), demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to load profit analysis.', error);
  }
});

app.get('/api/analysis/products', async (req, res) => {
  try {
    const where = salesWhere(parseSalesFilters(req.query));
    const [data] = await getDbConnection().query(
      `SELECT product_name AS productName, product_category AS category,
        SUM(quantity_sold) AS quantity, SUM(sales_revenue) AS revenue,
        SUM(profit) AS profit, SUM(sales_revenue) / NULLIF(SUM(quantity_sold), 0) AS avgPrice
       FROM sales${where.clause} GROUP BY product_name, product_category ORDER BY revenue DESC`,
      where.values
    );
    res.json({ data: data.map((row) => ({ ...row, quantity: Number(row.quantity), revenue: Number(row.revenue), profit: Number(row.profit), avgPrice: Number(row.avgPrice) })), demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to load product analysis.', error);
  }
});

app.get('/api/analysis/categories', async (req, res) => {
  try {
    const where = salesWhere(parseSalesFilters(req.query));
    const [data] = await getDbConnection().query(
      `SELECT product_category AS category, SUM(sales_revenue) AS revenue,
        SUM(profit) AS profit, SUM(quantity_sold) AS quantity
       FROM sales${where.clause} GROUP BY product_category ORDER BY revenue DESC`,
      where.values
    );
    res.json({ data: data.map((row) => ({ ...row, revenue: Number(row.revenue), profit: Number(row.profit), quantity: Number(row.quantity) })), demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to load category analysis.', error);
  }
});

app.get('/api/analysis/seasonal', async (req, res) => {
  try {
    const where = salesWhere(parseSalesFilters(req.query));
    const [rows] = await getDbConnection().query(
      `SELECT CASE WHEN MONTH(order_date) IN (12, 1, 2) THEN 'Winter'
        WHEN MONTH(order_date) IN (3, 4, 5) THEN 'Spring'
        WHEN MONTH(order_date) IN (6, 7, 8) THEN 'Summer' ELSE 'Autumn' END AS season,
        SUM(sales_revenue) AS revenue, SUM(profit) AS profit
       FROM sales${where.clause} GROUP BY season ORDER BY FIELD(season, 'Winter', 'Spring', 'Summer', 'Autumn')`,
      where.values
    );
    const data = rows.map((row) => ({
      season: row.season,
      revenue: Number(row.revenue),
      profit: Number(row.profit)
    }));
    res.json({ data, demoData: seededSampleSales });
  } catch (error) {
    databaseError(res, 'Unable to load seasonal analysis.', error);
  }
});

app.post('/api/data/upload', async (req, res) => {
  const { csv } = req.body || {};
  if (typeof csv !== 'string' || !csv.trim()) {
    return res.status(400).json({ message: 'CSV content is required for upload.' });
  }

  let rows;
  try {
    rows = parseCsv(csv);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  if (!rows.length) {
    return res.status(400).json({ message: 'No valid records were parsed from the uploaded CSV.' });
  }

  let connection;
  try {
    connection = await getDbConnection().getConnection();
    await connection.beginTransaction();
    for (const row of rows) {
      await connection.execute(
        `INSERT INTO sales (order_id, order_date, product_name, product_category, quantity_sold, sales_revenue, unit_price, discount, customer_name, profit, promotion_details, region)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.orderId, row.orderDate, row.productName, row.category,
          row.quantity, row.sales, row.price, row.discount,
          row.customerName, row.profit, row.promotion, row.region]
      );
    }
    await connection.commit();
    res.json({ message: 'CSV upload processed successfully.', rowsAdded: rows.length, demoData: seededSampleSales, data: rows.slice(0, 5) });
  } catch (error) {
    if (connection) await connection.rollback();
    databaseError(res, 'Unable to import CSV data.', error);
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/prediction', (req, res) => {
  try {
    const body = req.body || {};
    const period = String(body.period || 'Next 3 Months');
    const periodMatch = period.match(/^Next ([1-9]\d?) Months?$/);
    if (!periodMatch || Number(periodMatch[1]) > 12) {
      return res.status(400).json({ message: 'Choose a forecast period between 1 and 12 months.' });
    }

    const prediction = runPredictionScript(Number(periodMatch[1]));

    res.json({
      ...prediction,
      requestedInputs: body,
      demoData: true,
      forecastPeriod: period
    });
  } catch (error) {
    console.error('Prediction service error:', error.message);
    res.status(500).json({ message: 'The prediction service could not generate a forecast. Check the Python environment and sales dataset.' });
  }
});

app.get('/api/prediction/history', (_req, res) => {
  try {
    const prediction = runPredictionScript();
    res.json({ data: prediction.history || [], demoData: true, note: 'Historical prediction records are from the demo dataset.' });
  } catch (error) {
    console.error('Unable to load prediction history:', error.message);
    res.status(500).json({ message: 'Unable to load prediction history.' });
  }
});

app.get('/api/models/metrics', (_req, res) => {
  try {
    const metrics = runPredictionScript();
    res.json({ data: metrics, demoData: true });
  } catch (error) {
    console.error('Unable to load model metrics:', error.message);
    res.status(500).json({ message: 'Unable to load model metrics.' });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const db = getDbConnection();
    const filters = parseSalesFilters(req.query);
    const where = salesWhere(filters);
    const [[totals]] = await db.query(
      `SELECT COALESCE(SUM(sales_revenue), 0) AS totalRevenue, COALESCE(SUM(profit), 0) AS totalProfit, COUNT(*) AS totalOrders, COALESCE(SUM(quantity_sold), 0) AS totalQuantity FROM sales${where.clause}`,
      where.values
    );
    const [categoryRows] = await db.query(
      `SELECT product_category AS category, SUM(sales_revenue) AS revenue, SUM(profit) AS profit FROM sales${where.clause} GROUP BY product_category ORDER BY revenue DESC`,
      where.values
    );
    const [productRows] = await db.query(
      `SELECT product_name AS productName, SUM(sales_revenue) AS revenue, SUM(quantity_sold) AS quantity, SUM(profit) AS profit FROM sales${where.clause} GROUP BY product_name ORDER BY revenue DESC`,
      where.values
    );
    const totalRevenue = Number(totals.totalRevenue);
    const totalProfit = Number(totals.totalProfit);
    const totalOrders = Number(totals.totalOrders);
    const totalQuantity = Number(totals.totalQuantity);
    res.json({
      summary: {
        totalRevenue,
        totalProfit,
        totalOrders,
        totalQuantity,
        avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
        demoData: seededSampleSales
      },
      revenueTrend: await queryMonthlySales('revenue', filters),
      salesTrend: (await queryMonthlySales('quantity', filters)).map((row) => ({ month: row.month, sales: row.quantity })),
      categoryBreakdown: categoryRows.map((row) => ({ ...row, revenue: Number(row.revenue), profit: Number(row.profit) })),
      seasonalPattern: await (async () => {
        const [rows] = await db.query(
          `SELECT DATE_FORMAT(MIN(order_date), '%b') AS month, SUM(sales_revenue) AS revenue
           FROM sales${where.clause} GROUP BY MONTH(order_date) ORDER BY MONTH(order_date)`,
           where.values
        );
        return rows.map((row) => ({ month: row.month, revenue: Number(row.revenue) }));
      })(),
      productPerformance: productRows.map((row) => ({ ...row, revenue: Number(row.revenue), quantity: Number(row.quantity), profit: Number(row.profit) })),
      demoData: seededSampleSales
    });
  } catch (error) {
    databaseError(res, 'Unable to load dashboard data.', error);
  }
});

async function startServer() {
  await initializeDatabase();
  await seedSampleSales();
  await seedEmptyReferenceTables();
  app.listen(PORT, () => {
    console.log(`REVORA Intelligence API listening on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Backend startup failed. Check that MySQL is running and the .env settings are correct:', error.message);
  process.exitCode = 1;
});
