const config = require('./config');
const axios = require('axios');
const database = require('./database');
const { handleStatusUpdate } = require('./statusHandler');
const imageCommands = require('./commands/imageCommands');
const utilCommands = require('./commands/utilCommands');
const botCommands = require('./commands/botCommands');
const groupCommands = require('./commands/groupCommands');

async function handleMessage(sock, m) {
  try {
    const msg = m.messages[0];
    if (!msg || msg.key.fromMe) return;
    const sender = msg.key.remoteJid;
    if (!sender || sender === 'status@broadcast') return;

    const isGroup = sender.endsWith('@g.us');
    const pushName = msg.pushName || 'User';
    const senderJid = msg.key.participant || sender;
    const senderNum = senderJid.split('@')[0];

    const body = msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.buttonsResponseMessage?.selectedButtonId || '';

    const msgType = Object.keys(msg.message || {})[0] || 'unknown';
    database.trackMessage(senderNum, msgType);

    // Auto contact save
    if (config.autoContactSave) {
      const existing = database.getUser(senderNum);
      if (!existing) {
        database.saveUser(senderNum, { name: pushName, firstSeen: Date.now() });
        try {
          await sock.sendMessage(isGroup ? sender : senderJid, {
            text: `✅ *ඔබව save කළා!*\n\n👤 *${pushName}*\n📱 *${senderNum}*\n\n${config.watermark}`
          });
        } catch(e) {}
      }
    }

    if (config.autoSeen) await sock.readMessages([msg.key]).catch(()=>{});
    const p = config.prefix;
    const isCmd = body.startsWith(p);
    const command = isCmd ? body.slice(p.length).trim().split(' ')[0].toLowerCase() : '';
    const args = isCmd ? body.trim().split(/\s+/).slice(1) : [];

    if (config.autoTyping && isCmd) {
      await sock.sendPresenceUpdate('composing', sender).catch(()=>{});
      await new Promise(r => setTimeout(r, 500));
    }

    // One View Reveal
    if (config.oneViewReveal) {
      const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
      const vo = msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message;
      if (vo) {
        const type = vo.imageMessage ? 'image' : vo.videoMessage ? 'video' : null;
        if (type) {
          try {
            const stream = await downloadContentFromMessage(vo[`${type}Message`], type);
            let buf = Buffer.from([]);
            for await (const c of stream) buf = Buffer.concat([buf, c]);
            await sock.sendMessage(sender, {
              [type]: buf,
              caption: `👁️ *One View Revealed!*\n👤 @${senderNum}\n\n${config.watermark}`,
              mentions: [senderJid]
            });
          } catch(e) {}
        }
      }
    }

    // Greeting
    if (!isCmd && config.greetingAutoReply && !isGroup) {
      const lower = body.toLowerCase().trim();
      if (config.greetingKeywords.some(k => lower === k || lower.startsWith(k+' '))) {
        const user = database.getUser(senderNum);
        await sock.sendMessage(sender, {
          text: `👋 *හෙලෝ ${user?.name||pushName}!*\n\n💡 \`${p}menu\`\n\n${config.watermark}`
        });
        return;
      }
    }

    // AI mode
    if (!isCmd && config.aiMode && body.length > 2 && !isGroup) {
      try {
        await sock.sendPresenceUpdate('composing', sender);
        const res = await axios.get(`${config.apiBase}/ai/claude?apikey=${config.apiKey}&q=${encodeURIComponent(body)}`, { timeout: 25000 });
        const reply = res.data?.result || res.data?.response || res.data?.answer || res.data?.text;
        if (reply) await sock.sendMessage(sender, { text: `🤖 ${reply}\n\n${config.watermark}` });
      } catch(e) {}
      return;
    }

    if (!isCmd) return;

    const handled =
      await groupCommands.handle(sock, msg, sender, command, args, body) ||
      await imageCommands.handle(sock, msg, sender, command, args, body) ||
      await utilCommands.handle(sock, msg, sender, command, args, body) ||
      await botCommands.handle(sock, msg, sender, command, args, body);

    if (!handled) {
      await sock.sendMessage(sender, { text: `❓ \`${p}${command}\` නෑ.\n💡 \`${p}menu\`\n\n${config.watermark}` });
    }
  } catch(e) { console.log('[MSG ERROR]', e.message); }
}
module.exports = { handleMessage };
