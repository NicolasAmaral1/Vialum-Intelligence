require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const axios = require('axios');
const express = require('express');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LIST_ID = '901324787605';
const SESSION_COOKIE = 'genesis_form_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-session-secret';

const STATUS_PRIORITY = {
  feito: 1,
  'para fazer': 2,
  cpf: 3,
  'em processo': 4,
};

const BOOTSTRAP_USERS = [
  {
    username: 'admin',
    displayName: 'Administrador Genesis',
    companyName: 'Vialum',
    role: 'admin',
    mustChangePassword: true,
    passwordHash: 'scrypt$951ac8cd851f391852fd1ac528aa792c$c416e342d36444115d3b511940a1e694b10dac9288a024f754e7abf2662d7449ae12f38c776967cd49c68f7d764cc5d2cfc71019458cd1f099353f94b269410a',
  },
  {
    username: '3p',
    displayName: 'Empresa 3P',
    companyName: '3P',
    role: 'client',
    mustChangePassword: true,
    passwordHash: 'scrypt$aa0cfdcbb03a361a0cb398427e30f2ea$4181b951cc7b70299bdd0764be65c1e12667a1e09195941c8d2b72d78f5dd06e5f6050a8babf87bcc0e597d9eb7a769ac806ffd158820f01c8ebb912ce2af2e7',
  },
];

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

function nowIso() {
  return new Date().toISOString();
}

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    writeJson(USERS_FILE, []);
  }

  if (!fs.existsSync(SESSIONS_FILE)) {
    writeJson(SESSIONS_FILE, []);
  }

  const users = readUsers();
  if (users.length === 0) {
    const seededUsers = BOOTSTRAP_USERS.map((user) => ({
      id: crypto.randomUUID(),
      username: user.username,
      displayName: user.displayName,
      companyName: user.companyName,
      role: user.role,
      passwordHash: user.passwordHash,
      mustChangePassword: user.mustChangePassword,
      active: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
    }));

    writeUsers(seededUsers);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2));
  fs.renameSync(tempFile, file);
}

function readUsers() {
  return readJson(USERS_FILE);
}

function writeUsers(users) {
  writeJson(USERS_FILE, users);
}

function readSessions() {
  const sessions = readJson(SESSIONS_FILE);
  const activeSessions = sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());

  if (activeSessions.length !== sessions.length) {
    writeJson(SESSIONS_FILE, activeSessions);
  }

  return activeSessions;
}

function writeSessions(sessions) {
  writeJson(SESSIONS_FILE, sessions);
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return acc;
    acc[rawName] = decodeURIComponent(rawValue.join('=') || '');
    return acc;
  }, {});
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    companyName: user.companyName,
    role: user.role,
    active: user.active,
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  const [algo, salt, expectedHex] = String(storedHash || '').split('$');
  if (algo !== 'scrypt' || !salt || !expectedHex) return false;

  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');

  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(token)
    .digest('hex');
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
    expires: new Date(expiresAt),
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
  });
}

function createSession(user, req, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const sessions = readSessions().filter((session) => session.userId !== user.id);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  sessions.push({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(token),
    createdAt: nowIso(),
    expiresAt,
    lastSeenAt: nowIso(),
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
  });

  writeSessions(sessions);
  setSessionCookie(res, token, expiresAt);
}

function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  if (!token) {
    clearSessionCookie(res);
    return;
  }

  const sessions = readSessions().filter((session) => session.tokenHash !== hashToken(token));
  writeSessions(sessions);
  clearSessionCookie(res);
}

