const db = require('../db');

// مواد اولیه
const getRawMaterials = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM raw_materials ORDER BY name');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const addRawMaterial = async (req, res) => {
  try {
    const { name, stock, unit, min_stock } = req.body;
    const [result] = await db.query(
      'INSERT INTO raw_materials (name, stock, unit, min_stock) VALUES (?,?,?,?)',
      [name, stock || 0, unit, min_stock || 0]
    );
    res.status(201).json({ id: result.insertId, message: 'ماده اولیه اضافه شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const updateRawMaterial = async (req, res) => {
  try {
    const { name, stock, unit, min_stock } = req.body;
    await db.query(
      'UPDATE raw_materials SET name=?, stock=?, unit=?, min_stock=? WHERE id=?',
      [name, stock, unit, min_stock, req.params.id]
    );
    res.json({ message: 'ماده اولیه بروزرسانی شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// تغییر موجودی ماده اولیه (ورود یا مصرف)
const logRawMaterial = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { material_id, change_amount, reason, date } = req.body;

    const [[mat]] = await conn.query('SELECT stock FROM raw_materials WHERE id = ?', [material_id]);
    const newStock = parseFloat(mat.stock) + parseFloat(change_amount);

    await conn.query('UPDATE raw_materials SET stock = ? WHERE id = ?', [newStock, material_id]);
    await conn.query(
      'INSERT INTO raw_material_logs (material_id, change_amount, balance_after, reason, date) VALUES (?,?,?,?,?)',
      [material_id, change_amount, newStock, reason, date]
    );

    await conn.commit();
    res.json({ message: 'موجودی بروزرسانی شد.', new_stock: newStock });
  } catch (err) {
    console.error(err);
    await conn.rollback();
    res.status(500).json({ message: 'خطای سرور.' });
  } finally {
    conn.release();
  }
};

// موجودی محصولات آماده
const getProductInventory = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id as product_id, p.name, p.product_code, c.name as category_name,
              COALESCE(pi.quantity, 0) as quantity, COALESCE(pi.total_weight, 0) as total_weight
       FROM products p
       LEFT JOIN product_inventory pi ON pi.product_id = p.id
       LEFT JOIN product_categories c ON p.category_id = c.id
       WHERE p.is_active = 1
       ORDER BY p.name`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const updateProductInventory = async (req, res) => {
  try {
    const { product_id, quantity, total_weight } = req.body;
    // upsert: اگه ردیفی برای این محصول نبود بسازش، بود آپدیتش کن
    await db.query(
      `INSERT INTO product_inventory (product_id, quantity, total_weight) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), total_weight = VALUES(total_weight)`,
      [product_id, quantity || 0, total_weight || 0]
    );
    res.json({ message: 'موجودی محصول بروزرسانی شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// مواد رو به اتمام (کمتر از حداقل)
const getLowStock = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM raw_materials WHERE stock <= min_stock ORDER BY name'
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// حذف ماده اولیه
// بررسی سابقه‌ی تراکنش برای ماده اولیه
const getUsageRawMaterial = async (req, res) => {
  try {
    const [[log]] = await db.query('SELECT COUNT(*) c FROM raw_material_logs WHERE material_id=?', [req.params.id]);
    res.json({ hasHistory: log.c > 0, counts: { 'تراکنش انبار': log.c } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// حذف ماده اولیه — همراه با سابقه‌ی تراکنش‌هاش
const removeRawMaterial = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id = req.params.id;
    await conn.beginTransaction();
    await conn.query('DELETE FROM raw_material_logs WHERE material_id=?', [id]);
    const [result] = await conn.query('DELETE FROM raw_materials WHERE id=?', [id]);
    await conn.commit();
    if (!result.affectedRows) return res.status(404).json({ message: 'ماده اولیه یافت نشد.' });
    res.json({ message: 'ماده اولیه حذف شد.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  } finally { conn.release(); }
};

module.exports = {
  getRawMaterials, addRawMaterial, updateRawMaterial, logRawMaterial,
  getProductInventory, updateProductInventory, getLowStock, removeRawMaterial, getUsageRawMaterial
};
