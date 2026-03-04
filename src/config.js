module.exports = {
  panelPort: process.env.PORT || 3000,
  panelUrl: process.env.PANEL_URL || 'http://localhost:3000',
  panelSecret: process.env.SESSION_SECRET || 'chalahmd-secret',
  githubRepo: process.env.GITHUB_REPO || '',

  botName: 'CHALAH MD',
  botVersion: '3.0.0',
  prefix: '.',
  watermark: '> 💎 *CHALAH MD*',

  // LOCKED - panel වෙනස් කරන්න බෑ
  ownerNumber: '94742271802',
  ownerName: 'CHALAH',
  logoImage: 'https://files.catbox.moe/3czty1.jpg',
  menuImage: 'https://files.catbox.moe/3czty1.jpg',
  connectImage: 'https://files.catbox.moe/3czty1.jpg',

  alwaysOnline: true,
  autoTyping: true,
  autoSeen: true,
  autoStatusSeen: true,
  autoStatusLike: true,
  autoStatusLikeEmoji: '❤️',
  autoStatusSave: false,
  autoStatusReply: true,
  autoStatusReplyMessage: '✨ Your Status Reade By > CHALAH MD MINI!',
  greetingAutoReply: true,
  greetingKeywords: ['hi','hello','hii','hey','hy','හෙලෝ','හායි'],

  aiMode: false,
  antiCall: false,
  antiDelete: false,
  oneViewReveal: true,
  autoContactSave: true,

  apiKey: 'dex_hQO5V4ggt814y1XIMPZQKvSIyz1fdUI4qkHYXtJnruZmTLwp',
  apiBase: 'https://public-apis-site-1b025aa8b541.herokuapp.com/api',
};
