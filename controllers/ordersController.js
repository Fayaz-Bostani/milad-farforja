const db = require('../db');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/orders/'),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

const getAll = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT o.*, c.name as customer_name
                 FROM orders o
                 LEFT JOIN customers c ON o.customer_id = c.id`;
    const params = [];
    if (status) { query += ' WHERE o.status = ?'; params.push(status); }
    query += ' ORDER BY o.created_at DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const getOne = async (req, res) => {
  try {
    const [order] = await db.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`, [req.params.id]
    );
    if (!order.length) return res.status(404).json({ message: 'سفارش یافت نشد.' });

    const [items] = await db.query(
      `SELECT oi.*, p.name as product_name FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`, [req.params.id]
    );

    res.json({ order: order[0], items });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const create = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { order_number, bill_number, customer_id, order_date, delivery_date, note, extra_notes, items } = req.body;
    const sample_image = req.files?.sample_image?.[0]?.filename
      ? `/uploads/orders/${req.files.sample_image[0].filename}` : null;
    const design_file = req.files?.design_file?.[0]?.filename
      ? `/uploads/orders/${req.files.design_file[0].filename}` : null;

    const [result] = await conn.query(
      'INSERT INTO orders (order_number, bill_number, customer_id, order_date, delivery_date, note, extra_notes, sample_image, design_file) VALUES (?,?,?,?,?,?,?,?,?)',
      [order_number, bill_number, customer_id, order_date, delivery_date, note, extra_notes, sample_image, design_file]
    );

    const orderId = result.insertId;

    if (items && items.length) {
      for (const item of items) {
        await conn.query(
          'INSERT INTO order_items (order_id, product_id, description, quantity, weight, unit_price, total_price, note) VALUES (?,?,?,?,?,?,?,?)',
          [orderId, item.product_id || null, item.description, item.quantity || 1, item.weight || 0, item.unit_price || 0, item.total_price || 0, item.note]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ id: orderId, message: 'سفارش ثبت شد.' });
  } catch (err) {
    console.error(err);
    await conn.rollback();
    res.status(500).json({ message: 'خطای سرور.' });
  } finally {
    conn.release();
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'وضعیت سفارش بروزرسانی شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// بررسی سابقه‌ی سفارش (آیا فاکتوری بهش وصله؟)
const getUsage = async (req, res) => {
  try {
    const [[inv]] = await db.query('SELECT COUNT(*) c FROM invoices WHERE order_id=?', [req.params.id]);
    res.json({ hasHistory: inv.c > 0, counts: { فاکتور: inv.c } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// حذف سفارش — اقلام سفارش خودکار پاک می‌شن (CASCADE)، فاکتورهای مرتبط فقط لینکشون به سفارش قطع می‌شه (خود فاکتور می‌مونه)
const remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'سفارش یافت نشد.' });
    res.json({ message: 'سفارش حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getAll, getOne, create, updateStatus, upload, remove, getUsage };
