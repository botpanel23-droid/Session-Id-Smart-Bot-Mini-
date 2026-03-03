const config = require('../config');
const database = require('../database');
const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function handle(sock, msg, sender, command, args, body) {
  const p = config.prefix;
  const senderJid = msg.key.participant || sender;
  const senderNum = senderJid.split('@')[0];
  const isOwner = senderNum === config.ownerNumber;

  // ── Custom commands check ──────────────────────────────
  const custom = database.getCustomCommands();
  if (custom[command]) {
    await sock.sendMessage(sender, { text: `${custom[command]}\n\n${config.watermark}` });
    return true;
  }

  // ── MENU ──────────────────────────────────────────────
  if (command === 'menu' || command === 'help' || command === 'start') {
    const menuText = `╔═══════════════════════╗
║   💎 *${config.botName}* 💎   ║  
╚═══════════════════════╝

👋 *${msg.pushName || 'User'}*
🤖 *v${config.botVersion}*  |  Prefix: \`${p}\`

━━━━ 🎨 *IMAGE* ━━━━
\`${p}edit\` \`${p}sticker\` \`${p}toimg\`
\`${p}blur\` \`${p}enhance\` \`${p}resize\`

━━━━ 📥 *DOWNLOAD* ━━━━
\`${p}yt\` \`${p}tt\` \`${p}fb\` \`${p}ig\`
\`${p}ttlike\`

━━━━ 🎮 *TOOLS* ━━━━
\`${p}ff\` \`${p}ai\` \`${p}weather\`
\`${p}translate\` \`${p}joke\` \`${p}fact\`

━━━━ 👥 *GROUP* ━━━━
\`${p}tagall\` \`${p}kick\` \`${p}add\`
\`${p}promote\` \`${p}demote\` \`${p}mute\`
\`${p}link\` \`${p}poll\` \`${p}warn\`
\`${p}announce\` \`${p}members\` \`${p}leave\`
\`${p}groupinfo\` \`${p}setname\` \`${p}setdesc\`

━━━━ ⚙️ *SETTINGS* ━━━━
\`${p}settings\` \`${p}aimode\`
\`${p}anticall\` \`${p}antidelete\`

━━━━ 🔧 *SYSTEM* ━━━━
\`${p}ping\` \`${p}info\` \`${p}stats\`
\`${p}bot\` \`${p}update\` \`${p}save\`

━━━━━━━━━━━━━━━━━━━━━━
🌐 ${config.panelUrl}
${config.watermark}`;

    try {
      if (config.menuImage) {
        await sock.sendMessage(sender, {
          image: { url: config.menuImage },
          caption: menuText,
          buttons: [{ buttonId: `${p}ping`, buttonText: { displayText: '🏓 Ping Bot' }, type: 1 }],
          footer: `💎 ${config.botName} v${config.botVersion}`
        });
      } else {
        await sock.sendMessage(sender, {
          text: menuText,
          buttons: [{ buttonId: `${p}ping`, buttonText: { displayText: '🏓 Ping Bot' }, type: 1 }],
          footer: `💎 ${config.botName}`
        });
      }
    } catch(e) {
      await sock.sendMessage(sender, { text: menuText });
    }
    return true;
  }

  if (command === 'ping') {
    const t = Date.now();
    await sock.sendMessage(sender, { text: `🏓 *Pong!*\n⚡ ${Date.now()-t}ms\n\n${config.watermark}` });
    return true;
  }

  if (command === 'info') {
    const up = process.uptime();
    const h = Math.floor(up/3600), m = Math.floor((up%3600)/60);
    await sock.sendMessage(sender, {
      text: `🤖 *BOT INFO*\n\n🏷️ ${config.botName} v${config.botVersion}\n⏱️ Uptime: ${h}h ${m}m\n👑 Owner: ${config.ownerName}\n👥 Users: ${database.getUserCount()}\n\n${config.aiMode?'✅':'❌'} AI  ${config.antiCall?'✅':'❌'} AntiCall  ${config.antiDelete?'✅':'❌'} AntiDelete\n\n${config.watermark}`
    });
    return true;
  }

  if (command === 'stats') {
    const s = database.getStats();
    const u = Object.keys(s.messages).length;
    const m = Object.values(s.messages).reduce((a,b)=>a+b,0);
    const media = Object.entries(s.media).map(([k,v])=>`• ${k.replace('Message','')}: ${v}`).join('\n') || '• None';
    await sock.sendMessage(sender, { text: `📊 *TODAY STATS*\n\n👥 Users: *${u}*\n💬 Messages: *${m}*\n\n📁 Media:\n${media}\n\n${config.watermark}` });
    return true;
  }

  if (command === 'settings') {
    await sock.sendMessage(sender, {
      text: `⚙️ *SETTINGS*\n\n${config.autoSeen?'✅':'❌'} Auto Seen\n${config.autoTyping?'✅':'❌'} Auto Typing\n${config.alwaysOnline?'✅':'❌'} Always Online\n${config.autoStatusSeen?'✅':'❌'} Status Seen\n${config.autoStatusLike?'✅':'❌'} Status Like\n${config.autoStatusReply?'✅':'❌'} Status Reply\n${config.autoStatusSave?'✅':'❌'} Status Save\n${config.greetingAutoReply?'✅':'❌'} Greeting\n${config.aiMode?'✅':'❌'} AI Mode\n${config.antiCall?'✅':'❌'} Anti Call\n${config.antiDelete?'✅':'❌'} Anti Delete\n${config.oneViewReveal?'✅':'❌'} One View\n${config.autoContactSave?'✅':'❌'} Contact Save\n\nToggle: \`${p}[setting] on/off\`\n\n${config.watermark}`
    });
    return true;
  }

  // Toggles
  const toggles = {
    'autoseen':['autoSeen','Auto Seen'],'autolike':['autoStatusLike','Auto Like'],
    'autoreply':['autoStatusReply','Auto Reply'],'alwaysonline':['alwaysOnline','Always Online'],
    'autotyping':['autoTyping','Auto Typing'],'aimode':['aiMode','AI Mode'],
    'anticall':['antiCall','Anti Call'],'antidelete':['antiDelete','Anti Delete'],
    'oneview':['oneViewReveal','One View'],'contactsave':['autoContactSave','Contact Save'],
    'autostatus':['autoStatusSeen','Status Seen'],'autosave':['autoStatusSave','Status Save'],
  };
  if (toggles[command]) {
    const [key, label] = toggles[command];
    const val = args[0]?.toLowerCase();
    if (val === 'on') { config[key] = true; await sock.sendMessage(sender, { text: `✅ *${label}* ON!\n\n${config.watermark}` }); }
    else if (val === 'off') { config[key] = false; await sock.sendMessage(sender, { text: `❌ *${label}* OFF!\n\n${config.watermark}` }); }
    else await sock.sendMessage(sender, { text: `*${label}*: ${config[key]?'✅ ON':'❌ OFF'}\n\`${p}${command} on/off\`` });
    return true;
  }

  // ── Custom command management ──────────────────────────
  if (command === 'addcmd') {
    if (!isOwner) { await sock.sendMessage(sender, { text: `❌ Owner only!` }); return true; }
    const cmd = args[0]?.toLowerCase();
    const reply = args.slice(1).join(' ');
    if (!cmd || !reply) { await sock.sendMessage(sender, { text: `\`${p}addcmd commandname Reply text\`` }); return true; }
    database.setCustomCommand(cmd, reply);
    await sock.sendMessage(sender, { text: `✅ \`${p}${cmd}\` added!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'delcmd') {
    if (!isOwner) { await sock.sendMessage(sender, { text: `❌ Owner only!` }); return true; }
    const cmd = args[0]?.toLowerCase();
    if (!cmd) { await sock.sendMessage(sender, { text: `\`${p}delcmd commandname\`` }); return true; }
    database.deleteCustomCommand(cmd);
    await sock.sendMessage(sender, { text: `✅ \`${p}${cmd}\` deleted!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'listcmd') {
    const cmds = database.getCustomCommands();
    const list = Object.entries(cmds).map(([k,v])=>`• \`${p}${k}\` → ${v.substring(0,40)}`).join('\n') || 'No custom commands';
    await sock.sendMessage(sender, { text: `📋 *Custom Commands*\n\n${list}\n\n${config.watermark}` });
    return true;
  }

  if (command === 'bot') {
    const num = args[0]?.replace(/[^0-9]/g, '');
    if (!num) {
      await sock.sendMessage(sender, { text: `🚀 *Bot Deploy*\n\nUsage: \`${p}bot 94xxxxxxxxx\`\n\n🌐 ${config.panelUrl}/connect\n\n${config.watermark}` });
      return true;
    }
    try {
      await sock.sendMessage(`${num}@s.whatsapp.net`, {
        text: `💎 *${config.botName} Deploy Info*\n\n✅ Bot deploy කරගන්න:\n\n🌐 *${config.panelUrl}/connect*\n\nQR scan කරලා connect!\n\n${config.watermark}`
      });
      await sock.sendMessage(sender, { text: `✅ Deploy info sent to ${num}!\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ Error: ${e.message}` }); }
    return true;
  }

  if (command === 'save') {
    const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!q) { await sock.sendMessage(sender, { text: `Status quote + \`${p}save\`` }); return true; }
    try {
      const type = q.imageMessage ? 'image' : q.videoMessage ? 'video' : null;
      if (!type) { await sock.sendMessage(sender, { text: `Image/Video quote කරන්න!` }); return true; }
      const stream = await downloadContentFromMessage(q[`${type}Message`], type);
      let buf = Buffer.from([]);
      for await (const c of stream) buf = Buffer.concat([buf, c]);
      const fs = require('fs-extra');
      await fs.ensureDir('./saved_status');
      await fs.writeFile(`./saved_status/${Date.now()}.${type==='image'?'jpg':'mp4'}`, buf);
      await sock.sendMessage(sender, { [type]: buf, caption: `✅ Saved!\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ ${e.message}` }); }
    return true;
  }

  if (command === 'update') {
    if (!isOwner) { await sock.sendMessage(sender, { text: `❌ Owner only!` }); return true; }
    try {
      const git = require('simple-git')('./');
      await git.fetch();
      const st = await git.status();
      if (st.behind > 0) {
        await git.pull();
        await sock.sendMessage(sender, { text: `✅ Updated! ${st.behind} commits. Restarting...\n\n${config.watermark}` });
        setTimeout(() => process.exit(0), 2000);
      } else {
        await sock.sendMessage(sender, { text: `✅ Already up to date!\n\n${config.watermark}` });
      }
    } catch(e) { await sock.sendMessage(sender, { text: `❌ Error: ${e.message}` }); }
    return true;
  }

  return false;
}
module.exports = { handle };
