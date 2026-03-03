const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs-extra');

const DB_DIR = path.join(__dirname, '../auth_info');
fs.ensureDirSync(DB_DIR);

const db = low(new FileSync(path.join(DB_DIR, 'database.json')));
db.defaults({ users: [], stats: { messages: {}, media: {} }, customCommands: {} }).write();

module.exports = {
  // Users
  getUser: (num) => db.get('users').find({ number: num }).value(),
  saveUser: (num, data) => {
    if (db.get('users').find({ number: num }).value())
      db.get('users').find({ number: num }).assign({ ...data, updatedAt: Date.now() }).write();
    else
      db.get('users').push({ number: num, ...data, createdAt: Date.now() }).write();
  },
  getAllUsers: () => db.get('users').value(),
  getUserCount: () => db.get('users').value().length,

  // Stats
  trackMessage: (num, type) => {
    const today = new Date().toDateString();
    const cur = db.get(`stats.messages.${today}.${num}`).value() || 0;
    db.set(`stats.messages.${today}.${num}`, cur + 1).write();
    const media = ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'];
    if (media.includes(type)) {
      const cm = db.get(`stats.media.${today}.${type}`).value() || 0;
      db.set(`stats.media.${today}.${type}`, cm + 1).write();
    }
  },
  getStats: () => {
    const today = new Date().toDateString();
    return {
      messages: db.get(`stats.messages.${today}`).value() || {},
      media: db.get(`stats.media.${today}`).value() || {}
    };
  },

  // Custom Commands
  getCustomCommands: () => db.get('customCommands').value() || {},
  setCustomCommand: (cmd, reply) => db.set(`customCommands.${cmd}`, reply).write(),
  deleteCustomCommand: (cmd) => { db.unset(`customCommands.${cmd}`).write(); },
};
