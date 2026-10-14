const db = require('../db');

// شماره بعدی = بزرگ‌ترین شمارهٔ «فقط عددی» + ۱ (شماره‌های غیرعددی مثل ONL... نادیده گرفته می‌شوند)
const COLS = { orders: 'order_number', invoices: 'bill_number' };

async function nextNumber(table, conn = db) {
  const col = COLS[table];
  if (!col) throw new Error('جدول نامعتبر');
  const [[row]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(\`${col}\` AS UNSIGNED)), 0) + 1 AS n
       FROM \`${table}\` WHERE \`${col}\` REGEXP '^[0-9]+$'`
  );
  return String(row.n);
}

module.exports = { nextNumber };
