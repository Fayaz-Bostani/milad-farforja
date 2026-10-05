const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db');

// ورود
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'ایمیل و رمز عبور الزامی است.' });

    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1', [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ message: 'ایمیل یا رمز عبور اشتباه است.' });

    const user = rows[0];

    if (!user.is_approved)
      return res.status(403).json({ message: 'حساب شما هنوز تأیید نشده. لطفاً منتظر تأیید ادمین باشید.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ message: 'ایمیل یا رمز عبور اشتباه است.' });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};

// ثبت‌نام (نیاز به تأیید ادمین)
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'نام، ایمیل و رمز عبور الزامی است.' });

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ message: 'این ایمیل قبلاً ثبت شده است.' });

    const hash = await bcrypt.hash(password, 10);
    const allowedRole = ['staff', 'customer'].includes(role) ? role : 'customer';

    await db.query(
      'INSERT INTO users (name, email, password_hash, role, is_approved) VALUES (?, ?, ?, ?, 0)',
      [name, email, hash, allowedRole]
    );

    res.status(201).json({ message: 'ثبت‌نام موفق. منتظر تأیید ادمین باشید.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};

// گرفتن اطلاعات کاربر فعلی
const getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, is_approved, custom_permissions, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'کاربر یافت نشد.' });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};

module.exports = { login, register, getMe };
