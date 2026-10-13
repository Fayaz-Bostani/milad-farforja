// اجرای فایل‌های SQL تغییر دیتابیس، بدون نیاز به Workbench
// استفاده:  node run-migrations.js
// از همان تنظیمات .env بک‌اند استفاده می‌کند (DB_NAME باید milad_farforja باشد)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

const FILES = ['migration_worker_link.sql', 'migration_worker_ledger.sql', 'migration_notifications_qr.sql'];
const ALREADY = ['ER_DUP_FIELDNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_DUP_KEYNAME'];

(async () => {
  console.log('دیتابیس:', process.env.DB_NAME);
  for (const f of FILES) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) { console.log(`⚠️ فایل ${f} پیدا نشد؛ رد شد`); continue; }
    console.log(`\n── ${f}`);
    const statements = fs.readFileSync(p, 'utf8')
      .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
      .split(';').map(s => s.trim()).filter(Boolean);
    for (const sql of statements) {
      const label = sql.replace(/\s+/g, ' ').slice(0, 70);
      try {
        await db.query(sql);
        console.log('✅', label);
      } catch (err) {
        if (ALREADY.includes(err.code)) console.log('✔️ قبلاً انجام شده:', label);
        else console.log('❌', label, '\n   →', err.message);
      }
    }
  }
  console.log('\nتمام شد.');
  await db.end();
})();
