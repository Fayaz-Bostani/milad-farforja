const bcrypt = require('bcryptjs');
const db = require('../db');

// نقش‌های قابل تعیین: فقط مالک می‌تواند ادمین بسازد؛ نقش «مالک» از طریق API قابل تعیین نیست
const ASSIGNABLE = ['admin', 'staff', 'customer'];

// آیا درخواست‌دهنده اجازه دست‌زدن به این کاربر هدف را دارد؟
// ادمین فقط روی کارگر و مشتری اختیار دارد؛ مالک روی همه (به‌جز خودش در برخی کارها)
const canManage = (reqUser, targetRole) => {
  if (reqUser.role === 'owner') return true;
  return targetRole === 'staff' || targetRole === 'customer';
};

const getTarget = async (id) => {
  const [rows] = await db.query('SELECT id, role FROM users WHERE id = ?', [id]);
  return rows[0] || null;
};

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

    const target = await getTarget(id);
    if (!target) return res.status(404).json({ message: 'کاربر یافت نشد.' });
    if (!canManage(req.user, target.role))
      return res.status(403).json({ message: 'شما اجازه‌ی تغییر این کاربر را ندارید.' });

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

    const target = await getTarget(id);
    if (!target) return res.status(404).json({ message: 'کاربر یافت نشد.' });
    if (!canManage(req.user, target.role))
      return res.status(403).json({ message: 'شما اجازه‌ی تغییر این کاربر را ندارید.' });
    if (target.role === 'owner' && (role || is_active === false || is_active === 0))
      return res.status(400).json({ message: 'نقش و فعال‌بودن حساب مالک قابل تغییر نیست.' });

    if (role) {
      if (!ASSIGNABLE.includes(role))
        return res.status(400).json({ message: 'نقش نامعتبر است.' });
      if (role === 'admin' && req.user.role !== 'owner')
        return res.status(403).json({ message: 'فقط مالک می‌تواند ادمین تعیین کند.' });
    }

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

    const target = await getTarget(id);
    if (!target) return res.status(404).json({ message: 'کاربر یافت نشد.' });
    if (target.role === 'owner')
      return res.status(400).json({ message: 'حساب مالک قابل حذف نیست.' });
    if (!canManage(req.user, target.role))
      return res.status(403).json({ message: 'شما اجازه‌ی حذف این کاربر را ندارید.' });

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

// وصل کردن حساب کاربری کارگر به یک پرونده‌ی کارگر موجود
const linkWorker = async (req, res) => {
  try {
    const { id } = req.params;        // users.id
    const { worker_id } = req.body;   // workers.id — یا null برای قطع اتصال

    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [id]);
    if (!userRows.length) return res.status(404).json({ message: 'کاربر یافت نشد.' });
    if (userRows[0].role !== 'staff')
      return res.status(400).json({ message: 'فقط حساب‌های کارگر قابل اتصال به پرونده‌ی کارگر هستند.' });

    // هر حساب فقط به یک پرونده وصل باشد
    await db.query('UPDATE workers SET user_id = NULL WHERE user_id = ?', [id]);
    if (worker_id) {
      const [w] = await db.query('SELECT user_id FROM workers WHERE id = ?', [worker_id]);
      if (!w.length) return res.status(404).json({ message: 'پرونده‌ی کارگر یافت نشد.' });
      if (w[0].user_id && String(w[0].user_id) !== String(id))
        return res.status(400).json({ message: 'این پرونده قبلاً به حساب دیگری وصل شده است.' });
      await db.query('UPDATE workers SET user_id = ? WHERE id = ?', [id, worker_id]);
    }
    res.json({ message: 'اتصال حساب کارگر بروزرسانی شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getAllUsers, approveUser, updateUser, deleteUser, linkCustomer, linkWorker };
