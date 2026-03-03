// ══════════════════════════════════════════════════════
//  CHALAH MD v3.0 | © CHALAH | wa.me/94742271802
// ══════════════════════════════════════════════════════
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const cron = require('node-cron');
const QRCode = require('qrcode');
const axios = require('axios');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  getContentType,
  downloadContentFromMessage,
  Browsers,
} = require('@whiskeysockets/baileys');

const config = require('./src/config');
const { handleMessage } = require('./src/messageHandler');
const { handleStatusUpdate } = require('./src/statusHandler');
const database = require('./src/database');

const AUTH_DIR = path.join(__dirname, 'auth_info');
fs.ensureDirSync(AUTH_DIR);
const logger = pino({ level: 'silent' });

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'panel/public')));
app.use(session({
  secret: config.panelSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 }
}));

let sock = null;
let isConnected = false;
const deletedMsgs = new Map();

// ══════════════════════════════════════════════════════
//  SESSION ID SYSTEM
//  Connect → auth_info bundle → base64 Session ID
//  Redeploy → paste Session ID → auth_info restore → bot starts
// ══════════════════════════════════════════════════════

async function generateSessionId() {
  try {
    if (!fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) return null;
    const bundle = {};
    for (const file of fs.readdirSync(AUTH_DIR)) {
      if (file.endsWith('.json')) {
        bundle[file] = fs.readFileSync(path.join(AUTH_DIR, file), 'utf8');
      }
    }
    return 'CHALAH3_' + Buffer.from(JSON.stringify(bundle)).toString('base64');
  } catch (e) { return null; }
}

async function restoreFromSessionId(sessionId) {
  try {
    if (!sessionId || !sessionId.startsWith('CHALAH3_')) {
      return { success: false, message: 'Invalid Session ID. CHALAH3_ වලින් පටන් ගන්නා ID එකක් දාන්න.' };
    }
    const raw = Buffer.from(sessionId.replace('CHALAH3_', ''), 'base64').toString('utf8');
    const bundle = JSON.parse(raw);
    if (!bundle['creds.json']) {
      return { success: false, message: 'Session ID invalid - creds නෑ.' };
    }
    await fs.remove(AUTH_DIR);
    await fs.ensureDir(AUTH_DIR);
    for (const [file, content] of Object.entries(bundle)) {
      fs.writeFileSync(path.join(AUTH_DIR, file), content, 'utf8');
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Session ID decode error: ' + e.message };
  }
}

// ─── Helpers ─────────────────────────────────────────────
function writeStatus(data) {
  try { fs.writeJsonSync(path.join(AUTH_DIR, 'pairing_status.json'), data); io.emit('statusUpdate', data); } catch (e) {}
}

async function sendConnectMsg(s, botJid, botNum, otp, sessionId) {
  const text = `╔═══════════════════════╗\n║  💎 *CHALAH MD CONNECTED!*  ║\n╚═══════════════════════╝\n\n✅ *Bot Connected!*\n📱 *Number:* ${botNum}\n🔐 *Panel OTP:* \`${otp}\`\n🌐 *Panel:* ${config.panelUrl}\n\n━━━━━━━━━━━━━━━━━━━━━━\n🔑 *SESSION ID* _(save කරගන්න!)_\n\n\`\`\`${sessionId || 'Generating...'}\`\`\`\n\n⚠️ _Redeploy කරද්දි මේ ID panel ට දාන්න. QR/Pair නොකර bot start වෙනවා!_\n\n> 💎 *CHALAH MD*`;
  try {
    await s.sendMessage(botJid, { image: { url: config.connectImage }, caption: text });
  } catch (e) {
    try { await s.sendMessage(botJid, { text }); } catch (e2) {}
  }
}

// ─── Bot Handlers ─────────────────────────────────────────
function attachHandlers(s) {
  s.ev.on('messages.upsert', async (m) => {
    if (!isConnected) return;
    for (const msg of m.messages) {
      if (!msg.message) continue;
      if (config.antiDelete && !msg.key.fromMe && msg.key.id) {
        deletedMsgs.set(msg.key.id, msg);
        setTimeout(() => deletedMsgs.delete(msg.key.id), 300000);
      }
      if (msg.key.remoteJid === 'status@broadcast') await handleStatusUpdate(s, msg);
      else { await handleMessage(s, m); break; }
    }
  });

  s.ev.on('messages.delete', async (item) => {
    if (!config.antiDelete) return;
    for (const key of (item.keys || [])) {
      const stored = deletedMsgs.get(key.id);
      if (!stored) continue;
      const chat = key.remoteJid, from = key.participant || chat;
      const mtype = getContentType(stored.message);
      try {
        if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
          const txt = stored.message?.conversation || stored.message?.extendedTextMessage?.text || '(msg)';
          await s.sendMessage(chat, { text: `🗑️ *Anti-Delete!*\n👤 @${from.split('@')[0]}\n📝 ${txt}\n\n> 💎 *CHALAH MD*`, mentions: [from] });
        } else if (mtype === 'imageMessage') {
          const stream = await downloadContentFromMessage(stored.message.imageMessage, 'image');
          let buf = Buffer.from([]); for await (const c of stream) buf = Buffer.concat([buf, c]);
          await s.sendMessage(chat, { image: buf, caption: `🗑️ Anti-Delete\n👤 @${from.split('@')[0]}\n\n> 💎 *CHALAH MD*`, mentions: [from] });
        } else if (mtype === 'videoMessage') {
          const stream = await downloadContentFromMessage(stored.message.videoMessage, 'video');
          let buf = Buffer.from([]); for await (const c of stream) buf = Buffer.concat([buf, c]);
          await s.sendMessage(chat, { video: buf, caption: `🗑️ Anti-Delete\n👤 @${from.split('@')[0]}\n\n> 💎 *CHALAH MD*`, mentions: [from] });
        }
      } catch (e) {}
      deletedMsgs.delete(key.id);
    }
  });

  s.ev.on('call', async (calls) => {
    if (!config.antiCall) return;
    for (const call of calls) {
      if (call.status === 'offer') {
        try { await s.rejectCall(call.id, call.from); } catch (e) {}
        try { await s.sendMessage(call.from, { text: `🚫 *Call Rejected!*\nකරුණාකර call නොකරන්න!\n\n_AI generated_\n\n> 💎 *CHALAH MD*` }); } catch (e) {}
      }
    }
  });
}

