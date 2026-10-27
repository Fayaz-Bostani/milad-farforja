// تغییرات دیتابیس piece12 (جدول‌های یادداشت‌ها) — استفاده:  node migrate-piece12.js
// بی‌خطر است و هر چند بار اجرا شود فقط چیزهای نبوده را می‌سازد.
require('dotenv').config();
const db = require('./db');

const TABLES = [
  ['notes', `CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    body MEDIUMTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_notes_user (user_id)
  ) DEFAULT CHARSET=utf8mb4`],
  ['note_files', `CREATE TABLE IF NOT EXISTS note_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    note_id INT NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    original_name VARCHAR(255) NULL,
    mime_type VARCHAR(120) NULL,
    size INT NOT NULL DEFAULT 0,
    file_data MEDIUMBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_nf_note (note_id)
  ) DEFAULT CHARSET=utf8mb4`],
  ['note_shares', `CREATE TABLE IF NOT EXISTS note_shares (
    id INT AUTO_INCREMENT PRIMARY KEY,
    note_id INT NOT NULL,
    user_id INT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    shared_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_note_user (note_id, user_id),
    KEY idx_ns_user (user_id)
  ) DEFAULT CHARSET=utf8mb4`],
];

(async () => {
  for (const [name, sql] of TABLES) {
    try {
      const [[before]] = await db.query('SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [name]);
      await db.query(sql);
      console.log(before.c ? `✔️ قبلاً بوده: ${name}` : `✅ ساخته شد: ${name}`);
    } catch (err) { console.log(`❌ ${name}: ${err.message}`); }
  }
  console.log('\nتمام شد.');
  await db.end();
})();
