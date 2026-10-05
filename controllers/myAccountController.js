const db = require('../db');

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
      `SELECT id, product_code, name, category_id, weight, price, image_path
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

    const orderNumber = 'ONL' + Date.now();
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
    res.status(201).json({ id: orderId, order_number: orderNumber, message: 'سفارش شما با موفقیت ثبت شد.' });
  } catch (err) {
    console.error(err);
    await conn.rollback();
    res.status(500).json({ message: 'خطای سرور.' });
  } finally {
    conn.release();
  }
};

module.exports = { getMyAccount, getCatalogForOrder, createMyOrder };
