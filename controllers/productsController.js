const db = require('../db');
const multer = require('multer');
const path = require('path');

// تنظیم آپلود عکس
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/products/'),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN product_categories c ON p.category_id = c.id
       WHERE p.is_active = 1
       ORDER BY p.name`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// محصولات برای QR Code (عمومی - بدون احراز هویت)
const getPublic = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.weight, p.height, p.width, p.price, p.image_path, p.description, c.name as category_name
       FROM products p
       LEFT JOIN product_categories c ON p.category_id = c.id
       WHERE p.is_active = 1
       ORDER BY c.name, p.name`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const getOne = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN product_categories c ON p.category_id = c.id
       WHERE p.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'محصول یافت نشد.' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const create = async (req, res) => {
  try {
    const { product_code, name, category_id, weight, height, width, price, description, is_custom } = req.body;
    const image_path = req.file ? `/uploads/products/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO products (product_code, name, category_id, weight, height, width, price, image_path, description, is_custom) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [product_code, name, category_id, weight, height, width, price || 0, image_path, description, is_custom ? 1 : 0]
    );

    // اضافه کردن به موجودی انبار
    await db.query('INSERT INTO product_inventory (product_id, quantity, total_weight) VALUES (?,0,0)', [result.insertId]);

    res.status(201).json({ id: result.insertId, message: 'محصول اضافه شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const update = async (req, res) => {
  try {
    const { name, category_id, weight, height, width, price, description, is_custom, is_active } = req.body;
    const image_path = req.file ? `/uploads/products/${req.file.filename}` : undefined;

    let query = 'UPDATE products SET name=?, category_id=?, weight=?, height=?, width=?, price=?, description=?, is_custom=?, is_active=?';
    let params = [name, category_id, weight, height, width, price, description, is_custom ? 1 : 0, is_active ? 1 : 0];

    if (image_path) { query += ', image_path=?'; params.push(image_path); }
    query += ' WHERE id=?';
    params.push(req.params.id);

    await db.query(query, params);
    res.json({ message: 'محصول بروزرسانی شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const getCategories = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM product_categories ORDER BY name');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// حذف محصول (حذف نرم — چون ممکنه در سفارشات/فاکتورهای قبلی استفاده شده باشه)
const remove = async (req, res) => {
  try {
    const [result] = await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'محصول یافت نشد.' });
    res.json({ message: 'محصول حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getAll, getPublic, getOne, create, update, getCategories, upload, remove };