function loadSession(req, res, next) {
  const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  if (!token) {
    req.currentUser = null;
    return next();
  }

  const sessions = readSessions();
  const session = sessions.find((entry) => entry.tokenHash === hashToken(token));

  if (!session) {
    clearSessionCookie(res);
    req.currentUser = null;
    return next();
  }

  const users = readUsers();
  const user = users.find((entry) => entry.id === session.userId && entry.active);

  if (!user) {
    writeSessions(sessions.filter((entry) => entry.id !== session.id));
    clearSessionCookie(res);
    req.currentUser = null;
    return next();
  }

  session.lastSeenAt = nowIso();
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  writeSessions(sessions);
  setSessionCookie(res, token, session.expiresAt);

  req.currentUser = user;
  return next();
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Autenticação obrigatória.' });
    }
    return res.redirect('/login');
  }

  if (
    req.currentUser.mustChangePassword &&
    req.path !== '/senha' &&
    req.path !== '/api/auth/change-password' &&
    req.path !== '/api/auth/logout'
  ) {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Troca de senha obrigatória.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    return res.redirect('/senha');
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ error: 'Autenticação obrigatória.' });
  }

  if (req.currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  if (req.currentUser.mustChangePassword) {
    return res.status(403).json({ error: 'Troca de senha obrigatória.', code: 'PASSWORD_CHANGE_REQUIRED' });
  }

  return next();
}

function sendPage(fileName) {
  return (req, res) => res.sendFile(path.join(__dirname, 'public', fileName));
}

function buildRequesterLabel(user) {
  const parts = [user.displayName || user.username];
  if (user.companyName) parts.push(user.companyName);
  if (user.username) parts.push(`@${user.username}`);
  return parts.join(' | ');
}

ensureDataFiles();
app.use(loadSession);
app.get('/static/style.css', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'style.css')));

app.get('/login', (req, res) => {
  if (!req.currentUser) return sendPage('login.html')(req, res);
  if (req.currentUser.mustChangePassword) return res.redirect('/senha');
  return res.redirect('/');
});

app.get('/senha', requireAuth, sendPage('senha.html'));
app.get('/', requireAuth, sendPage('index.html'));
app.get('/acompanhamento.html', requireAuth, sendPage('acompanhamento.html'));
app.get('/admin.html', requireAuth, (req, res, next) => {
  if (req.currentUser.role !== 'admin') return res.redirect('/');
  return next();
}, sendPage('admin.html'));

app.get('/api/auth/session', (req, res) => {
  if (!req.currentUser) {
    return res.status(200).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    user: sanitizeUser(req.currentUser),
  });
});

app.post('/api/auth/login', (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const user = readUsers().find((entry) => entry.username === username && entry.active);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const users = readUsers();
  const idx = users.findIndex((entry) => entry.id === user.id);
  users[idx] = {
    ...users[idx],
    lastLoginAt: nowIso(),
    updatedAt: nowIso(),
  };
  writeUsers(users);

  destroySession(req, res);
  createSession(users[idx], req, res);

  return res.status(200).json({
    success: true,
    user: sanitizeUser(users[idx]),
  });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  destroySession(req, res);
  return res.status(200).json({ success: true });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
  }

  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 12 caracteres.' });
  }

  const users = readUsers();
  const idx = users.findIndex((entry) => entry.id === req.currentUser.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  if (!verifyPassword(currentPassword, users[idx].passwordHash)) {
    return res.status(401).json({ error: 'Senha atual inválida.' });
  }

  users[idx] = {
    ...users[idx],
    passwordHash: hashPassword(newPassword),
    mustChangePassword: false,
    updatedAt: nowIso(),
  };
  writeUsers(users);

  return res.status(200).json({
    success: true,
    user: sanitizeUser(users[idx]),
  });
});

app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = readUsers().map(sanitizeUser);
  return res.status(200).json({ success: true, users });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = String(req.body.password || '');
  const displayName = String(req.body.displayName || '').trim();
  const companyName = String(req.body.companyName || '').trim();
  const role = req.body.role === 'admin' ? 'admin' : 'client';

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Usuário deve ter ao menos 3 caracteres válidos.' });
  }

  if (!displayName) {
    return res.status(400).json({ error: 'Nome de exibição é obrigatório.' });
  }

  if (password.length < 12) {
    return res.status(400).json({ error: 'A senha temporária deve ter pelo menos 12 caracteres.' });
  }

  const users = readUsers();
  if (users.some((entry) => entry.username === username)) {
    return res.status(409).json({ error: 'Este usuário já existe.' });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    displayName,
    companyName,
    role,
    passwordHash: hashPassword(password),
    mustChangePassword: true,
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: null,
  };

  users.push(user);
  writeUsers(users);

  return res.status(201).json({
    success: true,
    user: sanitizeUser(user),
  });
});