function setupCron(botJid) {
  if (config.githubRepo) {
    cron.schedule('*/30 * * * *', async () => {
      try {
        const git = require('simple-git')(__dirname);
        await git.fetch();
        const st = await git.status();
        if (st.behind > 0) {
          await git.pull();
          if (sock && isConnected) try { await sock.sendMessage(botJid, { text: `🔄 Auto Updated! Restarting...\n\n> 💎 *CHALAH MD*` }); } catch (e) {}
          setTimeout(() => process.exit(0), 2000);
        }
      } catch (e) {}
    });
  }
}

// ══════════════════════════════════════════════════════
//  BOT START (saved session)
// ══════════════════════════════════════════════════════
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    if (sock) { try { sock.end(); sock.ws?.close(); } catch (e) {} }

    sock = makeWASocket({
      version, logger, printQRInTerminal: false,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: config.alwaysOnline,
      syncFullHistory: false, keepAliveIntervalMs: 25000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        isConnected = true;
        const botJid = sock.user.id, botNum = botJid.split(':')[0];
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = await generateSessionId();
        fs.writeJsonSync(path.join(AUTH_DIR, 'otp.json'), { otp, number: botNum, time: Date.now() });
        if (sessionId) fs.writeFileSync(path.join(AUTH_DIR, 'session_id.txt'), sessionId);
        writeStatus({ status: 'connected', number: botNum });
        io.emit('botConnected', { number: botNum, sessionId });
        console.log(`[BOT] ✅ Connected: ${botNum}`);
        await sendConnectMsg(sock, botJid, botNum, otp, sessionId);
        attachHandlers(sock);
        setupCron(botJid);
      }
      if (connection === 'close') {
        isConnected = false; writeStatus({ status: 'disconnected' });
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) setTimeout(() => startBot(), 5000);
      }
    });
  } catch (e) { console.error('[BOT ERROR]', e.message); setTimeout(() => startBot(), 5000); }
}

