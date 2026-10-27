const db = require('../db');
const { nextNumber } = require('../utils/numbering');

// پیدا کردن رکورد مشتری متصل به این حساب کاربری
const getLinkedCustomer = async (userId) => {
  const [rows] = await db.query('SELECT * FROM customers WHERE user_id = ?', [userId]);
  return rows[0] || null;
};

// خلاصه وضعیت مالی + سفارش‌ها + فاکتورها + پرداخت‌های خودِ مشتری
const getMyAccount = async (req, res) => {
  try {
    const customer = await getLinkedCustomer(req.user.id);
    if (!customer) {
      return res.status(404).json({
        message: 'حساب شما هنوز به هیچ پرونده مشتری وصل نشده. لطفاً با کارخانه تماس بگیرید تا این کار انجام شود.'
      });
    }

    const [orders] = await db.query(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [customer.id]
    );
    const [invoices] = await db.query(
      'SELECT * FROM invoices WHERE customer_id = ? ORDER BY date DESC', [customer.id]
    );
    const [payments] = await db.query(
      'SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY date DESC', [customer.id]
    );

    const total_purchases = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
    const total_paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = total_purchases - total_paid; // مثبت = بدهکار، منفی = طلبکار

    res.json({
      customer,
      orders,
      invoices,
      payments,
      financial: { total_purchases, total_paid, balance }
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// لیست محصولات برای انتخاب (همون کاتالوگ عمومی، ولی برای فرم سفارش)
const getCatalogForOrder = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, product_code, name, category_id, weight, image_path
       FROM products WHERE is_active = 1 ORDER BY name`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ثبت سفارش توسط خود مشتری از روی کاتالوگ
const createMyOrder = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customer = await getLinkedCustomer(req.user.id);
    if (!customer) {
      return res.status(404).json({ message: 'حساب شما هنوز به هیچ پرونده مشتری وصل نشده. لطفاً با کارخانه تماس بگیرید.' });
    }

    const { items, note } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ message: 'حداقل یک محصول انتخاب کنید.' });
    }

    await conn.beginTransaction();

    const orderNumber = await nextNumber('orders', conn); // همان شماره‌گذاری خودکار سفارش‌های دستی
    const [result] = await conn.query(
      `INSERT INTO orders (order_number, customer_id, order_date, status, source, note)
       VALUES (?, ?, CURDATE(), 'registered', 'customer', ?)`,
      [orderNumber, customer.id, note || null]
    );
    const orderId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, description, quantity, note)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.description || null, item.quantity || 1, item.note || null]
      );
    }

    await conn.commit();

    // اعلان برای مدیر (اگر جدول اعلان‌ها مشکل داشت، ثبت سفارش خراب نمی‌شود)
    try {
      await db.query(
        "INSERT INTO notifications (type, message, order_id) VALUES ('new_order', ?, ?)",
        [`شما یک سفارش تازه از ${customer.name} دریافت کردید`, orderId]
      );
    } catch (e) { console.error('notification failed:', e.message); }

    res.status(201).json({ id: orderId, order_number: orderNumber, message: 'سفارش شما با موفقیت ثبت شد.' });
  } catch (err) {
    console.error(err);
    await conn.rollback();
    res.status(500).json({ message: 'خطای سرور.' });
  } finally {
    conn.release();
  }
};

// یک فاکتور مشخص، فقط اگر مال همین مشتری باشد (برای دیدن و چاپ توسط خود مشتری)
const getMyInvoice = async (req, res) => {
  try {
    const customer = await getLinkedCustomer(req.user.id);
    if (!customer) return res.status(404).json({ message: 'حساب شما هنوز به هیچ پرونده مشتری وصل نشده.' });

    const [inv] = await db.query(
      `SELECT i.*, c.name AS customer_name
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ? AND i.customer_id = ?`,
      [req.params.id, customer.id]
    );
    if (!inv.length) return res.status(404).json({ message: 'فاکتور یافت نشد.' });

    const [items] = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY `row_number`', [req.params.id]
    );
    res.json({ invoice: inv[0], items });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// موجودی انبار برای مشتری: فقط «موجود» یا «ناموجود» (ناموجود فقط وقتی تعداد صفر باشد)
// تعداد دقیق هرگز به مشتری فرستاده نمی‌شود
const getMyStock = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.product_code, p.name, p.image_path, c.name AS category_name,
              COALESCE(pi.quantity, 0) AS q
         FROM products p
         LEFT JOIN product_inventory pi ON pi.product_id = p.id
         LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE p.is_active = 1 ORDER BY p.name`
    );
    res.json(rows.map(r => ({
      id: r.id, product_code: r.product_code, name: r.name, image_path: r.image_path,
      category_name: r.category_name, available: Number(r.q) > 0,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getMyAccount, getMyInvoice, getCatalogForOrder, createMyOrder, getMyStock };