app.post('/api/laudos', requireAuth, async (req, res) => {
  try {
    const { nomeMarca, nomeCliente, atividade, indicacao } = req.body;

    if (!nomeMarca || !nomeCliente || !atividade) {
      return res.status(400).json({ error: 'Marca, Cliente e Atividade são obrigatórios.' });
    }

    if (!CLICKUP_API_TOKEN) {
      return res.status(500).json({ error: 'CLICKUP_API_TOKEN não configurado.' });
    }

    const description = [
      `**Cliente:** ${String(nomeCliente).trim()}`,
      `**Atividade:** ${String(atividade).trim()}`,
      `**Quem indicou:** ${String(indicacao || 'N/A').trim() || 'N/A'}`,
      `**Solicitado por:** ${buildRequesterLabel(req.currentUser)}`,
    ].join('\n');

    const response = await axios.post(
      `https://api.clickup.com/api/v2/list/${LIST_ID}/task`,
      {
        name: String(nomeMarca).trim(),
        description,
        status: 'para fazer',
      },
      {
        headers: {
          Authorization: CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.status(201).json({
      success: true,
      taskId: response.data.id,
      message: 'Laudo enviado para fila com sucesso.',
    });
  } catch (error) {
    console.error('Erro ClickUp POST task:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Falha ao criar laudo no ClickUp.' });
  }
});

app.get('/api/laudos', requireAuth, async (req, res) => {
  try {
    if (!CLICKUP_API_TOKEN) {
      return res.status(500).json({ error: 'CLICKUP_API_TOKEN não configurado.' });
    }

    const response = await axios.get(
      `https://api.clickup.com/api/v2/list/${LIST_ID}/task?include_closed=true`,
      {
        headers: {
          Authorization: CLICKUP_API_TOKEN,
        },
      }
    );

    const laudos = response.data.tasks
      .map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status.status,
        color: task.status.color,
        date_created: task.date_created,
        date_closed: task.date_closed,
      }))
      .sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status] || 99;
        const priorityB = STATUS_PRIORITY[b.status] || 99;

        if (priorityA !== priorityB) return priorityA - priorityB;
        return Number(b.date_created) - Number(a.date_created);
      });

    return res.status(200).json({ success: true, laudos });
  } catch (error) {
    console.error('Erro ClickUp GET tasks:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Falha ao buscar laudos do ClickUp.' });
  }
});

app.patch('/api/laudos/:id/entregue', requireAuth, async (req, res) => {
  try {
    if (!CLICKUP_API_TOKEN) {
      return res.status(500).json({ error: 'CLICKUP_API_TOKEN não configurado.' });
    }

    await axios.put(
      `https://api.clickup.com/api/v2/task/${req.params.id}`,
      { status: 'cpf' },
      {
        headers: {
          Authorization: CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Laudo movido para CPF com sucesso.',
    });
  } catch (error) {
    console.error('Erro ClickUp PATCH task:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Falha ao mover laudo para CPF no ClickUp.' });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'genesis-form-laudos' });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (!req.currentUser) return res.redirect('/login');
  if (req.currentUser.mustChangePassword) return res.redirect('/senha');
  return res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Genesis Form Laudos iniciado na porta ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  if (!CLICKUP_API_TOKEN) {
    console.warn('Aviso: CLICKUP_API_TOKEN não definido no ambiente.');
  }
  if (SESSION_SECRET === 'change-this-session-secret') {
    console.warn('Aviso: SESSION_SECRET usando valor padrão. Troque em produção.');
  }
});