// ══════════════════════════════════════════════════════
//  QR SESSION
// ══════════════════════════════════════════════════════
async function startQRSession() {
  if (sock) { try { sock.end(); sock.ws?.close(); } catch (e) {} sock = null; isConnected = false; }
  await fs.remove(AUTH_DIR); await fs.ensureDir(AUTH_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version, logger, printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: config.alwaysOnline,
    keepAliveIntervalMs: 25000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
  });
  sock.ev.on('creds.update', saveCreds);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('QR timeout')), 60000);
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        clearTimeout(timeout);
        try {
          const qrUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
          io.emit('qrCode', { qr: qrUrl });
          resolve(qrUrl);
        } catch (e) { reject(e); }
      }
      if (connection === 'open') {
        isConnected = true;
        const botJid = sock.user.id, botNum = botJid.split(':')[0];
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = await generateSessionId();
        fs.writeJsonSync(path.join(AUTH_DIR, 'otp.json'), { otp, number: botNum, time: Date.now() });
        if (sessionId) fs.writeFileSync(path.join(AUTH_DIR, 'session_id.txt'), sessionId);
        writeStatus({ status: 'connected', number: botNum });
        io.emit('botConnected', { number: botNum, sessionId });
        await sendConnectMsg(sock, botJid, botNum, otp, sessionId);
        attachHandlers(sock); setupCron(botJid);
      }
      if (connection === 'close') {
        isConnected = false; writeStatus({ status: 'disconnected' });
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) setTimeout(() => startBot(), 5000);
      }
    });
  });
}

// ══════════════════════════════════════════════════════
//  PAIR CODE SESSION
// ══════════════════════════════════════════════════════
async function startPairCodeSession(phoneNumber) {
  if (sock) { try { sock.end(); sock.ws?.close(); } catch (e) {} sock = null; isConnected = false; }
  await fs.remove(AUTH_DIR); await fs.ensureDir(AUTH_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version, logger, printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: config.alwaysOnline,
    keepAliveIntervalMs: 25000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
  });
  sock.ev.on('creds.update', saveCreds);

  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Pair code timeout')), 30000);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        isConnected = true;
        const botJid = sock.user.id, botNum = botJid.split(':')[0];
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = await generateSessionId();
        fs.writeJsonSync(path.join(AUTH_DIR, 'otp.json'), { otp, number: botNum, time: Date.now() });
        if (sessionId) fs.writeFileSync(path.join(AUTH_DIR, 'session_id.txt'), sessionId);
        writeStatus({ status: 'connected', number: botNum });
        io.emit('botConnected', { number: botNum, sessionId });
        await sendConnectMsg(sock, botJid, botNum, otp, sessionId);
        attachHandlers(sock); setupCron(botJid);
      }
      if (connection === 'close') {
        isConnected = false; writeStatus({ status: 'disconnected' });
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) setTimeout(() => startBot(), 5000);
      }
    });

    await new Promise(r => setTimeout(r, 3000));
    try {
      const pairCode = await sock.requestPairingCode(phoneNumber);
      const formatted = pairCode?.match(/.{1,4}/g)?.join('-') || pairCode;
      io.emit('pairCode', { code: formatted });
      clearTimeout(timeout);
      resolve(formatted);
    } catch (e) { clearTimeout(timeout); reject(e); }
  });
}

// ══════════════════════════════════════════════════════
//  API ROUTES
// ══════════════════════════════════════════════════════
app.get('/ping', (req, res) => res.send('OK'));

app.post('/api/qr', async (req, res) => {
  try { res.json({ success: true, qr: await startQRSession() }); }
  catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/pair', async (req, res) => {
  const clean = (req.body.number || '').replace(/[^0-9]/g, '');
  if (clean.length < 9) return res.json({ success: false, message: 'Valid number දාන්න (eg: 94771234567)' });
  try { res.json({ success: true, code: await startPairCodeSession(clean) }); }
  catch (e) { res.json({ success: false, message: e.message }); }
});

// ── SESSION ID RESTORE ───────────────────────────────
app.post('/api/restore-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.json({ success: false, message: 'Session ID required' });

  // Stop current bot
  if (sock) { try { sock.end(); sock.ws?.close(); } catch (e) {} sock = null; isConnected = false; }

  const result = await restoreFromSessionId(sessionId.trim());
  if (!result.success) return res.json(result);

  // Start bot with restored session
  try {
    await startBot();
    res.json({ success: true, message: '✅ Session restore! Bot starting...' });
  } catch (e) {
    res.json({ success: false, message: 'Restore ok but bot start failed: ' + e.message });
  }
});

