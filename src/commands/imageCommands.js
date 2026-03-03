const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');
const Jimp = require('jimp');
const axios = require('axios');

async function getImgBuf(msg) {
  const im = msg.message?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
  if (!im) return { buffer: null, im: null };
  const stream = await downloadContentFromMessage(im, 'image');
  let buf = Buffer.from([]);
  for await (const c of stream) buf = Buffer.concat([buf, c]);
  return { buffer: buf, im };
}

async function handle(sock, msg, sender, command, args) {
  const p = config.prefix;

  if (command === 'edit') {
    const prompt = args.join(' ');
    const { buffer, im } = await getImgBuf(msg);
    if (!buffer || !prompt) {
      await sock.sendMessage(sender, { text: `🎨 *AI Image Edit*\n\nImage attach/quote + prompt:\n\`${p}edit add sunset\`\n\n${config.watermark}` });
      return true;
    }
    await sock.sendMessage(sender, { text: '🎨 Processing... ⏳' });
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const base64 = buffer.toString('base64');
        const res = await axios.post(
          `${config.apiBase}/image/editv1?apikey=${config.apiKey}`,
          { image: `data:${im.mimetype||'image/jpeg'};base64,${base64}`, prompt },
          { timeout: 60000 }
        );
        const url = res.data?.result || res.data?.url || res.data?.image || res.data?.output;
        if (!url) throw new Error('No result');
        let imgBuf;
        if (url.startsWith('http')) {
          const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
          imgBuf = Buffer.from(r.data);
        } else if (url.startsWith('data:')) {
          imgBuf = Buffer.from(url.split(',')[1], 'base64');
        } else throw new Error('Bad format');
        await sock.sendMessage(sender, { image: imgBuf, caption: `✅ *AI Edit Done!*\n📝 ${prompt}\n\n${config.watermark}` });
        success = true;
        break;
      } catch (e) {
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!success) await sock.sendMessage(sender, { text: `❌ AI edit failed. Prompt change කරලා try.\n\n${config.watermark}` });
    return true;
  }

  if (command === 'sticker' || command === 's') {
    const { buffer } = await getImgBuf(msg);
    if (!buffer) { await sock.sendMessage(sender, { text: `Image + \`${p}sticker\`` }); return true; }
    await sock.sendMessage(sender, { sticker: buffer });
    return true;
  }

  if (command === 'toimg') {
    const sm = msg.message?.stickerMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
    if (!sm) { await sock.sendMessage(sender, { text: `Sticker quote + \`${p}toimg\`` }); return true; }
    const stream = await downloadContentFromMessage(sm, 'sticker');
    let buf = Buffer.from([]);
    for await (const c of stream) buf = Buffer.concat([buf, c]);
    await sock.sendMessage(sender, { image: buf, caption: `✅\n\n${config.watermark}` });
    return true;
  }

  if (command === 'blur') {
    const { buffer } = await getImgBuf(msg);
    if (!buffer) { await sock.sendMessage(sender, { text: `Image + \`${p}blur [1-20]\`` }); return true; }
    const img = await Jimp.read(buffer);
    img.blur(Math.min(parseInt(args[0]) || 10, 20));
    await sock.sendMessage(sender, { image: await img.getBufferAsync(Jimp.MIME_JPEG), caption: `✅ Blurred!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'enhance') {
    const { buffer } = await getImgBuf(msg);
    if (!buffer) { await sock.sendMessage(sender, { text: `Image + \`${p}enhance\`` }); return true; }
    const img = await Jimp.read(buffer);
    img.contrast(0.2).brightness(0.05);
    await sock.sendMessage(sender, { image: await img.getBufferAsync(Jimp.MIME_JPEG), caption: `✅ Enhanced!\n\n${config.watermark}` });
    return true;
  }

  if (command === 'resize') {
    const { buffer } = await getImgBuf(msg);
    if (!buffer) { await sock.sendMessage(sender, { text: `Image + \`${p}resize 800 600\`` }); return true; }
    const img = await Jimp.read(buffer);
    img.resize(parseInt(args[0]) || 800, parseInt(args[1]) || 600);
    await sock.sendMessage(sender, { image: await img.getBufferAsync(Jimp.MIME_JPEG), caption: `✅ Resized!\n\n${config.watermark}` });
    return true;
  }

  return false;
}
module.exports = { handle };
