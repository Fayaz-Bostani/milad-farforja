const db = require('../db');

const getAll = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM customers ORDER BY name');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const [customer] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer.length) return res.status(404).json({ message: 'مشتری یافت نشد.' });

    // سفارشات
    const [orders] = await db.query(
      'SELECT id, order_number, bill_number, order_date, delivery_date, status FROM orders WHERE customer_id = ? ORDER BY order_date DESC',
      [id]
    );
    // فاکتورها
    const [invoices] = await db.query(
      'SELECT id, bill_number, date, total_amount FROM invoices WHERE customer_id = ? ORDER BY date DESC',
      [id]
    );
    // پرداخت‌ها
    const [payments] = await db.query(
      'SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY date DESC',
      [id]
    );
    // مجموع خرید
    const [totals] = await db.query(
      'SELECT COALESCE(SUM(total_amount),0) as total_purchases FROM invoices WHERE customer_id = ?',
      [id]
    );
    const [paid] = await db.query(
      'SELECT COALESCE(SUM(amount),0) as total_paid FROM customer_payments WHERE customer_id = ?',
      [id]
    );

    const totalPurchases = totals[0].total_purchases;
    const totalPaid = paid[0].total_paid;

    res.json({
      customer: customer[0],
      orders,
      invoices,
      payments,
      financial: {
        total_purchases: totalPurchases,
        total_paid: totalPaid,
        balance: totalPurchases - totalPaid,  // مثبت = بدهی، منفی = طلب
      }
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const create = async (req, res) => {
  try {
    const { customer_code, name, phone, address, user_id } = req.body;
    const [result] = await db.query(
      'INSERT INTO customers (customer_code, name, phone, address, user_id) VALUES (?,?,?,?,?)',
      [customer_code, name, phone, address, user_id || null]
    );
    res.status(201).json({ id: result.insertId, message: 'مشتری اضافه شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const update = async (req, res) => {
  try {
    const { customer_code, name, phone, address } = req.body;
    await db.query('UPDATE customers SET customer_code=?, name=?, phone=?, address=? WHERE id=?',
      [customer_code, name, phone, address, req.params.id]);
    res.json({ message: 'مشتری بروزرسانی شد.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'این کد مشتری قبلاً برای یک مشتری دیگر ثبت شده. یه کد دیگه انتخاب کن.' });
    }
    console.error(err); res.status(500).json({ message: 'خطای سرور.' });
  }
};

// ثبت پرداخت مشتری
const addPayment = async (req, res) => {
  try {
    const { customer_id, invoice_id, amount, date, note } = req.body;
    await db.query(
      'INSERT INTO customer_payments (customer_id, invoice_id, amount, date, note) VALUES (?,?,?,?,?)',
      [customer_id, invoice_id || null, amount, date, note]
    );
    res.status(201).json({ message: 'پرداخت ثبت شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// حذف مشتری
// بررسی سابقه‌ی مشتری (سفارش/فاکتور/پرداخت)
const getUsage = async (req, res) => {
  try {
    const id = req.params.id;
    const [[ord]] = await db.query('SELECT COUNT(*) c FROM orders WHERE customer_id=?', [id]);
    const [[inv]] = await db.query('SELECT COUNT(*) c FROM invoices WHERE customer_id=?', [id]);
    const [[pay]] = await db.query('SELECT COUNT(*) c FROM customer_payments WHERE customer_id=?', [id]);
    const counts = { سفارش: ord.c, فاکتور: inv.c, پرداخت: pay.c };
    res.json({ hasHistory: (ord.c + inv.c + pay.c) > 0, counts });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// حذف مشتری — همراه با سفارش‌ها، فاکتورها و پرداخت‌های مرتبطش (بعد از تأیید کاربر)
const remove = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id = req.params.id;
    await conn.beginTransaction();
    await conn.query('DELETE FROM customer_payments WHERE customer_id=?', [id]);
    await conn.query('DELETE FROM invoices WHERE customer_id=?', [id]);   // invoice_items با CASCADE خودکار پاک می‌شن
    await conn.query('DELETE FROM orders WHERE customer_id=?', [id]);     // order_items با CASCADE خودکار پاک می‌شن
    const [result] = await conn.query('DELETE FROM customers WHERE id=?', [id]);
    await conn.commit();
    if (!result.affectedRows) return res.status(404).json({ message: 'مشتری یافت نشد.' });
    res.json({ message: 'مشتری حذف شد.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  } finally { conn.release(); }
};

module.exports = { getAll, getOne, create, update, addPayment, remove, getUsage };
