const db = require('../db');

// فهرست محصولات برای کارگر (فقط‌خواندنی؛ بدون یادداشت داخلی مدیر)
const getWorkerProducts = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.product_code, p.name, c.name AS category_name, p.weight, p.height, p.width, p.description, p.image_path
         FROM products p LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE p.is_active = 1 ORDER BY p.name`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getWorkerProducts };
