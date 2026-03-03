const config = require('../config');
const axios = require('axios');

async function handle(sock, msg, sender, command, args) {
  const p = config.prefix;

  if (command === 'yt' || command === 'youtube') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `\`${p}yt [url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ YouTube downloading...' });
    try {
      const res = await axios.get(`https://api.fabdl.com/youtube/mp4?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const dlUrl = res.data?.result?.download_url;
      if (!dlUrl) throw new Error('No URL');
      const vid = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 60000 });
      await sock.sendMessage(sender, { video: Buffer.from(vid.data), caption: `✅ YouTube\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ YouTube failed. Try: ytmp3.cc` }); }
    return true;
  }

  if (command === 'tt' || command === 'tiktok') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `\`${p}tt [url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ TikTok downloading...' });
    try {
      const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const vUrl = res.data?.video?.noWatermark || res.data?.video?.watermark;
      if (!vUrl) throw new Error('No video');
      const vid = await axios.get(vUrl, { responseType: 'arraybuffer', timeout: 40000 });
      await sock.sendMessage(sender, { video: Buffer.from(vid.data), caption: `✅ TikTok\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ TikTok failed!` }); }
    return true;
  }

  if (command === 'fb' || command === 'facebook') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `\`${p}fb [url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ Facebook downloading...' });
    try {
      const res = await axios.post('https://fdownloader.net/api', { url }, { timeout: 15000 });
      const links = res.data?.links || {};
      const vUrl = links['HD Download'] || links['SD Download'] || Object.values(links)[0];
      if (!vUrl) throw new Error('No URL');
      const vid = await axios.get(vUrl, { responseType: 'arraybuffer', timeout: 50000 });
      await sock.sendMessage(sender, { video: Buffer.from(vid.data), caption: `✅ Facebook\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ Facebook failed!` }); }
    return true;
  }

  if (command === 'ig' || command === 'instagram') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `\`${p}ig [url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ Instagram downloading...' });
    try {
      const res = await axios.get(`https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index?url=${encodeURIComponent(url)}`, {
        headers: { 'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com', 'X-RapidAPI-Key': 'free' },
        timeout: 15000
      });
      const mUrl = res.data?.media || res.data?.url;
      if (!mUrl) throw new Error('No media');
      const media = await axios.get(mUrl, { responseType: 'arraybuffer', timeout: 40000 });
      await sock.sendMessage(sender, { image: Buffer.from(media.data), caption: `✅ Instagram\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ Instagram failed!` }); }
    return true;
  }

  if (command === 'ttlike') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `\`${p}ttlike [url]\`` }); return true; }
    try {
      const res = await axios.get(`${config.apiBase}/tools/ttlike?apikey=${config.apiKey}&url=${encodeURIComponent(url)}`, { timeout: 20000 });
      await sock.sendMessage(sender, { text: `✅ *TikTok Like Sent!*\n\n${JSON.stringify(res.data?.result||res.data,null,2)}\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ Error!` }); }
    return true;
  }

  if (command === 'ff' || command === 'freefire') {
    const uid = args[0];
    if (!uid) { await sock.sendMessage(sender, { text: `\`${p}ff [uid]\`` }); return true; }
    try {
      const res = await axios.get(`${config.apiBase}/stalker/freefire?apikey=${config.apiKey}&uid=${uid}`, { timeout: 15000 });
      const d = res.data;
      await sock.sendMessage(sender, {
        text: `🎮 *FREE FIRE*\n\n👤 ${d?.basicInfo?.nickname||d?.name||'N/A'}\n⭐ Level: ${d?.basicInfo?.level||'N/A'}\n🏆 Points: ${d?.rankingInfo?.brRankPoint||'N/A'}\n❤️ Likes: ${d?.socialInfo?.likes||'N/A'}\n🌍 Region: ${d?.basicInfo?.region||'N/A'}\n\n${config.watermark}`
      });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ Error!` }); }
    return true;
  }

  if (command === 'weather' || command === 'w') {
    const city = args.join(' ') || 'Colombo';
    try {
      const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 8000 });
      const c = res.data.current_condition[0];
      const a = res.data.nearest_area[0];
      await sock.sendMessage(sender, {
        text: `🌤️ *${a.areaName[0].value}*\n\n🌡️ ${c.temp_C}°C | ☁️ ${c.weatherDesc[0].value}\n💧 ${c.humidity}% | 💨 ${c.windspeedKmph}km/h\n\n${config.watermark}`
      });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ Weather error!` }); }
    return true;
  }

  if (command === 'translate' || command === 'tr') {
    const lang = args[0] || 'si';
    const text = args.slice(1).join(' ');
    if (!text) { await sock.sendMessage(sender, { text: `\`${p}tr si text here\`` }); return true; }
    try {
      const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`, { timeout: 8000 });
      await sock.sendMessage(sender, { text: `🌐 ${res.data[0][0][0]}\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ Translation error!` }); }
    return true;
  }

  if (command === 'ai' || command === 'ask') {
    const q = args.join(' ');
    if (!q) { await sock.sendMessage(sender, { text: `\`${p}ai question\`` }); return true; }
    await sock.sendPresenceUpdate('composing', sender);
    try {
      const res = await axios.get(`${config.apiBase}/ai/claude?apikey=${config.apiKey}&q=${encodeURIComponent(q)}`, { timeout: 25000 });
      const reply = res.data?.result || res.data?.response || res.data?.answer || res.data?.text || 'No reply';
      await sock.sendMessage(sender, { text: `🤖 ${reply}\n\n${config.watermark}` });
    } catch(e) { await sock.sendMessage(sender, { text: `❌ AI error!` }); }
    return true;
  }

  if (command === 'joke') {
    const jokes = ["Teacher: Why late?\nStudent: Sign said 'Go Slow' 😂", "Bug free code?\nThat's just untested code 😅"];
    await sock.sendMessage(sender, { text: `😂 ${jokes[Math.floor(Math.random()*jokes.length)]}\n\n${config.watermark}` });
    return true;
  }

  if (command === 'fact') {
    const facts = ["🐙 Octopuses have 3 hearts!", "🍯 Honey never expires!", "🧠 Brain uses 20% body energy!"];
    await sock.sendMessage(sender, { text: `🧠 ${facts[Math.floor(Math.random()*facts.length)]}\n\n${config.watermark}` });
    return true;
  }

  if (command === 'quote') {
    const quotes = ["ජීවිතය කෙටිය, සිහිනය දිගය.", "Life is short, make it count."];
    await sock.sendMessage(sender, { text: `💬 _"${quotes[Math.floor(Math.random()*quotes.length)]}"_\n\n${config.watermark}` });
    return true;
  }

  return false;
}
module.exports = { handle };
