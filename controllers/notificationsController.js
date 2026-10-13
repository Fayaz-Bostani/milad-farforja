const db = require('../db');

// اعلان‌های مدیر (مثلاً سفارش تازه‌ی مشتری)
const getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, type, message, order_id, is_read, created_at FROM notifications ORDER BY id DESC LIMIT 20'
    );
    const [[{ unread }]] = await db.query('SELECT COUNT(*) AS unread FROM notifications WHERE is_read = 0');
    res.json({ items: rows, unread });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const markRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'ok' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const markAllRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    res.json({ message: 'ok' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getAll, markRead, markAllRead };