// ── GET CURRENT SESSION ID ───────────────────────────
app.get('/api/session-id', async (req, res) => {
  try {
    // Try saved file first
    const savedPath = path.join(AUTH_DIR, 'session_id.txt');
    if (fs.existsSync(savedPath)) {
      const id = fs.readFileSync(savedPath, 'utf8').trim();
      return res.json({ success: true, sessionId: id });
    }
    // Generate fresh
    const id = await generateSessionId();
    if (id) {
      fs.writeFileSync(savedPath, id);
      res.json({ success: true, sessionId: id });
    } else {
      res.json({ success: false, message: 'Bot connect කරල නෑ. Session නෑ.' });
    }
  } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/login', (req, res) => {
  try {
    const { number, otp } = req.body;
    const otpData = fs.readJsonSync(path.join(AUTH_DIR, 'otp.json'));
    const status = fs.readJsonSync(path.join(AUTH_DIR, 'pairing_status.json'));
    const botNum = (status.number || '').replace(/\D/g, '');
    const inputNum = (number || '').replace(/\D/g, '');
    const otpOk = otpData.otp === otp && (Date.now() - otpData.time) < 600000;
    const numOk = botNum && inputNum && (botNum.includes(inputNum) || inputNum.includes(botNum));
    if (otpOk && numOk) { req.session.authenticated = true; res.json({ success: true }); }
    else res.json({ success: false, message: 'Invalid number or OTP!' });
  } catch (e) { res.json({ success: false, message: '/connect visit කරන්න!' }); }
});

app.get('/api/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.get('/api/status', (req, res) => {
  try { res.json({ ...fs.readJsonSync(path.join(AUTH_DIR, 'pairing_status.json')), connected: isConnected }); }
  catch (e) { res.json({ status: 'disconnected', connected: false }); }
});

const requireAuth = (req, res, next) => req.session.authenticated ? next() : res.status(401).json({ error: 'Login required' });

app.get('/api/stats', requireAuth, (req, res) => {
  const s = database.getStats();
  res.json({ success: true, totalUsers: Object.keys(s.messages).length, totalMsgs: Object.values(s.messages).reduce((a,b)=>a+b,0), media: s.media, allUsers: database.getUserCount() });
});

app.get('/api/users', requireAuth, (req, res) => {
  res.json({ success: true, users: database.getAllUsers(), count: database.getUserCount() });
});

