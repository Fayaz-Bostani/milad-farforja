const bcrypt = require('bcryptjs');
const db = require('../db');

// لیست همه کاربران (ادمین)
const getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, is_approved, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};

// تأیید یا رد کاربر
const approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;

    await db.query('UPDATE users SET is_approved = ? WHERE id = ?', [is_approved ? 1 : 0, id]);
    res.json({ message: is_approved ? 'کاربر تأیید شد.' : 'تأیید کاربر لغو شد.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};

// تغییر نقش یا دسترسی
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active, custom_permissions } = req.body;

    const fields = [];
    const values = [];

    if (role) { fields.push('role = ?'); values.push(role); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (custom_permissions !== undefined) {
      fields.push('custom_permissions = ?');
      values.push(JSON.stringify(custom_permissions));
    }

    if (fields.length === 0)
      return res.status(400).json({ message: 'هیچ فیلدی برای بروزرسانی ارسال نشد.' });

    values.push(id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'کاربر بروزرسانی شد.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};

// حذف کاربر
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ message: 'نمی‌توانید حساب خودتان را حذف کنید.' });

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'کاربر حذف شد.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};

// وصل کردن حساب کاربری مشتری به یک پرونده مشتری موجود
const linkCustomer = async (req, res) => {
  try {
    const { id } = req.params;         // شناسه کاربر (users.id)
    const { customer_id } = req.body;  // شناسه پرونده مشتری (customers.id) — یا null برای قطع اتصال

    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [id]);
    if (!userRows.length) return res.status(404).json({ message: 'کاربر یافت نشد.' });
    if (userRows[0].role !== 'customer')
      return res.status(400).json({ message: 'فقط حساب‌های مشتری قابل اتصال به پرونده مشتری هستند.' });

    if (customer_id) {
      await db.query('UPDATE customers SET user_id = ? WHERE id = ?', [id, customer_id]);
    } else {
      await db.query('UPDATE customers SET user_id = NULL WHERE user_id = ?', [id]);
    }
    res.json({ message: 'اتصال حساب کاربر بروزرسانی شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getAllUsers, approveUser, updateUser, deleteUser, linkCustomer };
