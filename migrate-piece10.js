// تغییرات دیتابیس piece10 — استفاده:  node migrate-piece10.js
// هر بار که اجرا شود فقط چیزهایی را اضافه می‌کند که هنوز در دیتابیس نیست (بی‌خطر است).
//  ۱) ستون note برای محصولات
//  ۲) ستون customer_name_text برای فاکتور (نام آزاد مشتری) و خالی‌پذیر شدن customer_id
//  ۳) همهٔ ستون‌هایی که فاکتور برای ثبت لازم دارد (اگر دیتابیس شما عقب‌تر از کد بود)
require('dotenv').config();
const db = require('./db');

const DB = process.env.DB_NAME || 'milad_farforja';

async function colInfo(table, col) {
  const [r] = await db.query(
    `SELECT DATA_TYPE dt, COLUMN_TYPE ct, IS_NULLABLE nl, CHARACTER_MAXIMUM_LENGTH len
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [DB, table, col]);
  return r[0] || null;
}

async function ensureColumn(table, col, definition) {
  if (await colInfo(table, col)) { console.log(`✔️ قبلاً بوده: ${table}.${col}`); return; }
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${definition}`);
  console.log(`✅ اضافه شد: ${table}.${col}`);
}

(async () => {
  console.log('دیتابیس:', DB, '\n');
  try {
    // --- محصولات
    await ensureColumn('products', 'note', 'TEXT NULL');

    // --- فاکتور: نام آزاد مشتری
    await ensureColumn('invoices', 'customer_name_text', 'VARCHAR(150) NULL');
    const cid = await colInfo('invoices', 'customer_id');
    if (cid && cid.nl === 'YES') console.log('✔️ قبلاً بوده: invoices.customer_id خالی‌پذیر است');
    else if (cid) { await db.query(`ALTER TABLE invoices MODIFY customer_id ${cid.ct} NULL`); console.log('✅ invoices.customer_id خالی‌پذیر شد'); }

    // --- فاکتور: ستون‌هایی که ثبت فاکتور لازم دارد
    await ensureColumn('invoices', 'order_id', 'INT NULL');
    await ensureColumn('invoices', 'factory_name', 'VARCHAR(150) NULL');
    await ensureColumn('invoices', 'factory_address', 'VARCHAR(255) NULL');
    await ensureColumn('invoices', 'factory_phone', 'VARCHAR(100) NULL');
    await ensureColumn('invoices', 'total_weight', 'DECIMAL(12,2) NULL');
    await ensureColumn('invoices', 'notes', 'TEXT NULL');
    await ensureColumn('invoices', 'show_total_weight', 'TINYINT(1) NOT NULL DEFAULT 1');
    await ensureColumn('invoices', 'show_total_quantity', 'TINYINT(1) NOT NULL DEFAULT 1');

    // total_quantity باید متن باشد (می‌توان «۱۲ عدد» نوشت)
    const tq = await colInfo('invoices', 'total_quantity');
    if (!tq) { await db.query('ALTER TABLE invoices ADD COLUMN total_quantity VARCHAR(50) NULL'); console.log('✅ اضافه شد: invoices.total_quantity'); }
    else if (!['varchar', 'char', 'text'].includes(tq.dt)) { await db.query('ALTER TABLE invoices MODIFY total_quantity VARCHAR(50) NULL'); console.log('✅ invoices.total_quantity به متن تبدیل شد'); }
    else console.log('✔️ قبلاً بوده: invoices.total_quantity');

    // qr_data عکس base64 است و باید جای کافی داشته باشد
    const qr = await colInfo('invoices', 'qr_data');
    if (!qr) { await db.query('ALTER TABLE invoices ADD COLUMN qr_data MEDIUMTEXT NULL'); console.log('✅ اضافه شد: invoices.qr_data'); }
    else if (['varchar', 'char'].includes(qr.dt) || qr.dt === 'text') { await db.query('ALTER TABLE invoices MODIFY qr_data MEDIUMTEXT NULL'); console.log('✅ invoices.qr_data بزرگ‌تر شد'); }
    else console.log('✔️ قبلاً بوده: invoices.qr_data');

    // --- سطرهای فاکتور
    await ensureColumn('invoice_items', 'specifications', 'VARCHAR(255) NULL');
  } catch (err) {
    console.log('❌ خطا:', err.message);
  }
  console.log('\nتمام شد.');
  await db.end();
})();
