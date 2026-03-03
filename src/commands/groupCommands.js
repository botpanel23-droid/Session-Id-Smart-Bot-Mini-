const config = require('../config');

async function handle(sock, msg, sender, command, args, body) {
  if (!sender.endsWith('@g.us')) return false;
  const p = config.prefix;
  const senderJid = msg.key.participant || sender;
  const senderNum = senderJid.split('@')[0];
  const isOwner = senderNum === config.ownerNumber;

  let meta, parts = [], botAdmin = false, senderAdmin = false;
  try {
    meta = await sock.groupMetadata(sender);
    parts = meta.participants;
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    botAdmin = parts.find(x => x.id === botId)?.admin != null;
    senderAdmin = parts.find(x => x.id === senderJid)?.admin != null;
  } catch(e) { return false; }

  const canUse = senderAdmin || isOwner;

  if (command === 'tagall' || command === 'all') {
    if (!canUse) { await sock.sendMessage(sender, { text: `❌ Admin only!` }); return true; }
    const text = args.join(' ') || '📢 Everyone!';
    const jids = parts.map(x => x.id);
    await sock.sendMessage(sender, { text: `📢 *${text}*\n\n${jids.map(j=>`@${j.split('@')[0]}`).join(' ')}\n\n${config.watermark}`, mentions: jids });
    return true;
  }

  if (command === 'kick' || command === 'remove') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!m.length) { await sock.sendMessage(sender, { text: `@user mention + \`${p}kick\`` }); return true; }
    await sock.groupParticipantsUpdate(sender, m, 'remove');
    await sock.sendMessage(sender, { text: `✅ Kicked!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'add') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    const num = args[0]?.replace(/[^0-9]/g, '');
    if (!num) { await sock.sendMessage(sender, { text: `\`${p}add 94xxxxxxxx\`` }); return true; }
    await sock.groupParticipantsUpdate(sender, [`${num}@s.whatsapp.net`], 'add');
    await sock.sendMessage(sender, { text: `✅ Added!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'promote') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!m.length) { await sock.sendMessage(sender, { text: `@user mention + \`${p}promote\`` }); return true; }
    await sock.groupParticipantsUpdate(sender, m, 'promote');
    await sock.sendMessage(sender, { text: `✅ Promoted!\n\n${config.watermark}`, mentions: m });
    return true;
  }

  if (command === 'demote') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!m.length) { await sock.sendMessage(sender, { text: `@user mention + \`${p}demote\`` }); return true; }
    await sock.groupParticipantsUpdate(sender, m, 'demote');
    await sock.sendMessage(sender, { text: `✅ Demoted!\n\n${config.watermark}`, mentions: m });
    return true;
  }

  if (command === 'mute') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    await sock.groupSettingUpdate(sender, 'announcement');
    await sock.sendMessage(sender, { text: `🔇 Muted!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'unmute' || command === 'open') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    await sock.groupSettingUpdate(sender, 'not_announcement');
    await sock.sendMessage(sender, { text: `🔊 Opened!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'groupinfo' || command === 'ginfo') {
    const admins = parts.filter(x => x.admin);
    await sock.sendMessage(sender, {
      text: `📊 *GROUP INFO*\n\n👥 *${meta.subject}*\n👤 Members: *${parts.length}*\n📝 ${meta.desc?.substring(0,80)||'N/A'}\n👑 Admins: ${admins.map(x=>`@${x.id.split('@')[0]}`).join(', ')}\n\n${config.watermark}`,
      mentions: admins.map(x => x.id)
    });
    return true;
  }

  if (command === 'link' || command === 'invite') {
    if (!botAdmin) { await sock.sendMessage(sender, { text: `❌ Bot admin නෑ!` }); return true; }
    const code = await sock.groupInviteCode(sender);
    await sock.sendMessage(sender, { text: `🔗 https://chat.whatsapp.com/${code}\n\n${config.watermark}` });
    return true;
  }

  if (command === 'revoke') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    await sock.groupRevokeInvite(sender);
    await sock.sendMessage(sender, { text: `✅ Link revoked!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'leave') {
    if (!isOwner) { await sock.sendMessage(sender, { text: `❌ Owner only!` }); return true; }
    await sock.sendMessage(sender, { text: `👋 Bye!\n\n${config.watermark}` });
    await sock.groupLeave(sender);
    return true;
  }

  if (command === 'announce' || command === 'ann') {
    if (!canUse) { await sock.sendMessage(sender, { text: `❌ Admin only!` }); return true; }
    const text = args.join(' ');
    if (!text) { await sock.sendMessage(sender, { text: `\`${p}announce text\`` }); return true; }
    await sock.sendMessage(sender, { text: `📣 *ANNOUNCEMENT*\n\n${text}\n\n${config.watermark}`, mentions: parts.map(x=>x.id) });
    return true;
  }

  if (command === 'members' || command === 'list') {
    const list = parts.map((x,i) => `${i+1}. @${x.id.split('@')[0]}${x.admin?' 👑':''}`).join('\n');
    await sock.sendMessage(sender, { text: `👥 *Members (${parts.length})*\n\n${list}\n\n${config.watermark}`, mentions: parts.map(x=>x.id) });
    return true;
  }

  if (command === 'poll') {
    const segs = body.replace(`${p}poll`, '').trim().split('|');
    if (segs.length < 3) { await sock.sendMessage(sender, { text: `\`${p}poll Question | Option1 | Option2\`` }); return true; }
    await sock.sendMessage(sender, { poll: { name: segs[0].trim(), values: segs.slice(1).map(s=>s.trim()), selectableCount: 1 } });
    return true;
  }

  if (command === 'warn') {
    if (!canUse) { await sock.sendMessage(sender, { text: `❌ Admin only!` }); return true; }
    const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!m.length) { await sock.sendMessage(sender, { text: `@user mention + \`${p}warn\`` }); return true; }
    const reason = args.filter(a=>!a.startsWith('@')).join(' ') || 'No reason';
    for (const jid of m) {
      await sock.sendMessage(sender, { text: `⚠️ *Warning!*\n👤 @${jid.split('@')[0]}\n📝 ${reason}\n\n${config.watermark}`, mentions: [jid] });
    }
    return true;
  }

  if (command === 'setname' || command === 'rename') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    const name = args.join(' ');
    if (!name) { await sock.sendMessage(sender, { text: `\`${p}setname New Name\`` }); return true; }
    await sock.groupUpdateSubject(sender, name);
    await sock.sendMessage(sender, { text: `✅ Group renamed to *${name}*!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'setdesc') {
    if (!canUse || !botAdmin) { await sock.sendMessage(sender, { text: `❌ Admin needed!` }); return true; }
    const desc = args.join(' ');
    await sock.groupUpdateDescription(sender, desc);
    await sock.sendMessage(sender, { text: `✅ Description updated!\n\n${config.watermark}` });
    return true;
  }

  return false;
}
module.exports = { handle };
