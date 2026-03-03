const config = require('./config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');

async function handleStatusUpdate(sock, msg) {
  try {
    if (config.autoStatusSeen) await sock.readMessages([msg.key]).catch(()=>{});
    if (config.autoStatusLike) {
      await sock.sendMessage('status@broadcast', { react: { text: config.autoStatusLikeEmoji, key: msg.key } }).catch(()=>{});
    }
    if (config.autoStatusReply && config.autoStatusReplyMessage) {
      const sender = msg.key.participant || msg.key.remoteJid;
      if (sender && sender !== 'status@broadcast')
        await sock.sendMessage(sender, { text: `${config.autoStatusReplyMessage}\n\n${config.watermark}` }).catch(()=>{});
    }
    if (config.autoStatusSave) {
      const type = Object.keys(msg.message || {})[0];
      if (['imageMessage','videoMessage'].includes(type)) {
        await fs.ensureDir('./saved_status');
        const stream = await downloadContentFromMessage(msg.message[type], type.replace('Message',''));
        let buf = Buffer.from([]);
        for await (const c of stream) buf = Buffer.concat([buf, c]);
        await fs.writeFile(`./saved_status/${Date.now()}.${type==='imageMessage'?'jpg':'mp4'}`, buf);
      }
    }
  } catch(e) {}
}
module.exports = { handleStatusUpdate };