app.post('/api/send-message', requireAuth, async (req, res) => {
  const { jid, message, imageUrl } = req.body;
  if (!jid || !message) return res.json({ success: false, message: 'JID + message required' });
  if (!isConnected || !sock) return res.json({ success: false, message: 'Bot not connected!' });
  try {
    const target = jid.includes('@') ? jid : `${jid.replace(/\D/g,'')}@s.whatsapp.net`;
    if (imageUrl) await sock.sendMessage(target, { image: { url: imageUrl }, caption: message });
    else await sock.sendMessage(target, { text: message });
    res.json({ success: true, message: `✅ Sent!` });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/channel-react', requireAuth, async (req, res) => {
  const { channelLink, emoji, count } = req.body;
  if (!channelLink || !emoji) return res.json({ success: false, message: 'Link + emoji required' });
  if (!isConnected || !sock) return res.json({ success: false, message: 'Bot not connected!' });
  try {
    const code = channelLink.replace(/https?:\/\/(www\.)?whatsapp\.com\/channel\//,'').split('/')[0].trim();
    const channelJid = `${code}@newsletter`;
    const reactCount = Math.min(parseInt(count)||10, 100);
    let sent = 0;
    const msgs = await sock.fetchMessagesFromWABox(channelJid, { count: 5 }).catch(()=>[]);
    for (const m of (msgs||[]).slice(0,5)) {
      for (let i = 0; i < Math.ceil(reactCount/Math.max((msgs||[]).length,1)) && sent < reactCount; i++) {
        try { await sock.sendMessage(channelJid, { react: { text: emoji, key: m.key } }); sent++; await new Promise(r=>setTimeout(r,400)); } catch(e){}
      }
    }
    res.json({ success: true, message: `✅ ${sent} reacts sent!`, sent });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/config', requireAuth, (req, res) => {
  try {
    delete require.cache[require.resolve('./src/config')];
    const cfg = require('./src/config');
    // Remove locked fields from response so panel can't edit them
    const safe = { ...cfg };
    delete safe.ownerNumber;
    delete safe.logoImage;
    delete safe.menuImage;
    delete safe.connectImage;
    delete safe.apiKey;
    res.json({ success: true, config: safe });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/config', requireAuth, (req, res) => {
  try {
    const updates = req.body;
    const cfgPath = path.join(__dirname, 'src/config.js');
    let content = fs.readFileSync(cfgPath, 'utf8');

    // LOCKED - these cannot be changed via panel
    delete updates.ownerNumber;
    delete updates.ownerName;
    delete updates.logoImage;
    delete updates.menuImage;
    delete updates.connectImage;
    delete updates.apiKey;

    const boolKeys = ['alwaysOnline','autoTyping','autoSeen','autoStatusSeen','autoStatusLike',
      'autoStatusSave','autoStatusReply','greetingAutoReply','aiMode','antiCall','antiDelete',
      'oneViewReveal','autoContactSave'];
    boolKeys.forEach(key => {
      if (updates[key] !== undefined) {
        const val = updates[key] === 'true' || updates[key] === true;
        content = content.replace(new RegExp(`(${key}:\\s*)(true|false)`), `$1${val}`);
        config[key] = val;
      }
    });

    const strKeys = ['botName','prefix','autoStatusLikeEmoji','autoStatusReplyMessage','panelUrl','githubRepo','watermark'];
    strKeys.forEach(key => {
      if (updates[key] !== undefined) {
        content = content.replace(new RegExp(`(${key}:\\s*')([^']*)(')`, 'g'), `$1${updates[key].replace(/'/g,"\\'")}$3`);
        config[key] = updates[key];
      }
    });

    fs.writeFileSync(cfgPath, content);
    delete require.cache[require.resolve('./src/config')];
    if (isConnected && sock) try { sock.sendMessage(sock.user.id, { text: `⚙️ Settings updated!\n\n> 💎 *CHALAH MD*` }); } catch(e){}
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/custom-commands', requireAuth, (req, res) => res.json({ success: true, commands: database.getCustomCommands() }));
app.post('/api/custom-commands', requireAuth, (req, res) => {
  const { cmd, reply } = req.body;
  if (!cmd || !reply) return res.json({ success: false });
  database.setCustomCommand(cmd.toLowerCase(), reply);
  res.json({ success: true });
});
app.delete('/api/custom-commands/:cmd', requireAuth, (req, res) => {
  database.deleteCustomCommand(req.params.cmd);
  res.json({ success: true });
});

app.post('/api/update', requireAuth, async (req, res) => {
  try {
    const git = require('simple-git')(__dirname);
    await git.fetch(); const st = await git.status();
    if (st.behind > 0) {
      await git.pull();
      res.json({ success: true, message: `✅ ${st.behind} commits! Restarting...` });
      if (isConnected && sock) try { await sock.sendMessage(sock.user.id, { text: `🔄 Panel update done! Restarting...\n\n> 💎 *CHALAH MD*` }); } catch(e){}
      setTimeout(() => process.exit(0), 2000);
    } else { res.json({ success: true, message: '✅ Already latest!' }); }
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// Pages
app.get('/', (req, res) => req.session.authenticated ? res.sendFile(path.join(__dirname, 'panel/public/index.html')) : res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'panel/public/login.html')));
app.get('/connect', (req, res) => res.sendFile(path.join(__dirname, 'panel/public/connect.html')));

io.on('connection', (socket) => {
  try { socket.emit('statusUpdate', { ...fs.readJsonSync(path.join(AUTH_DIR, 'pairing_status.json')), connected: isConnected }); }
  catch (e) { socket.emit('statusUpdate', { status: 'disconnected', connected: false }); }
});

// 24/7 self-ping
cron.schedule('*/14 * * * *', async () => {
  if (config.panelUrl && !config.panelUrl.includes('localhost'))
    try { await axios.get(`${config.panelUrl}/ping`, { timeout: 5000 }); } catch(e){}
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n💎 CHALAH MD v3.0 | Port: ${PORT}`);
  console.log(`🌐 Panel:   http://0.0.0.0:${PORT}`);
  console.log(`📱 Connect: http://0.0.0.0:${PORT}/connect\n`);
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    console.log('[BOT] Session found → Starting...');
    startBot();
  } else {
    console.log('[BOT] No session → /connect or /connect (Session ID)');
  }
});
